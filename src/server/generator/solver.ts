import "server-only";

import { z } from "zod";
import type { CaseDraft } from "@/lib/case/schema";
import type { JsonModel } from "@/server/ai";

/*
 * The blind solver: a separate AI call that tries to solve a generated case
 * WITHOUT seeing the solution. If it can't name the killer, or another suspect
 * looks about as likely, the case is unfair and gets rejected.
 *
 * It sees what a perfect interrogation could get out of the suspects:
 *   - the public briefing (what every player reads),
 *   - for each innocent: what they know, the secrets they give up when the
 *     right question is asked, and the truth behind their lies,
 *   - for the killer: only the alibi they claim and the lies they tell
 *     (the killer never confesses in the game either).
 * It never sees the solution, the true timeline, which suspect each clue
 * points to, the evidence explanations or the hints.
 */

/** The killer must be the top suspect, with at least this probability... */
export const MIN_KILLER_PROBABILITY = 0.5;
/** ...and this far ahead of the runner-up. */
export const MIN_MARGIN = 0.2;
/** Without any interrogation, this much certainty means the case is too easy. */
export const TOO_EASY_PROBABILITY = 0.7;

export const SolverAnswerSchema = z.object({
  suspects: z
    .array(
      z.object({
        suspectId: z.string(),
        probability: z.number().min(0).max(1),
        reasoning: z.string(),
      }),
    )
    .min(1),
  killerId: z.string(),
  motiveId: z.string(),
  keyEvidenceId: z.string(),
  reasoning: z.string(),
});
export type SolverAnswer = z.infer<typeof SolverAnswerSchema>;

export type SolverMode = "full" | "briefing_only";

export type SolverRun = {
  mode: SolverMode;
  answer: SolverAnswer;
  killerProbability: number;
  runnerUp: { suspectId: string; probability: number } | null;
  correctKiller: boolean;
  correctMotive: boolean;
  correctKeyEvidence: boolean;
  passed: boolean;
};

const SYSTEM = [
  "You are a sharp, sceptical detective solving a murder mystery puzzle.",
  "Use only the facts given. Exactly one of the suspects is the killer.",
  "Suspects say different amounts; saying little is not evidence of guilt. Judge by alibis, timings, contradictions, motive, opportunity and physical evidence.",
  "Give every suspect a probability of being the killer; the probabilities must add up to 1.",
  "Then name the killer, the motive (one of the motive option ids) and the single most important piece of evidence (an evidence id).",
].join("\n");

/**
 * What the solver may see. Its parameter is the whole case, so this function
 * IS the boundary: tests check its output never contains the solution.
 */
export function buildSolverBrief(c: CaseDraft, mode: SolverMode): string {
  const { public: pub, secret } = c;
  const place = (id: string) => pub.locations.find((l) => l.id === id)?.name.en ?? id;

  const lines = [
    `CASE: ${pub.title.en}`,
    `Setting: ${pub.setting.place.en}, ${pub.setting.date}. ${pub.setting.summary.en}`,
    `Victim: ${pub.victim.name}. ${pub.victim.description.en}`,
    `Found dead in: ${place(pub.crimeSceneId)}. Estimated time of death: ${pub.estimatedTimeOfDeath.from}-${pub.estimatedTimeOfDeath.to}.`,
    `Places: ${pub.locations.map((l) => `${l.name.en} [${l.id}]`).join(", ")}.`,
    "",
    "SUSPECTS",
    ...pub.suspects.flatMap((s) => [
      `- ${s.name} [${s.id}], ${s.role.en}. ${s.profile.en}`,
      `  First statement: ${s.initialStatement.en}`,
    ]),
    "",
    "EVIDENCE",
    ...pub.evidence.map(
      (e) => `- ${e.title.en} [${e.id}], found in ${place(e.foundAt)}: ${e.description.en}`,
    ),
    "",
    "MOTIVE OPTIONS",
    ...pub.motiveOptions.map((m) => `- ${m.label.en} [${m.id}]`),
  ];

  if (mode === "full") {
    lines.push("", "WHAT THE INTERROGATIONS REVEALED");
    for (const s of pub.suspects) {
      const own = secret.suspects.find((x) => x.suspectId === s.id);
      if (!own) continue;
      lines.push(`- ${s.name}:`, `  Claims: ${own.alibi.claimed}`);
      if (s.id === secret.solution.killerId) {
        // The killer keeps lying; their own knowledge includes the confession.
        lines.push(...own.lies.map((l) => `  Says: ${l.lie}`));
      } else {
        lines.push(
          ...own.knows.map((k) => `  Said: ${k}`),
          ...own.hides
            .filter((h) => !/^\s*never\b/i.test(h.revealWhen))
            .map((h) => `  Admitted when pressed: ${h.secret}`),
          ...own.lies.map((l) => `  First said "${l.lie}", then admitted: ${l.truth}`),
        );
      }
    }
  }

  return lines.join("\n");
}

export async function solveCase(
  model: JsonModel,
  c: CaseDraft,
  mode: SolverMode,
  signal?: AbortSignal,
): Promise<SolverRun> {
  const result = await model.generateJson({
    system: SYSTEM,
    prompt: buildSolverBrief(c, mode),
    schema: z.toJSONSchema(SolverAnswerSchema),
    maxOutputTokens: 16_000,
    temperature: 0.7,
    signal,
  });
  const answer = SolverAnswerSchema.parse(JSON.parse(result.text));
  return scoreSolverAnswer(c, mode, answer);
}

/** Pure: compares the solver's answer with the real solution. */
export function scoreSolverAnswer(c: CaseDraft, mode: SolverMode, answer: SolverAnswer): SolverRun {
  const { solution } = c.secret;
  const total = answer.suspects.reduce((sum, s) => sum + s.probability, 0) || 1;
  const ranked = answer.suspects
    .map((s) => ({ suspectId: s.suspectId, probability: s.probability / total }))
    .sort((a, b) => b.probability - a.probability);

  const killerProbability = ranked.find((s) => s.suspectId === solution.killerId)?.probability ?? 0;
  const runnerUp = ranked.find((s) => s.suspectId !== solution.killerId) ?? null;
  const correctKiller = answer.killerId === solution.killerId;

  return {
    mode,
    answer,
    killerProbability,
    runnerUp,
    correctKiller,
    correctMotive: answer.motiveId === solution.motiveId,
    correctKeyEvidence: solution.keyEvidenceIds.includes(answer.keyEvidenceId),
    passed:
      correctKiller &&
      killerProbability >= MIN_KILLER_PROBABILITY &&
      killerProbability - (runnerUp?.probability ?? 0) >= MIN_MARGIN,
  };
}
