import "server-only";

import type { CaseSecret } from "@/lib/case/schema";
import { QUESTION_LIMIT, type GameSnapshot } from "@/lib/game/rules";
import type { GameProgress } from "./game-store";

/** Builds what the player may see: their own progress plus only the hints they unlocked. */
export function toSnapshot(progress: GameProgress, secret: CaseSecret | null): GameSnapshot {
  const hints = secret?.hints ?? [];
  return {
    questionsUsed: progress.questionsUsed,
    questionLimit: QUESTION_LIMIT,
    exchanges: progress.exchanges,
    hintsUsed: progress.hintsUsed,
    hintLimit: hints.length,
    revealedHints: hints.slice(0, progress.hintsUsed),
    result: progress.result,
  };
}

export const EMPTY_PROGRESS: GameProgress = {
  questionsUsed: 0,
  exchanges: [],
  hintsUsed: 0,
  result: null,
};
