import { createSupabaseAdminClient, createSupabaseServerClient } from "@/server/supabase";

/**
 * DELETE /api/player: the player deletes their own anonymous account. Their
 * profile, games, messages and notes go with it (foreign keys cascade).
 * Only anonymous accounts: an admin can't remove themselves by accident.
 */
export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getClaims();
  const playerId = typeof data?.claims.sub === "string" ? data.claims.sub : null;
  if (error || !playerId) return status(401, "unauthenticated");
  if (data?.claims.is_anonymous !== true) return status(403, "not_anonymous");

  const { error: deleteError } = await createSupabaseAdminClient().auth.admin.deleteUser(playerId);
  if (deleteError) return status(500, "delete_failed");
  return status(200, null);
}

function status(code: number, error: string | null): Response {
  return Response.json(error ? { error } : { deleted: true }, {
    status: code,
    headers: { "Cache-Control": "no-store" },
  });
}
