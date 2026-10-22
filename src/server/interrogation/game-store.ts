import "server-only";

import { z } from "zod";
import { LOCALES, type Locale } from "@/lib/case/schema";
import {
  GameResultSchema,
  QUESTION_LIMIT,
  type CaseStats,
  type Exchange,
  type GameResult,
} from "@/lib/game/rules";
import { createSupabaseAdminClient } from "@/server/supabase";

/*
 * Server-side game state in Supabase: question counter, conversation, hints
 * and result. Every state change goes through a Postgres function (see
 * supabase/migrations) that checks and updates in one statement, so parallel
 * requests can't both pass a check. Only the service role may call them.
 */

export type GameProgress = {
  questionsUsed: number;
  exchanges: Exchange[];
  hintsUsed: number;
  result: GameResult | null;
};

type Failure<E extends string> = { ok: false; error: E };

export type ReserveResult =
  { ok: true; questionsUsed: number } | Failure<"limit_reached" | "busy" | "game_over">;
export type HintResult = { ok: true; hintsUsed: number } | Failure<"no_hints_left" | "game_over">;
export type FinishResult = { ok: true; result: GameResult } | Failure<"busy" | "game_over">;

export interface GameStore {
  /** The player's game for a case, if they have started one. */
  findGame(playerId: string, caseNumber: number): Promise<string | null>;
  /** Like findGame, but starts the game on first use. Null if the case doesn't exist. */
  openGame(playerId: string, caseNumber: number): Promise<string | null>;
  progress(gameId: string): Promise<GameProgress>;
  /** Atomically checks the limit and counts the question before the AI is called. */
  reserveQuestion(gameId: string): Promise<ReserveResult>;
  /** Gives the question back when the AI produced no answer. */
  refundQuestion(gameId: string): Promise<void>;
  completeQuestion(gameId: string, exchange: Exchange): Promise<void>;
  /** Latest exchanges with one suspect in one language (mixed-language history makes the model switch language). */
  recentExchanges(
    gameId: string,
    suspectId: string,
    locale: Locale,
    limit: number,
  ): Promise<Exchange[]>;
  /** Unlocks the next hint, if the case has one left. */
  revealHint(gameId: string, available: number): Promise<HintResult>;
  /** Records the single accusation. `decide` turns the final counters into the result. */
  finishGame(
    gameId: string,
    decide: (counters: { questionsUsed: number; hintsUsed: number }) => GameResult,
  ): Promise<FinishResult>;
  /** Totals across all finished games of a case (for the result screen). */
  caseStats(caseNumber: number): Promise<CaseStats>;
}

// What the counter functions return (validated: the database is outside our type system).
const CounterRowsSchema = z.array(z.object({ used: z.number(), error: z.string().nullable() }));
const StatsRowsSchema = z.array(
  z.object({ finished: z.number(), solved: z.number(), average_score: z.number() }),
);
const MessageRowSchema = z.object({
  suspect_id: z.string(),
  question: z.string(),
  answer: z.string(),
  locale: z.enum(LOCALES),
  shown_evidence_id: z.string().nullable(),
});

function fail(context: string, message: string): never {
  throw new Error(`gameStore.${context}: ${message}`);
}

function toExchange(row: unknown): Exchange {
  const m = MessageRowSchema.parse(row);
  return {
    suspectId: m.suspect_id,
    question: m.question,
    answer: m.answer,
    locale: m.locale,
    evidenceId: m.shown_evidence_id,
  };
}

