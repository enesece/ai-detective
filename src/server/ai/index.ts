import "server-only";

import { getAiEnv } from "@/server/env";
import { withFallback } from "./fallback";
import { createGeminiJsonModel, createGeminiModel } from "./gemini";
import { createMockModel } from "./mock";
import type { ChatModel, JsonModel } from "./types";

export type { ChatModel, ChatTurn, JsonModel, JsonSchema } from "./types";
export { ChatModelError } from "./types";
export { withRetry } from "./retry";

/** The one place that decides which model the app talks to. */
export function getChatModel(): ChatModel {
  const env = getAiEnv();
  if (env.GEMINI_API_KEY) {
    const primary = createGeminiModel(env.GEMINI_API_KEY, env.GEMINI_MODEL);
    // Free-tier quotas are per model: a second one keeps the suspects talking
    // when the first runs out for the day.
    return env.GEMINI_FALLBACK_MODEL && env.GEMINI_FALLBACK_MODEL !== env.GEMINI_MODEL
      ? withFallback(primary, createGeminiModel(env.GEMINI_API_KEY, env.GEMINI_FALLBACK_MODEL))
      : primary;
  }
  if (process.env.NODE_ENV !== "production") return createMockModel();
  throw new Error("GEMINI_API_KEY is not set");
}

/*
 * Offline work (case generation, the blind solver, evals) uses
 * GEMINI_OFFLINE_API_KEY when it is set: a key from another Google Cloud
 * project, so it has its own free-tier quota and never eats the live game's.
 */
function offlineKey(): string {
  const env = getAiEnv();
  const key = env.GEMINI_OFFLINE_API_KEY ?? env.GEMINI_API_KEY;
  if (!key) throw new Error("GEMINI_API_KEY is not set");
  return key;
}

/** Whether offline work has its own quota (a separate key is configured). */
export function hasOfflineKey(): boolean {
  return getAiEnv().GEMINI_OFFLINE_API_KEY !== undefined;
}

/** Model that writes new cases (offline). */
export function getGeneratorModel(): JsonModel {
  return createGeminiJsonModel(offlineKey(), getAiEnv().GEMINI_GENERATOR_MODEL);
}

/** Model that tries to solve a generated case without seeing the solution. */
export function getSolverModel(): JsonModel {
  return createGeminiJsonModel(offlineKey(), getAiEnv().GEMINI_SOLVER_MODEL);
}

/** Model that grades suspects' answers in the offline consistency eval. */
export function getJudgeModel(): JsonModel {
  const env = getAiEnv();
  return createGeminiJsonModel(offlineKey(), env.EVAL_JUDGE_MODEL ?? env.GEMINI_SOLVER_MODEL);
}

/**
 * The suspects' model for evals: the same model the game uses, on the offline
 * key, and without the fallback (an eval should measure the real model only).
 */
export function getEvalChatModel(): ChatModel {
  return createGeminiModel(offlineKey(), getAiEnv().GEMINI_MODEL);
}
