/*
 * Provider-neutral chat interface. Everything else in the app talks to this,
 * so swapping Gemini for another model touches only src/server/ai/.
 */
export type ChatTurn = { role: "user" | "model"; text: string };

export type ChatRequest = {
  system: string;
  history: ChatTurn[];
  message: string;
  maxOutputTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

export interface ChatModel {
  readonly id: string;
  /** Yields text chunks as the model produces them. */
  streamChat(request: ChatRequest): AsyncIterable<string>;
}

export class ChatModelError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    /** How long the provider asks us to wait before retrying, if it says. */
    readonly retryAfterMs?: number,
  ) {
    super(message);
    this.name = "ChatModelError";
  }
}

/** A JSON Schema object, e.g. from z.toJSONSchema(). */
export type JsonSchema = Record<string, unknown>;

export type JsonRequest = {
  system: string;
  prompt: string;
  /** The model must answer with JSON matching this schema. */
  schema: JsonSchema;
  maxOutputTokens: number;
  temperature: number;
  signal?: AbortSignal;
};

export type JsonResult = {
  /** Raw JSON text. The caller parses and validates it (with Zod). */
  text: string;
  usage: { inputTokens: number; outputTokens: number; thinkingTokens: number } | null;
};

/** One-shot structured output, for offline jobs (case generation and checking). */
export interface JsonModel {
  readonly id: string;
  generateJson(request: JsonRequest): Promise<JsonResult>;
}