export const gameStore: GameStore = {
  async findGame(playerId, caseNumber) {
    const { data, error } = await createSupabaseAdminClient()
      .from("games")
      .select("id, cases!inner(case_number)")
      .eq("player_id", playerId)
      .eq("cases.case_number", caseNumber)
      .maybeSingle();
    if (error) fail("findGame", error.message);
    return data?.id ?? null;
  },

  async openGame(playerId, caseNumber) {
    const { data, error } = await createSupabaseAdminClient().rpc("start_game", {
      p_player_id: playerId,
      p_case_number: caseNumber,
    });
    if (error) fail("openGame", error.message);
    return data ?? null;
  },

  async progress(gameId) {
    const db = createSupabaseAdminClient();
    const [game, messages] = await Promise.all([
      db.from("games").select("questions_used, hints_used, result").eq("id", gameId).single(),
      db
        .from("messages")
        .select("suspect_id, question, answer, locale, shown_evidence_id")
        .eq("game_id", gameId)
        .order("id"),
    ]);
    if (game.error) fail("progress", game.error.message);
    if (messages.error) fail("progress", messages.error.message);
    return {
      questionsUsed: game.data.questions_used,
      hintsUsed: game.data.hints_used,
      result: game.data.result === null ? null : GameResultSchema.parse(game.data.result),
      exchanges: messages.data.map(toExchange),
    };
  },

  async reserveQuestion(gameId) {
    const { data, error } = await createSupabaseAdminClient().rpc("reserve_question", {
      p_game_id: gameId,
      p_limit: QUESTION_LIMIT,
    });
    if (error) fail("reserveQuestion", error.message);
    const [row] = CounterRowsSchema.parse(data);
    if (!row) fail("reserveQuestion", "no result");
    if (row.error === null) return { ok: true, questionsUsed: row.used };
    if (row.error === "limit_reached" || row.error === "busy")
      return { ok: false, error: row.error };
    return { ok: false, error: "game_over" };
  },

  async refundQuestion(gameId) {
    const { error } = await createSupabaseAdminClient().rpc("refund_question", {
      p_game_id: gameId,
    });
    if (error) fail("refundQuestion", error.message);
  },

  async completeQuestion(gameId, exchange) {
    const { error } = await createSupabaseAdminClient().rpc("complete_question", {
      p_game_id: gameId,
      p_suspect_id: exchange.suspectId,
      p_question: exchange.question,
      p_answer: exchange.answer,
      p_locale: exchange.locale,
      p_shown_evidence_id: exchange.evidenceId ?? undefined,
    });
    if (error) fail("completeQuestion", error.message);
  },

  async recentExchanges(gameId, suspectId, locale, limit) {
    const { data, error } = await createSupabaseAdminClient()
      .from("messages")
      .select("suspect_id, question, answer, locale, shown_evidence_id")
      .eq("game_id", gameId)
      .eq("suspect_id", suspectId)
      .eq("locale", locale)
      .order("id", { ascending: false })
      .limit(limit);
    if (error) fail("recentExchanges", error.message);
    return data.map(toExchange).reverse();
  },

  async revealHint(gameId, available) {
    const { data, error } = await createSupabaseAdminClient().rpc("reveal_hint", {
      p_game_id: gameId,
      p_available: available,
    });
    if (error) fail("revealHint", error.message);
    const [row] = CounterRowsSchema.parse(data);
    if (!row) fail("revealHint", "no result");
    if (row.error === null) return { ok: true, hintsUsed: row.used };
    if (row.error === "no_hints_left") return { ok: false, error: "no_hints_left" };
    return { ok: false, error: "game_over" };
  },

  async finishGame(gameId, decide) {
    const db = createSupabaseAdminClient();
    const { data: game, error } = await db
      .from("games")
      .select("questions_used, hints_used, status")
      .eq("id", gameId)
      .single();
    if (error) fail("finishGame", error.message);
    if (game.status !== "playing") return { ok: false, error: "game_over" };

    const result = decide({ questionsUsed: game.questions_used, hintsUsed: game.hints_used });
    // The function only accepts it if the counters are still the ones we scored.
    const { data: failure, error: rpcError } = await db.rpc("finish_game", {
      p_game_id: gameId,
      p_expected_questions: game.questions_used,
      p_expected_hints: game.hints_used,
      p_accusation: result.accusation,
      p_result: result,
      p_score: result.score.total,
      p_solved: result.correct.killer,
    });
    if (rpcError) fail("finishGame", rpcError.message);
    if (failure === null) return { ok: true, result };
    return { ok: false, error: failure === "busy" ? "busy" : "game_over" };
  },

  async caseStats(caseNumber) {
    const { data, error } = await createSupabaseAdminClient().rpc("case_stats", {
      p_case_number: caseNumber,
    });
    if (error) fail("caseStats", error.message);
    const row = StatsRowsSchema.parse(data)[0];
    return {
      finished: row?.finished ?? 0,
      solved: row?.solved ?? 0,
      averageScore: row?.average_score ?? 0,
    };
  },
};
