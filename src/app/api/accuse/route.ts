import { AccuseRequestSchema, type AccuseResponse, type GameResult } from "@/lib/game/rules";
import { scoreAccusation } from "@/lib/game/scoring";
import { getCaseSecret, getPublicCase } from "@/server/cases/repository";
import { errorResponse, jsonResponse } from "@/server/http";
import { gameKey, gameStore } from "@/server/interrogation/game-store";
import { getOrCreateSessionId } from "@/server/interrogation/session";

/*
 * POST /api/accuse   Body: { caseNumber, killerId, motiveId, evidenceId }
 * The player's one accusation. Allowed at any time (not only after 20
 * questions). The server checks it against the secret solution, scores it and
 * ends the game; only then does the solution leave the server.
 */
export async function POST(request: Request): Promise<Response> {
  const parsed = AccuseRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_request", 400);
  const { caseNumber, ...accusation } = parsed.data;

  const publicCase = getPublicCase(caseNumber);
  const secret = getCaseSecret(caseNumber);
  if (!publicCase || !secret) return errorResponse("case_not_found", 404);

  // Every pick must be one of the options the player was shown.
  const { briefing } = publicCase;
  const valid =
    briefing.suspects.some((s) => s.id === accusation.killerId) &&
    briefing.motiveOptions.some((m) => m.id === accusation.motiveId) &&
    briefing.evidence.some((e) => e.id === accusation.evidenceId);
  if (!valid) return errorResponse("invalid_request", 400);

  const { solution } = secret;
  const correct = {
    killer: accusation.killerId === solution.killerId,
    motive: accusation.motiveId === solution.motiveId,
    evidence: solution.keyEvidenceIds.includes(accusation.evidenceId),
  };

  const key = gameKey(await getOrCreateSessionId(), caseNumber);
  const finished = await gameStore.finishGame(key, ({ questionsUsed, hintsUsed }): GameResult => ({
    accusation,
    correct,
    questionsUsed,
    hintsUsed,
    score: scoreAccusation({
      killerCorrect: correct.killer,
      motiveCorrect: correct.motive,
      evidenceCorrect: correct.evidence,
      questionsUsed,
      hintsUsed,
    }),
    solution: {
      killerId: solution.killerId,
      motiveId: solution.motiveId,
      keyEvidenceIds: solution.keyEvidenceIds,
      method: solution.method,
      trueStory: solution.trueStory,
      evidenceExplanations: secret.evidence.map((e) => ({
        evidenceId: e.evidenceId,
        explanation: e.explanation,
      })),
    },
  }));
  if (!finished.ok) return errorResponse(finished.error, 409);

  const body: AccuseResponse = { result: finished.result };
  return jsonResponse(body);
}
