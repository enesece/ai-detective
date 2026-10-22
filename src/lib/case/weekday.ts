import type { CaseFile } from "./schema";

/*
 * The week gets harder as it goes, like a newspaper crossword:
 * Monday-Tuesday easy, Wednesday-Thursday medium, Friday-Sunday hard.
 */

export type Difficulty = CaseFile["difficulty"];

// Indexed by getUTCDay(): 0 = Sunday.
const BY_WEEKDAY: Difficulty[] = ["hard", "easy", "easy", "medium", "medium", "hard", "hard"];

// When the pool has nothing of the wanted difficulty, the closest one comes next.
const FALLBACK: Record<Difficulty, Difficulty[]> = {
  easy: ["easy", "medium", "hard"],
  medium: ["medium", "hard", "easy"],
  hard: ["hard", "medium", "easy"],
};

/** The difficulty a day (YYYY-MM-DD, UTC) asks for. */
export function difficultyForDay(isoDate: string): Difficulty {
  return BY_WEEKDAY[new Date(`${isoDate}T00:00:00Z`).getUTCDay()] ?? "medium";
}

/**
 * Picks the case for a day from the approved pool: the oldest one of the
 * wanted difficulty, else the oldest of the closest difficulty.
 */
export function pickForDay<T extends { caseNumber: number | null; difficulty: Difficulty }>(
  pool: T[],
  isoDate: string,
): T | undefined {
  const byAge = [...pool].sort((a, b) => (a.caseNumber ?? Infinity) - (b.caseNumber ?? Infinity));
  for (const difficulty of FALLBACK[difficultyForDay(isoDate)]) {
    const match = byAge.find((c) => c.difficulty === difficulty);
    if (match) return match;
  }
  return undefined;
}
