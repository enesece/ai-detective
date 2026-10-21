import "server-only";

import type { GameError } from "@/lib/game/rules";

/** JSON error body shared by every game API route. */
export function errorResponse(error: GameError, status: number): Response {
  return Response.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export function jsonResponse<T>(body: T): Response {
  return Response.json(body, { headers: { "Cache-Control": "no-store" } });
}
