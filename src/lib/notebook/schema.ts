import { z } from "zod";

/*
 * The player's notebook: free-text notes plus pinned statements, answers and
 * evidence. It only ever holds public case text and the player's own answers,
 * never case secrets.
 */

export const NOTE_MAX_LENGTH = 5000;
const MAX_PINS = 200;

const Id = z.string().min(1).max(64);
const pinnedAt = z.number().int().nonnegative();

export const PinnedItemSchema = z.discriminatedUnion("kind", [
  /** Statements and evidence are stored by id, so they show in the current language. */
  z.strictObject({ kind: z.literal("statement"), suspectId: Id, pinnedAt }),
  z.strictObject({ kind: z.literal("evidence"), evidenceId: Id, pinnedAt }),
  /**
   * Answers keep a copy of their text. `exchangeIndex` is the answer's position
   * in the game's conversation, which only ever grows, so it is a stable key.
   */
  z.strictObject({
    kind: z.literal("answer"),
    exchangeIndex: z.number().int().nonnegative(),
    suspectId: Id,
    question: z.string().max(1000),
    answer: z.string().max(4000),
    pinnedAt,
  }),
]);
export type PinnedItem = z.infer<typeof PinnedItemSchema>;

type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
/** What a pin button describes; `pinnedAt` is added when it is pinned. */
export type PinTarget = DistributiveOmit<PinnedItem, "pinnedAt">;

export const NotebookSchema = z.strictObject({
  text: z.string().max(NOTE_MAX_LENGTH),
  pins: z.array(PinnedItemSchema).max(MAX_PINS),
});
export type Notebook = z.infer<typeof NotebookSchema>;

export const EMPTY_NOTEBOOK: Notebook = Object.freeze({ text: "", pins: [] }) as Notebook;

/** One key per pinnable thing, used to tell whether it is already pinned. */
export function pinKey(target: PinTarget): string {
  switch (target.kind) {
    case "statement":
      return `statement:${target.suspectId}`;
    case "evidence":
      return `evidence:${target.evidenceId}`;
    case "answer":
      return `answer:${target.exchangeIndex}`;
  }
}

export function togglePinIn(notebook: Notebook, target: PinTarget, now: number): Notebook {
  const key = pinKey(target);
  if (notebook.pins.some((p) => pinKey(p) === key)) {
    return { ...notebook, pins: notebook.pins.filter((p) => pinKey(p) !== key) };
  }
  if (notebook.pins.length >= MAX_PINS) return notebook;
  return { ...notebook, pins: [...notebook.pins, { ...target, pinnedAt: now }] };
}
