import "server-only";

import { cookies } from "next/headers";

/*
 * Identifies a player's browser until anonymous sign-in arrives in phase 3.
 * httpOnly: page scripts can't read or change it.
 */
const COOKIE_NAME = "dd_session";
const ONE_WEEK_SECONDS = 60 * 60 * 24 * 7;
const SESSION_ID = /^[0-9a-f-]{36}$/;

export async function getSessionId(): Promise<string | null> {
  const value = (await cookies()).get(COOKIE_NAME)?.value;
  return value && SESSION_ID.test(value) ? value : null;
}

/** Only call from Route Handlers or Server Actions: Server Components can't set cookies. */
export async function getOrCreateSessionId(): Promise<string> {
  const existing = await getSessionId();
  if (existing) return existing;

  const id = crypto.randomUUID();
  (await cookies()).set(COOKIE_NAME, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: ONE_WEEK_SECONDS,
  });
  return id;
}
