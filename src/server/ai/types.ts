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
  ) {
    super(message);
    this.name = "ChatModelError";
  }
}
