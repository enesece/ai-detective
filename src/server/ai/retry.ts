import "server-only";

import { ChatModelError } from "./types";

/** Busy or rate-limited: worth waiting and trying again (offline jobs only). */
const RETRYABLE = new Set([429, 500, 503]);
/** Longer waits mean a daily quota is used up: give up instead of waiting hours. */
const MAX_WAIT_MS = 120_000;

/**
 * Retries an offline model call when the provider is busy. Never used for
 * players' questions: they get an error at once instead of a long wait.
 */
export async function withRetry<T>(
  call: () => Promise<T>,
  options: { attempts?: number; delayMs?: number; log?: (message: string) => void } = {},
): Promise<T> {
  const attempts = options.attempts ?? 4;
  const delayMs = options.delayMs ?? 30_000;
  for (let i = 1; ; i++) {
    try {
      return await call();
    } catch (error) {
      if (!(error instanceof ChatModelError) || error.status === undefined) throw error;
      const wait = Math.max(delayMs, error.retryAfterMs ?? 0);
      if (i >= attempts || !RETRYABLE.has(error.status) || wait > MAX_WAIT_MS) throw error;
      options.log?.(`  model busy (${error.status}), retrying in ${Math.round(wait / 1000)}s...`);
      await new Promise((resolve) => setTimeout(resolve, wait));
    }
  }
}
