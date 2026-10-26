import "server-only";

import { z } from "zod";
import {
  CaseDraftSchema,
  CaseDraftShapeSchema,
  CaseSchema,
  type CaseDraft,
} from "@/lib/case/schema";
import type { Json } from "@/lib/supabase/database.types";
import { getGeneratorModel, getSolverModel, withRetry, type JsonModel } from "@/server/ai";
import exampleCase from "@/server/cases/fixtures/case-001.json";
import { createSupabaseAdminClient } from "@/server/supabase";
import { failedErrors, runLogicChecks, type CheckResult } from "./logic-checks";
import {
  GENERATOR_SYSTEM,
  buildGeneratorPrompt,
  buildRepairPrompt,
  describeProblems,
  pickTheme,
  type Difficulty,
} from "./prompt";
import { TOO_EASY_PROBABILITY, solveCase, type SolverRun } from "./solver";

/*
 * Case generation, start to finish:
 *   1. the generator model writes a case as JSON (structured output),
 *   2. Zod checks shape and references,
 *   3. code checks the story logic,
 *      (2-3 failing: the model gets the problems back and one chance to fix them)
 *   4. a blind solver tries to solve it twice, plus once from the briefing only,
 *   5. the case is saved as a draft with its review: "pending" for the admin
 *      to approve, or "rejected" with the reasons.
 * Nothing here is published: only the admin's approval does that.
 */

const GENERATOR_MAX_OUTPUT_TOKENS = 60_000;
const GENERATOR_TEMPERATURE = 1;
/** Fix attempts after the first draft, when there is time left. */
/**
 * Repair rounds after the first draft. Hard cases get one more: the blind solver's
 * "too easy" verdict comes last, and a first round often goes on small fixes.
 */
const MAX_REPAIRS: Record<Difficulty, number> = { easy: 1, medium: 1, hard: 2 };
/** A repair takes about as long as a generation; don't start one without this much time. */
const MIN_MS_FOR_REPAIR = 150_000;
const FULL_SOLVER_RUNS = 2;

export type PipelineOptions = {
  difficulty: Difficulty;
  theme?: string;
  /** Epoch ms. Optional steps are skipped if they wouldn't finish in time (e.g. cron limits). */
  deadline?: number;
  log?: (message: string) => void;
};

type Attempt = { kind: "generate" | "repair"; ms: number; problems: string[] };

export type PipelineOutcome =
  | { decision: "pending" | "rejected"; caseId: string; title: string; reasons: string[] }
  | { decision: "failed"; reasons: string[] };

/** The example case, as the generator sees it (no case number). */
function exampleDraft(): CaseDraft {
  const parsed = CaseSchema.parse(exampleCase);
  return CaseDraftSchema.parse({
    difficulty: parsed.difficulty,
    public: parsed.public,
    secret: parsed.secret,
  });
}

/**
 * Sorting is mechanical, so we do it instead of spending a model call on it.
 * ("HH:MM" strings sort correctly as text; the sort is stable for equal times.)
 */
function sortTimeline(json: unknown): unknown {
  const parsed = z
    .object({ secret: z.looseObject({ timeline: z.array(z.looseObject({ at: z.string() })) }) })
    .loose()
    .safeParse(json);
  if (!parsed.success) return json;
  const timeline = [...parsed.data.secret.timeline].sort((a, b) => a.at.localeCompare(b.at));
  return { ...parsed.data, secret: { ...parsed.data.secret, timeline } };
}

/** Parses the model's JSON and runs Zod + logic checks. Returns the problems found. */
function evaluate(text: string): {
  draft: CaseDraft | null;
  logic: CheckResult[];
  problems: string[];
} {
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    return { draft: null, logic: [], problems: ["The answer is not valid JSON."] };
  }
  const parsed = CaseDraftSchema.safeParse(sortTimeline(json));
  if (!parsed.success) {
    const problems = parsed.error.issues
      .slice(0, 20)
      .map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
    return { draft: null, logic: [], problems };
  }
  const logic = runLogicChecks(parsed.data);
  return { draft: parsed.data, logic, problems: describeProblems(failedErrors(logic)) };
}

