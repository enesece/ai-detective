import { QUESTION_LIMIT, type ScoreBreakdown } from "./rules";

/** Points per part of the accusation. Shared so the UI can show the same numbers. */
export const SCORING = {
  killer: 100,
  motive: 30,
  evidence: 20,
  perUnusedQuestion: 5,
  perHint: 15,
} as const;

export type ScoreInput = {
  killerCorrect: boolean;
  motiveCorrect: boolean;
  evidenceCorrect: boolean;
  questionsUsed: number;
  hintsUsed: number;
};

/**
 * The right killer earns the base score; motive and key evidence are bonuses;
 * every unused question adds points and every hint costs some.
 * Naming the wrong killer means the case is unsolved: 0 points.
 */
export function scoreAccusation(input: ScoreInput): ScoreBreakdown {
  if (!input.killerCorrect) {
    return { killer: 0, motive: 0, evidence: 0, unusedQuestions: 0, hintPenalty: 0, total: 0 };
  }
  const unused = Math.max(0, QUESTION_LIMIT - input.questionsUsed);
  const parts = {
    killer: SCORING.killer,
    motive: input.motiveCorrect ? SCORING.motive : 0,
    evidence: input.evidenceCorrect ? SCORING.evidence : 0,
    unusedQuestions: unused * SCORING.perUnusedQuestion,
    hintPenalty: -input.hintsUsed * SCORING.perHint,
  };
  const sum = Object.values(parts).reduce((a, b) => a + b, 0);
  return { ...parts, total: Math.max(0, sum) };
}
