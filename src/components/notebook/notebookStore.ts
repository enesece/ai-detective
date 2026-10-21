import { EMPTY_NOTEBOOK, NotebookSchema, type Notebook } from "@/lib/notebook/schema";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";
import { ensureSession } from "@/lib/supabase/session";

/*
 * The player's notebook, per case.
 *
 * A tiny external store: every component that shows the notebook reads the
 * same cached object and is notified on change, so a pin made in the chat
 * appears in the notebook panel at once.
 *
 * Storage: Supabase (`notes` table, private to the player through RLS) is the
 * source of truth; localStorage is a fast local copy shown before Supabase
 * answers. Saves to Supabase are debounced.
 */

type Listener = () => void;

const SAVE_DELAY_MS = 600;
const cache = new Map<number, Notebook>();
const listeners = new Map<number, Set<Listener>>();
const remoteRequested = new Set<number>();
/** Cases whose Supabase copy has arrived (or was found missing). */
const remoteLoaded = new Set<number>();
/** Cases edited locally before Supabase answered: local wins and gets pushed. */
const editedBeforeLoad = new Set<number>();
const saveTimers = new Map<number, ReturnType<typeof setTimeout>>();

function storageKey(caseNumber: number): string {
  return `dd:notebook:v1:case-${caseNumber}`;
}

/** Stored data is user-editable, so it is validated, never trusted. */
function parseNotebook(value: unknown): Notebook | null {
  const parsed = NotebookSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

function readLocal(caseNumber: number): Notebook {
  try {
    const raw = window.localStorage.getItem(storageKey(caseNumber));
    return (raw && parseNotebook(JSON.parse(raw))) || EMPTY_NOTEBOOK;
  } catch {
    return EMPTY_NOTEBOOK; // private mode, blocked storage or broken JSON
  }
}

function writeLocal(caseNumber: number, notebook: Notebook): void {
  try {
    window.localStorage.setItem(storageKey(caseNumber), JSON.stringify(notebook));
  } catch {
    // Storage full or blocked: Supabase still has it.
  }
}

function notify(caseNumber: number): void {
  listeners.get(caseNumber)?.forEach((listener) => listener());
}

function isEmpty(notebook: Notebook): boolean {
  return notebook.text === "" && notebook.pins.length === 0;
}

function scheduleRemoteSave(caseNumber: number): void {
  clearTimeout(saveTimers.get(caseNumber));
  saveTimers.set(
    caseNumber,
    setTimeout(async () => {
      const notebook = getNotebook(caseNumber);
      try {
        await ensureSession();
        await createSupabaseBrowserClient()
          .from("notes")
          .upsert(
            { case_number: caseNumber, text: notebook.text, pins: notebook.pins },
            { onConflict: "player_id,case_number" },
          );
      } catch {
        // Offline or signed out: the local copy is kept and saved next time.
      }
    }, SAVE_DELAY_MS),
  );
}

async function loadRemote(caseNumber: number): Promise<void> {
  if (remoteRequested.has(caseNumber)) return;
  remoteRequested.add(caseNumber);
  try {
    await ensureSession();
    const { data, error } = await createSupabaseBrowserClient()
      .from("notes")
      .select("text, pins")
      .eq("case_number", caseNumber)
      .maybeSingle();
    if (error) {
      remoteRequested.delete(caseNumber);
      return;
    }

    const remote = data ? parseNotebook({ text: data.text, pins: data.pins }) : null;
    if (remote && !editedBeforeLoad.has(caseNumber)) {
      cache.set(caseNumber, remote);
      writeLocal(caseNumber, remote);
      notify(caseNumber);
    } else if (!isEmpty(getNotebook(caseNumber))) {
      // First visit with Supabase, or edited meanwhile: push the local copy up.
      scheduleRemoteSave(caseNumber);
    }
    remoteLoaded.add(caseNumber);
  } catch {
    remoteRequested.delete(caseNumber); // try again on the next subscription
  }
}

/** Returns the same object until the notebook changes (required by useSyncExternalStore). */
export function getNotebook(caseNumber: number): Notebook {
  let notebook = cache.get(caseNumber);
  if (!notebook) {
    notebook = readLocal(caseNumber);
    cache.set(caseNumber, notebook);
  }
  return notebook;
}

export function updateNotebook(caseNumber: number, update: (current: Notebook) => Notebook): void {
  const next = update(getNotebook(caseNumber));
  cache.set(caseNumber, next);
  writeLocal(caseNumber, next);
  if (!remoteLoaded.has(caseNumber)) editedBeforeLoad.add(caseNumber);
  notify(caseNumber);
  scheduleRemoteSave(caseNumber);
}

export function subscribeToNotebook(caseNumber: number, listener: Listener): () => void {
  const set = listeners.get(caseNumber) ?? new Set<Listener>();
  set.add(listener);
  listeners.set(caseNumber, set);
  void loadRemote(caseNumber);

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
