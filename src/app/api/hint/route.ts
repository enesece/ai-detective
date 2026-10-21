import { HintRequestSchema, type HintResponse } from "@/lib/game/rules";
import { getCaseSecret } from "@/server/cases/repository";
import { errorResponse, jsonResponse } from "@/server/http";
import { gameStore } from "@/server/interrogation/game-store";
import { getPlayerId } from "@/server/player";

/*
 * POST /api/hint   Body: { caseNumber }
 * Unlocks the next pre-written hint. No AI call: hints are part of the case.
 * Only unlocked hints are ever sent; the score penalty is applied at accusation.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = HintRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_request", 400);

  const secret = await getCaseSecret(parsed.data.caseNumber);
  if (!secret) return errorResponse("case_not_found", 404);

  const playerId = await getPlayerId();
  if (!playerId) return errorResponse("unauthenticated", 401);
  const gameId = await gameStore.openGame(playerId, parsed.data.caseNumber);
  if (!gameId) return errorResponse("case_not_found", 404);
  const revealed = await gameStore.revealHint(gameId, secret.hints.length);
  if (!revealed.ok) return errorResponse(revealed.error, 409);

  const body: HintResponse = {
    hintsUsed: revealed.hintsUsed,
    hintLimit: secret.hints.length,
    revealedHints: secret.hints.slice(0, revealed.hintsUsed),
  };
  return jsonResponse(body);
}
