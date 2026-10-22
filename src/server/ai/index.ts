import "server-only";

import { getAiEnv } from "@/server/env";
import { createGeminiJsonModel, createGeminiModel } from "./gemini";
import { createMockModel } from "./mock";
import type { ChatModel, JsonModel } from "./types";

export type { ChatModel, ChatTurn, JsonModel, JsonSchema } from "./types";
export { ChatModelError } from "./types";
export { withRetry } from "./retry";

/** The one place that decides which model the app talks to. */
export function getChatModel(): ChatModel {
  const env = getAiEnv();
  if (env.GEMINI_API_KEY) return createGeminiModel(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  if (process.env.NODE_ENV !== "production") return createMockModel();
  throw new Error("GEMINI_API_KEY is not set");
}

/** Model that writes new cases (offline). */
export function getGeneratorModel(): JsonModel {
  const env = getAiEnv();
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return createGeminiJsonModel(env.GEMINI_API_KEY, env.GEMINI_GENERATOR_MODEL);
}

/** Model that tries to solve a generated case without seeing the solution. */
export function getSolverModel(): JsonModel {
  const env = getAiEnv();
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return createGeminiJsonModel(env.GEMINI_API_KEY, env.GEMINI_SOLVER_MODEL);
}

/** Model that grades suspects' answers in the offline consistency eval. */
export function getJudgeModel(): JsonModel {
  const env = getAiEnv();
  if (!env.GEMINI_API_KEY) throw new Error("GEMINI_API_KEY is not set");
  return createGeminiJsonModel(env.GEMINI_API_KEY, env.EVAL_JUDGE_MODEL ?? env.GEMINI_SOLVER_MODEL);
}
