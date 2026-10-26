import "server-only";

import { ChatModelError, type ChatModel, type ChatRequest } from "./types";

const BUSY_RETRY_MS = 1500;

export type FallbackTiming = {
  /**
   * If the primary model hasn't said anything by then, the fallback starts
   * too, alongside it. The primary keeps running: on busy days it is slow
   * (~20 s) but steady, while the fallback is sometimes instant and sometimes
   * stuck for minutes. Whichever speaks first answers.
   */
  hedgeAfterMs: number;
  /** No words from either model by then: give up, so the question is refunded. */
  giveUpAfterMs: number;
};

const DEFAULT_TIMING: FallbackTiming = { hedgeAfterMs: 5_000, giveUpAfterMs: 50_000 };

/** Errors that say "this model can't answer right now", not "the request is wrong". */
function isUnavailable(error: unknown): boolean {
  return error instanceof ChatModelError && (error.status === 429 || (error.status ?? 0) >= 500);
}

type Racer = {
  model: ChatModel;
  controller: AbortController;
  iterator: AsyncIterator<string>;
  first: Promise<{ racer: Racer; result?: IteratorResult<string>; error?: unknown }>;
  failed: boolean;
};

/**
 * Runs `primary`, and `fallback` (its own free-tier quota) as well when the
 * primary is unavailable (429/5xx) or slow to start. The first model to send a
 * chunk answers; the other is aborted. Once a chunk has been sent, errors pass
 * through as they are (the player has already seen part of one answer). The
 * id names the primary model.
 */
export function withFallback(
  primary: ChatModel,
  fallback: ChatModel,
  timing: FallbackTiming = DEFAULT_TIMING,
): ChatModel {
  const fallbackWithRetry: ChatModel = {
    id: fallback.id,
    streamChat: (r) => busyRetry(fallback, r),
  };

  return {
    id: primary.id,
    async *streamChat(request) {
      const racers: Racer[] = [];
      const abortAll = () => racers.forEach((r) => r.controller.abort());
      request.signal?.addEventListener("abort", abortAll, { once: true });

      const start = (model: ChatModel) => {
        const controller = new AbortController();
        const iterator = model
          .streamChat({ ...request, signal: controller.signal })
          [Symbol.asyncIterator]();
        const racer = { model, controller, iterator, failed: false } as Racer;
        racer.first = iterator.next().then(
          (result) => ({ racer, result }),
          (error: unknown) => ({ racer, error }),
        );
        racers.push(racer);
      };

      const startedAt = Date.now();
      let winner: { racer: Racer; result: IteratorResult<string> } | null = null;
      let lastError: unknown = null;
      try {
        start(primary);
        while (!winner) {
          const hedged = racers.length > 1;
          const running = racers.filter((r) => !r.failed);
          if (running.length === 0) {
            if (hedged) throw lastError;
            start(fallbackWithRetry);
            continue;
          }
          const waitMs =
            (hedged ? timing.giveUpAfterMs : timing.hedgeAfterMs) - (Date.now() - startedAt);
          const outcome = await raceWithTimeout(
            running.map((r) => r.first),
            waitMs,
          );

          if (!outcome) {
            if (hedged) throw new ChatModelError("No model started answering in time", 504);
            console.warn(`[ai] ${primary.id} is slow; asking ${fallback.id} too`);
            start(fallbackWithRetry);
          } else if (outcome.error !== undefined) {
            outcome.racer.failed = true;
            lastError = outcome.error;
            if (request.signal?.aborted || !isUnavailable(outcome.error)) throw outcome.error;
            const status = (outcome.error as ChatModelError).status;
            console.warn(`[ai] ${outcome.racer.model.id} is unavailable (${status})`);
          } else {
            winner = { racer: outcome.racer, result: outcome.result! };
          }
        }

        // The winner answers; the others stop.
        racers.filter((r) => r !== winner!.racer).forEach((r) => r.controller.abort());
        if (winner.racer.model !== primary) console.warn(`[ai] answered by ${fallback.id}`);
        let result = winner.result;
        while (!result.done) {
          yield result.value;
          result = await winner.racer.iterator.next();
        }
      } finally {
        abortAll();
        request.signal?.removeEventListener("abort", abortAll);
      }
    },
  };
}

/** Resolves with the first promise, or null after `ms`. */
async function raceWithTimeout<T>(promises: Promise<T>[], ms: number): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timer = setTimeout(() => resolve(null), Math.max(0, ms));
  });
  try {
    return await Promise.race([...promises, timeout]);
  } finally {
    clearTimeout(timer);
  }
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
