import "server-only";

import type { Locale } from "@/lib/case/schema";
import { QUESTION_LIMIT, type Exchange, type GameSnapshot } from "@/lib/game/rules";

/*
 * Server-side game state: the question counter and the conversation.
 *
 * Phase 2 keeps it in memory. That is safe from the browser (the client can't
 * touch it) but resets when the server restarts and isn't shared between
 * Vercel instances. Phase 3 replaces this file with a Supabase-backed store
 * implementing the same interface.
 */

export type ReserveResult =
  { ok: true; questionsUsed: number } | { ok: false; error: "limit_reached" | "busy" };

export interface GameStore {
  snapshot(key: string): Promise<GameSnapshot>;
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
}

type GameState = { questionsUsed: number; exchanges: Exchange[]; busy: boolean };

// Survives hot reloads in dev, where modules are re-evaluated.
const globalForStore = globalThis as typeof globalThis & { __gameStates?: Map<string, GameState> };
const games = (globalForStore.__gameStates ??= new Map<string, GameState>());

function stateFor(key: string): GameState {
  let state = games.get(key);
  if (!state) {
    state = { questionsUsed: 0, exchanges: [], busy: false };
    games.set(key, state);
  }
  return state;
}

export function gameKey(sessionId: string, caseNumber: number): string {
  return `${sessionId}:${caseNumber}`;
}

export const gameStore: GameStore = {
  async snapshot(key) {
    const state = games.get(key);
    return {
      questionsUsed: state?.questionsUsed ?? 0,
      questionLimit: QUESTION_LIMIT,
      exchanges: state ? [...state.exchanges] : [],
    };
  },

  async reserveQuestion(key) {
    // No `await` between the check and the update, so two parallel
    // requests can't both pass the check.
    const state = stateFor(key);
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
};
