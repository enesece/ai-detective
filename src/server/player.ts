import "server-only";

import { createSupabaseServerClient } from "./supabase";

/**
 * The signed-in player's id (anonymous players included), or null.
 * getClaims verifies the JWT in the auth cookie, so the id can't be forged
 * by editing the cookie.
 */
export async function getPlayerId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;
  return typeof data.claims.sub === "string" ? data.claims.sub : null;
}
