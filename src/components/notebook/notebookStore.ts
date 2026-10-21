import { EMPTY_NOTEBOOK, NotebookSchema, type Notebook } from "@/lib/notebook/schema";

/*
 * Browser-only notebook storage (phase 3 moves it to Supabase).
 *
 * A tiny external store: every component that shows the notebook reads the
 * same cached object and is notified on change, so a pin made in the chat
 * appears in the notebook panel at once.
 */

type Listener = () => void;

const cache = new Map<number, Notebook>();
const listeners = new Map<number, Set<Listener>>();

function storageKey(caseNumber: number): string {
  return `dd:notebook:v1:case-${caseNumber}`;
}

/** localStorage is user-editable, so its content is validated, never trusted. */
function readFromStorage(caseNumber: number): Notebook {
  try {
    const raw = window.localStorage.getItem(storageKey(caseNumber));
    if (!raw) return EMPTY_NOTEBOOK;
    const parsed = NotebookSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : EMPTY_NOTEBOOK;
  } catch {
    return EMPTY_NOTEBOOK; // private mode, blocked storage or broken JSON
  }
}

function notify(caseNumber: number): void {
  listeners.get(caseNumber)?.forEach((listener) => listener());
}

/** Returns the same object until the notebook changes (required by useSyncExternalStore). */
export function getNotebook(caseNumber: number): Notebook {
  let notebook = cache.get(caseNumber);
  if (!notebook) {
    notebook = readFromStorage(caseNumber);
    cache.set(caseNumber, notebook);
  }
  return notebook;
}

export function updateNotebook(caseNumber: number, update: (current: Notebook) => Notebook): void {
  const next = update(getNotebook(caseNumber));
  cache.set(caseNumber, next);
  try {
    window.localStorage.setItem(storageKey(caseNumber), JSON.stringify(next));
  } catch {
    // Storage full or blocked: the notebook still works for this visit.
  }
  notify(caseNumber);
}

export function subscribeToNotebook(caseNumber: number, listener: Listener): () => void {
  const set = listeners.get(caseNumber) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(caseNumber, set);

  // Another tab changed the notebook: drop the cache and re-read.
  const onStorage = (event: StorageEvent) => {
    if (event.key !== storageKey(caseNumber)) return;
    cache.delete(caseNumber);
    listener();
  };
  window.addEventListener("storage", onStorage);

  return () => {
    set.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}
