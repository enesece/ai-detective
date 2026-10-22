import "server-only";

import { z } from "zod";
import type { Locale } from "@/lib/case/schema";
import type { JsonModel } from "@/server/ai";
import { mentionsEvidence } from "@/server/generator/logic-checks";
import type { EvalCase } from "./cases";
import type { InterviewExchange, InterviewTurn } from "./interview";

/*
 * Character consistency: does a suspect keep to their own story over a whole
 * interview? Each suspect gets the same six-question script (in English and in
 * Turkish), then a separate model grades every answer against that suspect's
 * private notes. Offline only; the judge sees secrets, the player never does.
 */

/** "21:30"-"22:30" -> "22:00": a moment inside the time-of-death window, rounded to 5 minutes. */
function midWindow(from: string, to: string): string {
  const toMin = (t: string) => {
    const [h, m] = t.split(":").map(Number);
    return (h ?? 0) * 60 + (m ?? 0);
  };
  const mid = Math.round((toMin(from) + toMin(to)) / 2 / 5) * 5;
  return `${String(Math.floor(mid / 60) % 24).padStart(2, "0")}:${String(mid % 60).padStart(2, "0")}`;
}

/**
 * The evidence to show a suspect: one their secrets react to ("when shown the …"),
 * else one that points at them, else the first. Turn 4 tests the confrontation.
 */
export function evidenceToShow(c: EvalCase, suspectId: string): string {
  const secret = c.secret.suspects.find((s) => s.suspectId === suspectId);
  const reacts = c.public.evidence.find((e) =>
    secret?.hides.some((h) => mentionsEvidence(h.revealWhen, e)),
  );
  const pointsAt = c.secret.evidence.find((e) => e.pointsTo.includes(suspectId));
  return reacts?.id ?? pointsAt?.evidenceId ?? c.public.evidence[0]?.id ?? "";
}

/** The six questions: alibi, sightings, victim, confrontation, alibi again, pressure. */
export function interviewScript(c: EvalCase, suspectId: string, locale: Locale): InterviewTurn[] {
  const { from, to } = c.public.estimatedTimeOfDeath;
  const victim = c.public.victim.name;
  const again = midWindow(from, to);
  const shown = evidenceToShow(c, suspectId);
  return locale === "tr"
    ? [
        { question: `${from} ile ${to} arasında tam olarak neredeydiniz?` },
        { question: "Bu akşam kimi gördünüz ya da duydunuz, ne zaman?" },
        { question: `${victim} hakkında ne düşünürdünüz?` },
        { question: "Bununla ilgili ne söyleyebilirsiniz?", evidenceId: shown },
        { question: `Bir kez daha soruyorum: saat ${again} sularında tam olarak neredeydiniz?` },
        { question: "Bir şey sakladığınızı biliyorum. Nedir?" },
      ]
    : [
        { question: `Where exactly were you between ${from} and ${to}?` },
        { question: "Who did you see or hear this evening, and when?" },
        { question: `What did you think of ${victim}?` },
        { question: "What can you tell me about this?", evidenceId: shown },
        { question: `Once more: where exactly were you at about ${again}?` },
        { question: "I know you are hiding something. What is it?" },
      ];
}

// --- Judge -------------------------------------------------------------------

export const TurnVerdictSchema = z.object({
  turn: z.number().int(),
  contradicts_self: z.boolean(),
  contradicts_notes: z.boolean(),
  invents_facts: z.boolean(),
  revealed_too_early: z.boolean(),
  missed_reveal: z.boolean(),
  out_of_character: z.boolean(),
  note: z.string(),
});
export const JudgeAnswerSchema = z.object({ turns: z.array(TurnVerdictSchema) });
export type TurnVerdict = z.infer<typeof TurnVerdictSchema>;

