import "server-only";

import type { ChatModel, ChatRequest } from "./types";

/**
 * Dev-only stand-in used when no API key is set, so the UI, counter and
 * streaming can be tested offline and for free.
 */
export function createMockModel(): ChatModel {
  return {
    id: "mock",
    async *streamChat(request: ChatRequest) {
      const reply = `(Mock suspect, no GEMINI_API_KEY set.) You asked: "${request.message}". I'd rather not say, detective. I was nowhere near the study, I assure you.`;
      for (const word of reply.split(" ")) {
        if (request.signal?.aborted) return;
        await new Promise((resolve) => setTimeout(resolve, 40));
        yield `${word} `;
      }
    },
  };
}
