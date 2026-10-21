import { createSupabaseBrowserClient } from "./browser";

/*
 * Browser-side identity. Players never see a login screen: the first time
 * they do something that needs a game, they are signed in anonymously.
 * Supabase stores the session in cookies, which the server reads.
 */

let signingIn: Promise<void> | null = null;

async function signInAnonymously(): Promise<void> {
  const { error } = await createSupabaseBrowserClient().auth.signInAnonymously();
  if (error) throw error;
}

/** Makes sure there is a session; signs in anonymously if not. Safe to call often. */
export function ensureSession(): Promise<void> {
  signingIn ??= (async () => {
    const { data } = await createSupabaseBrowserClient().auth.getSession();
    if (!data.session) await signInAnonymously();
  })().finally(() => {
    signingIn = null;
  });
  return signingIn;
}

/**
 * fetch() for the game API. Ensures a session first; if the server still says
 * 401 (e.g. the session was revoked), signs in again once and retries.
 */
export async function gameFetch(input: string, init?: RequestInit): Promise<Response> {
  await ensureSession();
  const response = await fetch(input, init);
  if (response.status !== 401) return response;

  await createSupabaseBrowserClient().auth.signOut({ scope: "local" });
  await signInAnonymously();
  return fetch(input, init);
}