export async function runPipeline(options: PipelineOptions): Promise<PipelineOutcome> {
  const log = options.log ?? (() => {});
  const startedAt = Date.now();
  const timeLeft = () => (options.deadline ?? Infinity) - Date.now();
  const generator = getGeneratorModel();
  const db = createSupabaseAdminClient();
  const theme = options.theme ?? pickTheme(await usedThemes(db));

  const { data: existing } = await db.from("cases").select("public_briefing");
  const avoidTitles = (existing ?? []).flatMap((row) => {
    const title = z.object({ title: z.object({ en: z.string() }) }).safeParse(row.public_briefing);
    return title.success ? [title.data.title.en] : [];
  });

  // 1-4. Generate and check; if anything fails, the model gets a chance (two for hard) to fix it.
  const attempts: Attempt[] = [];
  const schema = z.toJSONSchema(CaseDraftShapeSchema);
  let prompt = buildGeneratorPrompt({
    difficulty: options.difficulty,
    theme,
    example: exampleDraft(),
    avoidTitles,
  });
  // The latest case that passed Zod, kept even if a repair comes back broken.
  let best: { draft: CaseDraft; checked: Checked } | null = null;
  let lastProblems: string[] = [];

  for (let attempt = 0; attempt <= MAX_REPAIRS[options.difficulty]; attempt++) {
    if (attempt > 0 && timeLeft() < MIN_MS_FOR_REPAIR) {
      log("Not enough time left for a repair.");
      break;
    }
    const kind = attempt === 0 ? "generate" : "repair";
    log(`${kind}: asking ${generator.id} (${theme}, ${options.difficulty})...`);
    const t = Date.now();
    let answer: string;
    try {
      answer = await callModel(generator, prompt, schema, timeLeft(), log);
    } catch (error) {
      // A failed repair (e.g. the daily quota ran out) must not lose the draft we already have.
      if (!best) throw error;
      log(`${kind} failed, keeping the last checked draft: ${errorMessage(error)}`);
      attempts.push({
        kind,
        ms: Date.now() - t,
        problems: [`${kind} failed: ${errorMessage(error)}`],
      });
      break;
    }
    const evaluated = evaluate(answer);
    log(`${kind}: written in ${Math.round((Date.now() - t) / 1000)}s`);

    let notes = evaluated.problems;
    if (evaluated.draft) {
      // Logic + blind solver (the solver only runs if the logic holds).
      const checked = await checkDraft(evaluated.draft, evaluated.logic, { log, timeLeft });
      best = { draft: evaluated.draft, checked };
      notes = repairNotes(checked);
    }
    lastProblems = notes;
    attempts.push({ kind, ms: Date.now() - t, problems: notes });
    notes.forEach((n) => log(`  - ${n.slice(0, 300)}`));
    if (best?.checked.decision === "pending" && evaluated.draft) break;
    prompt = buildRepairPrompt(answer, notes);
  }

  if (!best) {
    return { decision: "failed", reasons: lastProblems };
  }
  const { draft, checked } = best;

  // 5. Save as a draft with its review.
  const { data: saved, error } = await db
    .from("cases")
    .insert({
      status: "draft",
      difficulty: draft.difficulty,
      public_briefing: draft.public,
      secret: draft.secret,
    })
    .select("id")
    .single();
  if (error) throw new Error(`Saving the draft failed: ${error.message}`);

  await saveReview(saved.id, checked, {
    theme,
    difficulty: options.difficulty,
    generatorModel: generator.id,
    durationMs: Date.now() - startedAt,
    attempts,
  });

  return {
    decision: checked.decision,
    caseId: saved.id,
    title: draft.public.title.en,
    reasons: checked.reasons,
  };
}

/**
 * Runs the checks again on a saved draft (e.g. after the solver hit a quota,
 * or after the admin edited it) and stores a new review.
 */
