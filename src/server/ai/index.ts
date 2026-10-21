import "server-only";

import { getAiEnv } from "@/server/env";
import { createGeminiModel } from "./gemini";
import { createMockModel } from "./mock";
import type { ChatModel } from "./types";

export type { ChatModel, ChatTurn } from "./types";
export { ChatModelError } from "./types";

/** The one place that decides which model the app talks to. */
export function getChatModel(): ChatModel {
  const env = getAiEnv();
  if (env.GEMINI_API_KEY) return createGeminiModel(env.GEMINI_API_KEY, env.GEMINI_MODEL);
  if (process.env.NODE_ENV !== "production") return createMockModel();
  throw new Error("GEMINI_API_KEY is not set");
}
