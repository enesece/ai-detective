import { z } from "zod";
import { LOCALES, type Locale, type LocalizedText } from "@/lib/case/schema";

/** Game rules shared by the server (enforces them) and the client (displays them). */
export const QUESTION_LIMIT = 20;
export const MAX_QUESTION_LENGTH = 280;
/** Earlier exchanges sent to the model with each question, per suspect. */
export const HISTORY_EXCHANGES = 4;

const CaseNumber = z.number().int().positive();
const Id = z.string().min(1).max(64);

export const InterrogateRequestSchema = z.strictObject({
  caseNumber: CaseNumber,
  suspectId: Id,
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  locale: z.enum(LOCALES),
});
export type InterrogateRequest = z.infer<typeof InterrogateRequestSchema>;

export const HintRequestSchema = z.strictObject({ caseNumber: CaseNumber });
export type HintRequest = z.infer<typeof HintRequestSchema>;

export const AccuseRequestSchema = z.strictObject({
  caseNumber: CaseNumber,
  killerId: Id,
  motiveId: Id,
  evidenceId: Id,
});
export type AccuseRequest = z.infer<typeof AccuseRequestSchema>;
export type Accusation = Omit<AccuseRequest, "caseNumber">;

/** One question and answer. `locale` is the language the answer was given in. */
export type Exchange = { suspectId: string; question: string; answer: string; locale: Locale };

export type ScoreBreakdown = {
  killer: number;
  motive: number;
  evidence: number;
  unusedQuestions: number;
  hintPenalty: number;
  total: number;
};

/**
 * Sent to the player only after their one accusation. From then on the game is
 * over for them, so revealing the solution is safe.
 */
export type GameResult = {
  accusation: Accusation;
  correct: { killer: boolean; motive: boolean; evidence: boolean };
  questionsUsed: number;
  hintsUsed: number;
  score: ScoreBreakdown;
  solution: {
    killerId: string;
    motiveId: string;
    keyEvidenceIds: string[];
    method: LocalizedText;
    trueStory: LocalizedText;
    evidenceExplanations: { evidenceId: string; explanation: LocalizedText }[];
  };
};

/** What GET /api/game/[caseNumber] returns: only the player's own progress. */
export type GameSnapshot = {
  questionsUsed: number;
  questionLimit: number;
  exchanges: Exchange[];
  hintsUsed: number;
  hintLimit: number;
  /** Only the hints already unlocked; the rest stay on the server. */
  revealedHints: LocalizedText[];
  result: GameResult | null;
};

export type HintResponse = Pick<GameSnapshot, "hintsUsed" | "hintLimit" | "revealedHints">;
export type AccuseResponse = { result: GameResult };

export const GAME_ERRORS = [
  "invalid_request",
  "case_not_found",
  "suspect_not_found",
  "limit_reached",
  "busy",
  "ai_unavailable",
  "rate_limited",
  "game_over",
  "no_hints_left",
] as const;
export type GameError = (typeof GAME_ERRORS)[number];

/** Response header carrying the server's count after this question. */
export const QUESTIONS_USED_HEADER = "X-Questions-Used";
