import { getCaseSecret, getPublicCase } from "@/server/cases/repository";
import { ChatModelError, getChatModel, type ChatModel } from "@/server/ai";
import { gameStore } from "@/server/interrogation/game-store";
import { buildSuspectPrompt, formatQuestion } from "@/server/interrogation/prompt";
import { getPlayerId } from "@/server/player";
import {
  HISTORY_EXCHANGES,
  InterrogateRequestSchema,
  QUESTIONS_USED_HEADER,
} from "@/lib/game/rules";
import { errorResponse } from "@/server/http";

/*
 * POST /api/interrogate
 * Body: { caseNumber, suspectId, question, locale }
 * Streams the suspect's answer as plain text. The server loads the case itself
 * and counts the question; the client only sends what the player typed.
 */

const MAX_OUTPUT_TOKENS = 300;
const TEMPERATURE = 0.8;

export async function POST(request: Request): Promise<Response> {
  const parsed = InterrogateRequestSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return errorResponse("invalid_request", 400);
  const { caseNumber, suspectId, question, locale } = parsed.data;

  const publicCase = await getPublicCase(caseNumber);
  const caseSecret = await getCaseSecret(caseNumber);
  if (!publicCase || !caseSecret) return errorResponse("case_not_found", 404);

  const suspect = publicCase.briefing.suspects.find((s) => s.id === suspectId);
  const suspectSecret = caseSecret.suspects.find((s) => s.suspectId === suspectId);
  if (!suspect || !suspectSecret) return errorResponse("suspect_not_found", 404);

  let model: ChatModel;
  try {
    model = getChatModel();
  } catch {
    return errorResponse("ai_unavailable", 503);
  }

  const playerId = await getPlayerId();
  if (!playerId) return errorResponse("unauthenticated", 401);
  const gameId = await gameStore.openGame(playerId, caseNumber);
  if (!gameId) return errorResponse("case_not_found", 404);
  const reservation = await gameStore.reserveQuestion(gameId);
  if (!reservation.ok) {
    return errorResponse(reservation.error, reservation.error === "limit_reached" ? 403 : 409);
  }

  const history = await gameStore.recentExchanges(gameId, suspectId, locale, HISTORY_EXCHANGES);
  const chunks = model
    .streamChat({
      system: buildSuspectPrompt({
        briefing: publicCase.briefing,
        suspect,
        secret: suspectSecret,
        isKiller: caseSecret.solution.killerId === suspectId,
        locale,
      }),
      history: history.flatMap((e) => [
        { role: "user" as const, text: formatQuestion(e.question, locale) },
        { role: "model" as const, text: e.answer },
      ]),
      message: formatQuestion(question, locale),
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      temperature: TEMPERATURE,
      signal: request.signal, // stop paying for tokens if the player leaves
    })
    [Symbol.asyncIterator]();

  // Wait for the first chunk before answering, so an AI failure becomes a
  // proper error response (and a refunded question) instead of a broken stream.
  let first: IteratorResult<string>;
  try {
    first = await chunks.next();
  } catch (error) {
    console.error("[interrogate] model error:", error instanceof Error ? error.message : error);
    await gameStore.refundQuestion(gameId);
    // 429 = the free tier's per-minute limit: tell the player to wait, not that it's broken.
    if (error instanceof ChatModelError && error.status === 429) {
      return errorResponse("rate_limited", 503);
    }
    return errorResponse("ai_unavailable", 502);
  }

  let answer = "";
  let finished = false;
  const finish = async () => {
    if (finished) return;
    finished = true;
    const text = answer.trim();
    if (text)
      await gameStore.completeQuestion(gameId, { suspectId, question, answer: text, locale });
    else await gameStore.refundQuestion(gameId);
  };

  const encoder = new TextEncoder();
  let pending: IteratorResult<string> | null = first;

  const stream = new ReadableStream<Uint8Array>({
    async pull(controller) {
      try {
        const result = pending ?? (await chunks.next());
        pending = null;
        if (result.done) {
          await finish();
          controller.close();
          return;
        }
        answer += result.value;
        controller.enqueue(encoder.encode(result.value));
      } catch (error) {
        await finish();
        controller.error(error);
      }
    },
    async cancel() {
      await chunks.return?.();
      await finish();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      [QUESTIONS_USED_HEADER]: String(reservation.questionsUsed),
    },
  });
}
