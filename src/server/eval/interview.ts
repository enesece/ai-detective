import "server-only";

import type { Locale } from "@/lib/case/schema";
import { HISTORY_EXCHANGES } from "@/lib/game/rules";
import type { ChatModel } from "@/server/ai";
import {
  SUSPECT_MAX_OUTPUT_TOKENS,
  SUSPECT_TEMPERATURE,
} from "@/server/interrogation/model-settings";
import { buildSuspectPrompt, formatQuestion } from "@/server/interrogation/prompt";
import type { EvalCase } from "./cases";

export type InterviewTurn = { question: string; evidenceId?: string };
export type InterviewExchange = InterviewTurn & { answer: string };

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Questions one suspect turn by turn exactly as the game does: the same system
 * prompt, settings, shown-evidence wording and history window (the last
 * HISTORY_EXCHANGES exchanges with this suspect in this language).
 * `delayMs` keeps the free tier's per-minute limit happy.
 */
export async function interview(
  model: ChatModel,
  c: EvalCase,
  suspectId: string,
  locale: Locale,
  turns: InterviewTurn[],
  delayMs: number,
): Promise<InterviewExchange[]> {
  const suspect = c.public.suspects.find((s) => s.id === suspectId);
  const secret = c.secret.suspects.find((s) => s.suspectId === suspectId);
  if (!suspect || !secret) throw new Error(`Unknown suspect ${suspectId} in case ${c.caseNumber}`);
  const system = buildSuspectPrompt({
    briefing: c.public,
    suspect,
    secret,
    isKiller: suspectId === c.secret.solution.killerId,
    locale,
  });
  const evidence = (id?: string) => (id ? c.public.evidence.find((e) => e.id === id) : undefined);

  const done: InterviewExchange[] = [];
  for (const turn of turns) {
    const history = done.slice(-HISTORY_EXCHANGES).flatMap((e) => [
      { role: "user" as const, text: formatQuestion(e.question, locale, evidence(e.evidenceId)) },
      { role: "model" as const, text: e.answer },
    ]);
    const answer = await withRetries(async () => {
      let text = "";
      for await (const chunk of model.streamChat({
        system,
        history,
        message: formatQuestion(turn.question, locale, evidence(turn.evidenceId)),
        maxOutputTokens: SUSPECT_MAX_OUTPUT_TOKENS,
        temperature: SUSPECT_TEMPERATURE,
      })) {
        text += chunk;
      }
      return text.trim();
    });
    done.push({ ...turn, answer });
    await sleep(delayMs);
  }
  return done;
}

/** Free-tier hiccups (429/503): wait and try again, a few times. */
async function withRetries<T>(fn: () => Promise<T>): Promise<T> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt >= 4) throw error;
      process.stdout.write(` (retry ${attempt})`);
      await sleep(20_000 * attempt);
    }
  }
}
