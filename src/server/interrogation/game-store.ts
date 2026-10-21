import "server-only";

import type { Locale } from "@/lib/case/schema";
import type { Exchange, GameResult } from "@/lib/game/rules";
import { QUESTION_LIMIT } from "@/lib/game/rules";

/*
 * Server-side game state: question counter, conversation, hints and result.
 *
 * Kept in memory for now. That is safe from the browser (the client can't
 * touch it) but resets when the server restarts and isn't shared between
 * Vercel instances. Phase 3 replaces this file with a Supabase-backed store
 * implementing the same interface.
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
  progress(key: string): Promise<GameProgress>;
  /** Atomically checks the limit and counts the question before the AI is called. */
  reserveQuestion(key: string): Promise<ReserveResult>;
  /** Gives the question back when the AI produced no answer. */
  refundQuestion(key: string): Promise<void>;
  completeQuestion(key: string, exchange: Exchange): Promise<void>;
  /** Latest exchanges with one suspect in one language (mixed-language history makes the model switch language). */
  recentExchanges(
    key: string,
    suspectId: string,
    locale: Locale,
    limit: number,
  ): Promise<Exchange[]>;
  /** Unlocks the next hint, if the case has one left. */
  revealHint(key: string, available: number): Promise<HintResult>;
  /** Records the single accusation. `decide` turns the final progress into the result. */
  finishGame(
    key: string,
    decide: (progress: Omit<GameProgress, "result" | "exchanges">) => GameResult,
  ): Promise<FinishResult>;
}

type GameState = GameProgress & { busy: boolean };

// Survives hot reloads in dev, where modules are re-evaluated.
const globalForStore = globalThis as typeof globalThis & { __gameStates?: Map<string, GameState> };
const games = (globalForStore.__gameStates ??= new Map<string, GameState>());

function stateFor(key: string): GameState {
  let state = games.get(key);
  if (!state) {
    state = { questionsUsed: 0, exchanges: [], hintsUsed: 0, result: null, busy: false };
    games.set(key, state);
  }
  return state;
}

export function gameKey(sessionId: string, caseNumber: number): string {
  return `${sessionId}:${caseNumber}`;
}

// No `await` between a check and its update in these methods, so two parallel
// requests can't both pass the same check.
export const gameStore: GameStore = {
  async progress(key) {
    const state = games.get(key);
    return {
      questionsUsed: state?.questionsUsed ?? 0,
      exchanges: state ? [...state.exchanges] : [],
      hintsUsed: state?.hintsUsed ?? 0,
      result: state?.result ?? null,
    };
  },

  async reserveQuestion(key) {
    const state = stateFor(key);
    if (state.result) return { ok: false, error: "game_over" };
    if (state.busy) return { ok: false, error: "busy" };
    if (state.questionsUsed >= QUESTION_LIMIT) return { ok: false, error: "limit_reached" };
    state.busy = true;
    state.questionsUsed += 1;
    return { ok: true, questionsUsed: state.questionsUsed };
  },

  async refundQuestion(key) {
    const state = stateFor(key);
    state.questionsUsed = Math.max(0, state.questionsUsed - 1);
    state.busy = false;
  },

  async completeQuestion(key, exchange) {
    const state = stateFor(key);
    state.exchanges.push(exchange);
    state.busy = false;
  },

  async recentExchanges(key, suspectId, locale, limit) {
    const state = games.get(key);
    if (!state) return [];
    return state.exchanges
      .filter((e) => e.suspectId === suspectId && e.locale === locale)
      .slice(-limit);
  },

  async revealHint(key, available) {
    const state = stateFor(key);
    if (state.result) return { ok: false, error: "game_over" };
    if (state.hintsUsed >= available) return { ok: false, error: "no_hints_left" };
    state.hintsUsed += 1;
    return { ok: true, hintsUsed: state.hintsUsed };
  },

  async finishGame(key, decide) {
    const state = stateFor(key);
    if (state.result) return { ok: false, error: "game_over" };
    // Don't accept an accusation while an answer is still streaming.
    if (state.busy) return { ok: false, error: "busy" };
    state.result = decide({ questionsUsed: state.questionsUsed, hintsUsed: state.hintsUsed });
    return { ok: true, result: state.result };
  },
};
