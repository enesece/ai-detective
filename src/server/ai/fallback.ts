import "server-only";

import { ChatModelError, type ChatModel, type ChatRequest } from "./types";

const BUSY_RETRY_MS = 1500;

/**
 * How long the primary model gets to send its first words. Overloaded models
 * can take 20-30 s (or end with a 503); the player shouldn't wait that long
 * when the fallback is usually answering within a few seconds.
 */
const PRIMARY_FIRST_CHUNK_MS = 10_000;

/** Errors that say "this model can't answer right now", not "the request is wrong". */
function isUnavailable(error: unknown): boolean {
  return error instanceof ChatModelError && (error.status === 429 || (error.status ?? 0) >= 500);
}

/**
 * Tries `primary`; if it is out of quota (429), overloaded (5xx) or too slow
 * to start, before saying anything, the same request goes to `fallback`,
 * which has its own free-tier quota. Once a chunk has been sent, errors pass
 * through as they are (the player has already seen part of one answer). The
 * id names the primary model.
 */
export function withFallback(primary: ChatModel, fallback: ChatModel): ChatModel {
  return {
    id: primary.id,
    async *streamChat(request) {
      // Our own abort for the primary call, so a slow start can be cut off
      // without cancelling the player's request.
      const controller = new AbortController();
      const onPlayerAbort = () => controller.abort();
      request.signal?.addEventListener("abort", onPlayerAbort, { once: true });
      let timedOut = false;
      const timer = setTimeout(() => {
        timedOut = true;
        controller.abort();
      }, PRIMARY_FIRST_CHUNK_MS);

      let started = false;
      try {
        for await (const chunk of primary.streamChat({ ...request, signal: controller.signal })) {
          if (!started) clearTimeout(timer);
          started = true;
          yield chunk;
        }
      } catch (error) {
        if (started || request.signal?.aborted || !(timedOut || isUnavailable(error))) throw error;
        const reason = timedOut ? "too slow" : `unavailable (${(error as ChatModelError).status})`;
        console.warn(`[ai] ${primary.id} is ${reason}; answering with ${fallback.id}`);
        yield* busyRetry(fallback, request);
      } finally {
        clearTimeout(timer);
        request.signal?.removeEventListener("abort", onPlayerAbort);
      }
    },
  };
}

/** Models are often briefly "busy" (503): one short wait and a second try. */
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
