"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  EMPTY_NOTEBOOK,
  NOTE_MAX_LENGTH,
  pinKey,
  togglePinIn,
  type PinTarget,
} from "@/lib/notebook/schema";
import { getNotebook, subscribeToNotebook, updateNotebook } from "./notebookStore";

/**
 * The player's notebook for one case. On the server (and during hydration)
 * it is empty; the saved notebook appears right after, with no mismatch.
 */
export function useNotebook(caseNumber: number) {
  const subscribe = useCallback(
    (listener: () => void) => subscribeToNotebook(caseNumber, listener),
    [caseNumber],
  );
  const notebook = useSyncExternalStore(
    subscribe,
    () => getNotebook(caseNumber),
    () => EMPTY_NOTEBOOK,
  );

  const isPinned = useCallback(
    (target: PinTarget) => notebook.pins.some((p) => pinKey(p) === pinKey(target)),
    [notebook],
  );

  const togglePin = useCallback(
    (target: PinTarget) => updateNotebook(caseNumber, (nb) => togglePinIn(nb, target, Date.now())),
    [caseNumber],
  );

  const setText = useCallback(
    (text: string) =>
      updateNotebook(caseNumber, (nb) => ({ ...nb, text: text.slice(0, NOTE_MAX_LENGTH) })),
    [caseNumber],
  );

  return { notebook, isPinned, togglePin, setText };
}
