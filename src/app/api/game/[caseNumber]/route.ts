import { getCaseSecret } from "@/server/cases/repository";
import { jsonResponse } from "@/server/http";
import { gameStore } from "@/server/interrogation/game-store";
import { EMPTY_PROGRESS, toSnapshot } from "@/server/interrogation/snapshot";
import { getPlayerId } from "@/server/player";

/** GET /api/game/[caseNumber]: the player's own progress, for page reloads. Never creates a game. */
export async function GET(_request: Request, ctx: RouteContext<"/api/game/[caseNumber]">) {
  const { caseNumber: raw } = await ctx.params;
  const caseNumber = Number(raw);
  const secret = Number.isInteger(caseNumber) ? await getCaseSecret(caseNumber) : null;
  const playerId = await getPlayerId();
  const gameId = playerId && secret ? await gameStore.findGame(playerId, caseNumber) : null;

  const progress = gameId ? await gameStore.progress(gameId) : EMPTY_PROGRESS;
  // Stats are a nice extra: if they fail to load, the result screen still works.
  const stats = progress.result ? await gameStore.caseStats(caseNumber).catch(() => null) : null;
  return jsonResponse(toSnapshot(progress, secret, stats));
}