export async function recheckDraft(
  caseId: string,
  options: Pick<PipelineOptions, "deadline" | "log"> = {},
): Promise<PipelineOutcome> {
  const log = options.log ?? (() => {});
  const startedAt = Date.now();
  const timeLeft = () => (options.deadline ?? Infinity) - Date.now();

  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("status, difficulty, public_briefing, secret")
    .eq("id", caseId)
    .maybeSingle();
  if (error) throw new Error(`Loading draft ${caseId} failed: ${error.message}`);
  if (!data) throw new Error(`No case ${caseId}`);
  if (data.status !== "draft") throw new Error(`Case ${caseId} is already ${data.status}`);

  const parsed = CaseDraftSchema.safeParse({
    difficulty: data.difficulty,
    public: data.public_briefing,
    secret: data.secret,
  });
  if (!parsed.success) {
    return { decision: "failed", reasons: parsed.error.issues.map((i) => i.message) };
  }
  const draft = parsed.data;
  log(`recheck: "${draft.public.title.en}"`);
  const checked = await checkDraft(draft, runLogicChecks(draft), { log, timeLeft });
  await saveReview(caseId, checked, { recheck: true, durationMs: Date.now() - startedAt });
  return {
    decision: checked.decision,
    caseId,
    title: draft.public.title.en,
    reasons: checked.reasons,
  };
}

/** What the model is told to fix: failed checks, plus the solver's reasoning when relevant. */
function repairNotes(checked: Checked): string[] {
  const notes = [...checked.reasons];
  const briefingOnly = checked.solverRuns.find((r) => r.mode === "briefing_only");
  if (checked.reasons.some((r) => r.startsWith("too_easy")) && briefingOnly) {
    // A vague "make it harder" didn't work (every hard draft failed again after repair),
    // so the fix is spelled out: give the deduction a second, equally good answer.
    const decoy = briefingOnly.runnerUp?.suspectId ?? "the most suspicious innocent";
    notes.push(
      `A solver reading ONLY the public case file reasoned: "${briefingOnly.answer.reasoning}"`,
      [
        `Fix it like this, keeping the same killer:`,
        `(1) Make ${decoy} an equally good answer on paper.`,
        `(2) For every fact the solver used above, change the PUBLIC text (evidence descriptions, profiles, initial statements, setting) so it fits ${decoy} just as well: two people had that access, the item could be either one's, both had that motive and opportunity.`,
        `(3) Remove from public text anything only the killer has (a role, key, badge, skill, belonging, initial).`,
        `(4) Put the one fact that separates them into an innocent suspect's "hides", revealed "When shown the <exact evidence title>".`,
        `(5) Update the private notes, evidence pointsTo, timeline, hints and both languages to match.`,
      ].join(" "),
    );
  }
  const missed = checked.solverRuns.find((r) => r.mode === "full" && !r.passed);
  if (missed) {
    notes.push(
      `A solver with all the testimony picked ${missed.answer.killerId} (${Math.round(missed.killerProbability * 100)}% for the real killer) and reasoned: "${missed.answer.reasoning}". Make the real killer's guilt clearly follow from the clues and testimony, and weaken what misled it.`,
    );
  }
  return notes;
}

type Checked = {
  decision: "pending" | "rejected";
  reasons: string[];
  logic: CheckResult[];
  solverModel: string;
  solverRuns: SolverRun[];
  tooEasy: boolean;
};

