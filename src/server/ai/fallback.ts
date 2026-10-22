import "server-only";

import { ChatModelError, type ChatModel, type ChatRequest } from "./types";

const BUSY_RETRY_MS = 1500;

/**
 * Tries `primary`; if it is out of quota (429) before saying anything, the
 * same request goes to `fallback`, which has its own free-tier quota. Once a
 * chunk has been sent, errors pass through as they are (the player has
 * already seen part of one answer). The id names the primary model.
 */
export function withFallback(primary: ChatModel, fallback: ChatModel): ChatModel {
  return {
    id: primary.id,
    async *streamChat(request) {
      let started = false;
      try {
        for await (const chunk of primary.streamChat(request)) {
          started = true;
          yield chunk;
        }
      } catch (error) {
        const outOfQuota = error instanceof ChatModelError && error.status === 429;
        if (started || !outOfQuota || request.signal?.aborted) throw error;
        console.warn(`[ai] ${primary.id} is out of quota; answering with ${fallback.id}`);
        yield* busyRetry(fallback, request);
      }
    },
  };
}

/** Preview-tier models are often briefly "busy" (503): one short wait and a second try. */
async function* busyRetry(model: ChatModel, request: ChatRequest): AsyncGenerator<string> {
  for (let attempt = 1; ; attempt++) {
    let started = false;
    try {
      for await (const chunk of model.streamChat(request)) {
        started = true;
        yield chunk;
      }
      return;
    } catch (error) {
      const busy = error instanceof ChatModelError && error.status === 503;
      if (started || !busy || attempt >= 2 || request.signal?.aborted) throw error;
      await new Promise((r) => setTimeout(r, BUSY_RETRY_MS));
    }
  }
}
