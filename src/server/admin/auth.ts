import "server-only";

import { z } from "zod";
import { createSupabaseServerClient } from "@/server/supabase";

/*
 * Who is an admin: a signed-in, non-anonymous user whose app_metadata.role is
 * "admin". app_metadata can only be changed with the secret key (set once by
 * SQL), never by the user, so it's safe to trust once getClaims() has verified
 * the token's signature.
 */

const AdminClaimsSchema = z.object({
  sub: z.string(),
  email: z.string().optional(),
  is_anonymous: z.boolean().optional(),
  app_metadata: z.object({ role: z.string().optional() }).loose().optional(),
});

export type Admin = { userId: string; email: string | null };

export async function getAdmin(): Promise<Admin | null> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data) return null;

  const claims = AdminClaimsSchema.safeParse(data.claims);
  if (!claims.success) return null;
  const { sub, email, is_anonymous, app_metadata } = claims.data;
  if (is_anonymous || app_metadata?.role !== "admin") return null;
  return { userId: sub, email: email ?? null };
}

/** For Server Actions: they can be called with a plain POST, so each one checks again. */
export async function requireAdmin(): Promise<Admin> {
  const admin = await getAdmin();
  if (!admin) throw new Error("Not authorized");
  return admin;
}