/** Turns logic results into reasons and, if the logic holds, runs the blind solver. */
async function checkDraft(
  draft: CaseDraft,
  logic: CheckResult[],
  ctx: { log: (message: string) => void; timeLeft: () => number },
): Promise<Checked> {
  const { log } = ctx;
  const solver = getSolverModel();
  const reasons = describeProblems(failedErrors(logic));
  let solverRuns: SolverRun[] = [];

  if (reasons.length === 0) {
    log(`solver: ${FULL_SOLVER_RUNS} full runs + 1 briefing-only run with ${solver.id}...`);
    const signal = AbortSignal.timeout(callTimeout(ctx.timeLeft()));
    try {
      solverRuns = await Promise.all([
        ...Array.from({ length: FULL_SOLVER_RUNS }, () =>
          withRetry(() => solveCase(solver, draft, "full", signal), { log }),
        ),
        withRetry(() => solveCase(solver, draft, "briefing_only", signal), { log }),
      ]);
    } catch (error) {
      // Keep the written case: a solver hiccup shouldn't throw away minutes of generation.
      const message = error instanceof Error ? error.message : String(error);
      log(`  solver failed: ${message.slice(0, 300)}`);
      reasons.push(`blind_solver: the solver failed to run (${message.slice(0, 200)}).`);
    }
    for (const run of solverRuns) {
      log(
        `  ${run.mode}: picked ${run.answer.killerId} (killer ${pct(run.killerProbability)}, runner-up ${run.runnerUp?.suspectId ?? "-"} ${pct(run.runnerUp?.probability ?? 0)}) → ${run.passed ? "solved" : "not solved"}`,
      );
    }
    const failedFull = solverRuns.filter((r) => r.mode === "full" && !r.passed);
    if (failedFull.length > 0) {
      reasons.push(
        `blind_solver: ${failedFull.length} of ${FULL_SOLVER_RUNS} runs could not clearly identify the killer.`,
      );
    }
  }

  // Solvable without a single question: fine for an easy day, not for the others.
  const tooEasy = solverRuns.some(
    (r) =>
      r.mode === "briefing_only" && r.correctKiller && r.killerProbability >= TOO_EASY_PROBABILITY,
  );
  if (tooEasy && draft.difficulty !== "easy") {
    reasons.push(
      `too_easy: solved from the case file alone, without interrogation (not allowed for ${draft.difficulty}).`,
    );
  }

  return {
    decision: reasons.length === 0 ? "pending" : "rejected",
    reasons,
    logic,
    solverModel: solver.id,
    solverRuns,
    tooEasy,
  };
}

/** One entry per case that was generated with a theme (rechecks of the same case count once). */
async function usedThemes(db: ReturnType<typeof createSupabaseAdminClient>): Promise<string[]> {
  const { data, error } = await db.from("case_reviews").select("case_id, theme:checks->>theme");
  if (error) throw new Error(`Reading used themes failed: ${error.message}`);
  const byCase = new Map<string, string>();
  for (const row of data) if (row.theme) byCase.set(row.case_id, row.theme);
  return [...byCase.values()];
}

async function saveReview(
  caseId: string,
  checked: Checked,
  extra: Record<string, unknown>,
): Promise<void> {
  const review = {
    version: 1,
    ...extra,
    solverModel: checked.solverModel,
    logic: checked.logic,
    solver: checked.solverRuns,
    tooEasy: checked.tooEasy,
  };
  const { error } = await createSupabaseAdminClient()
    .from("case_reviews")
    .insert({
      case_id: caseId,
      checks: toJson(review),
      decision: checked.decision,
      admin_notes:
        checked.decision === "rejected" ? `Auto-rejected: ${checked.reasons.join(" | ")}` : null,
    });
  if (error) throw new Error(`Saving the review failed: ${error.message}`);
}

async function callModel(
  model: JsonModel,
  prompt: string,
  schema: Record<string, unknown>,
  msLeft: number,
  log: (message: string) => void,
): Promise<string> {
  const result = await withRetry(
    () =>
      model.generateJson({
        system: GENERATOR_SYSTEM,
        prompt,
        schema,
        maxOutputTokens: GENERATOR_MAX_OUTPUT_TOKENS,
        temperature: GENERATOR_TEMPERATURE,
        signal: AbortSignal.timeout(callTimeout(msLeft)),
        // The thinking model can be silent for 5+ minutes; streamed thoughts keep
        // the connection alive (Node's fetch drops it after 300 s without headers).
        streamThoughts: true,
      }),
    { log },
  );
  return result.text;
}

/** Plain JSON round trip, so the review fits the `jsonb` column's type. */
function toJson(value: unknown): Json {
  return JSON.parse(JSON.stringify(value)) as Json;
}

/**
 * Per-call limit. With a deadline (the admin panel on Vercel, 300 s per
 * function): what's left, between 30 s and 280 s. Without one (npm run
 * generate): 10 minutes, since the thinking model sometimes needs over 280 s.
 */
function callTimeout(msLeft: number): number {
  if (!Number.isFinite(msLeft)) return LOCAL_CALL_TIMEOUT_MS;
  return Math.round(Math.max(Math.min(msLeft, 280_000), 30_000));
}

const LOCAL_CALL_TIMEOUT_MS = 600_000;

function pct(p: number): string {
  return `${Math.round(p * 100)}%`;
}

function errorMessage(error: unknown): string {
  return (error instanceof Error ? error.message : String(error)).slice(0, 200);
}