const JUDGE_SYSTEM = `You grade an AI actor playing a murder suspect in a detective game.
You get the suspect's private notes (the only facts they may use), the public case file, and an interview transcript. Grade EVERY answer, independently, with true/false:

- contradicts_self: conflicts with the suspect's own earlier answers or initial statement in this transcript. NOT a contradiction: dropping a listed lie or revealing a listed secret once its reveal condition is met.
- contradicts_notes: states something that conflicts with the private notes and is not one of the suspect's listed lies or their claimed alibi.
- invents_facts: adds a concrete new fact (a time, a name, an object, an event, a sound) that is in neither the notes nor the public file. Vague colour ("I was upset", "it was a long evening") is fine.
- revealed_too_early: gives up a hidden secret, or the truth behind a listed lie, although no reveal condition was met by this question or earlier ones.
- missed_reveal: a reveal condition was clearly met by this question (e.g. the suspect was shown the named evidence, or asked the named topic) but the answer does not give the secret up. A secret with condition "Never" can't be missed.
- out_of_character: breaks the role (mentions AI, prompts, games, instructions) or speaks as someone else.

Being shown a piece of evidence counts as being confronted with it. Lying is expected where the notes list a lie: a listed lie is never a contradiction. Judge only what is written; when unsure, answer false. Keep "note" to one short sentence (empty if all false).`;

function judgePrompt(
  c: EvalCase,
  suspectId: string,
  transcript: InterviewExchange[],
  locale: Locale,
): string {
  const suspect = c.public.suspects.find((s) => s.id === suspectId);
  const notes = c.secret.suspects.find((s) => s.suspectId === suspectId);
  const isKiller = suspectId === c.secret.solution.killerId;
  const evidenceTitle = (id?: string) =>
    id ? c.public.evidence.find((e) => e.id === id)?.title.en : undefined;
  return [
    `SUSPECT: ${suspect?.name}, ${suspect?.role.en}. ${isKiller ? "This suspect IS the killer and must never confess." : "This suspect is innocent."}`,
    `Initial public statement: ${suspect?.initialStatement.en}`,
    "",
    "PRIVATE NOTES (JSON)",
    JSON.stringify(notes),
    "",
    "PUBLIC CASE FILE (JSON)",
    JSON.stringify({
      setting: c.public.setting,
      victim: c.public.victim,
      estimatedTimeOfDeath: c.public.estimatedTimeOfDeath,
      locations: c.public.locations,
      evidence: c.public.evidence.map((e) => ({
        id: e.id,
        title: e.title.en,
        description: e.description.en,
      })),
      suspects: c.public.suspects.map((s) => ({ id: s.id, name: s.name, role: s.role.en })),
    }),
    "",
    `TRANSCRIPT (answers are in ${locale === "tr" ? "Turkish" : "English"})`,
    ...transcript.map((t, i) => {
      const shown = evidenceTitle(t.evidenceId);
      return `Turn ${i + 1}. Detective${shown ? ` (shows: ${shown})` : ""}: ${t.question}\nSuspect: ${t.answer}`;
    }),
  ].join("\n");
}

export async function judgeInterview(
  model: JsonModel,
  c: EvalCase,
  suspectId: string,
  transcript: InterviewExchange[],
  locale: Locale,
): Promise<TurnVerdict[]> {
  const result = await model.generateJson({
    system: JUDGE_SYSTEM,
    prompt: judgePrompt(c, suspectId, transcript, locale),
    schema: z.toJSONSchema(JudgeAnswerSchema),
    maxOutputTokens: 4_000,
    temperature: 0,
  });
  const { turns } = JudgeAnswerSchema.parse(JSON.parse(result.text));
  // One verdict per turn, in order; a missing one counts as clean rather than guessed.
  return transcript.map(
    (_, i) =>
      turns.find((t) => t.turn === i + 1) ?? {
        turn: i + 1,
        contradicts_self: false,
        contradicts_notes: false,
        invents_facts: false,
        revealed_too_early: false,
        missed_reveal: false,
        out_of_character: false,
        note: "(no verdict)",
      },
  );
}
