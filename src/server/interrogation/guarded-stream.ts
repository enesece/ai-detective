import type { Locale } from "@/lib/case/schema";
import { DEFLECTION, findViolation, STREAM_HOLDBACK, type Violation } from "./answer-guard";

type Options = {
  /** The model's text chunks. `first` was already pulled (to catch early errors). */
  chunks: AsyncIterator<string>;
  first: IteratorResult<string>;
  isKiller: boolean;
  locale: Locale;
  /** Called once with the exact text the player received (empty if nothing was produced). */
  onFinish: (answer: string) => Promise<void>;
  onBlocked?: (violation: Violation) => void;
};

/**
 * Streams the answer while guarding it: text is held back by a few characters
 * and the whole answer so far is checked before anything is sent. On a
 * violation the model is stopped and the unsent rest is replaced with an
 * in-character deflection, so the offending text never reaches the player.
 */
export function createGuardedStream({
  chunks,
  first,
  isKiller,
  locale,
  onFinish,
  onBlocked,
}: Options): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  let pending: IteratorResult<string> | null = first;
  let answer = "";
  let sentLength = 0;
  let finished = false;

  const finish = async () => {
    if (finished) return;
    finished = true;
    await onFinish(answer.trim());
  };

  return new ReadableStream<Uint8Array>({
    // Loops until it has enqueued something or closed: a pull that returns
    // without enqueuing isn't always called again, which would stall the
    // stream while short chunks sit in the holdback.
    async pull(controller) {
      try {
        for (;;) {
          const result = pending ?? (await chunks.next());
          pending = null;

          if (result.done) {
            if (answer.length > sentLength) {
              controller.enqueue(encoder.encode(answer.slice(sentLength)));
            }
            await finish();
            controller.close();
            return;
          }

          const candidate = answer + result.value;
          const violation = findViolation(candidate, { isKiller });
          if (violation) {
            onBlocked?.(violation);
            await chunks.return?.();
            const sent = answer.slice(0, sentLength);
            const replacement = `${sent.trim() ? " " : ""}${DEFLECTION[locale]}`;
            answer = sent + replacement;
            controller.enqueue(encoder.encode(replacement));
            await finish();
            controller.close();
            return;
          }

          answer = candidate;
          const safeEnd = answer.length - STREAM_HOLDBACK;
          if (safeEnd > sentLength) {
            controller.enqueue(encoder.encode(answer.slice(sentLength, safeEnd)));
            sentLength = safeEnd;
            return;
          }
        }
      } catch (error) {
        await finish();
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return?.();
      await finish();
    },
  });
}
