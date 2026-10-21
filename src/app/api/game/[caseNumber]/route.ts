import { getCaseSecret } from "@/server/cases/repository";
import { jsonResponse } from "@/server/http";
import { gameKey, gameStore } from "@/server/interrogation/game-store";
import { getSessionId } from "@/server/interrogation/session";
import { EMPTY_PROGRESS, toSnapshot } from "@/server/interrogation/snapshot";

/** GET /api/game/[caseNumber]: the player's own progress, for page reloads. */
export async function GET(_request: Request, ctx: RouteContext<"/api/game/[caseNumber]">) {
  const { caseNumber: raw } = await ctx.params;
  const caseNumber = Number(raw);
  const secret = Number.isInteger(caseNumber) ? getCaseSecret(caseNumber) : null;
  const sessionId = await getSessionId();

  const progress =
    sessionId && secret ? await gameStore.progress(gameKey(sessionId, caseNumber)) : EMPTY_PROGRESS;

  return jsonResponse(toSnapshot(progress, secret));
}
