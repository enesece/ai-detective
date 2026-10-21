import { QUESTION_LIMIT, type GameSnapshot } from "@/lib/game/rules";
import { gameKey, gameStore } from "@/server/interrogation/game-store";
import { getSessionId } from "@/server/interrogation/session";

/** GET /api/game/[caseNumber]: the player's own counter and conversation, for page reloads. */
export async function GET(_request: Request, ctx: RouteContext<"/api/game/[caseNumber]">) {
  const { caseNumber: raw } = await ctx.params;
  const caseNumber = Number(raw);
  const sessionId = await getSessionId();

  const snapshot: GameSnapshot =
    sessionId && Number.isInteger(caseNumber)
      ? await gameStore.snapshot(gameKey(sessionId, caseNumber))
      : { questionsUsed: 0, questionLimit: QUESTION_LIMIT, exchanges: [] };

  return Response.json(snapshot, { headers: { "Cache-Control": "no-store" } });
}
