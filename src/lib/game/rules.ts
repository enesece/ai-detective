import { z } from "zod";
import { LOCALES, LocalizedTextSchema, type Locale, type LocalizedText } from "@/lib/case/schema";

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
  /** Public evidence the detective puts in front of the suspect with this question. */
  evidenceId: Id.optional(),
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

/**
 * One question and answer. `locale` is the language the answer was given in;
 * `evidenceId` is the evidence shown with the question, if any.
 */
export type Exchange = {
  suspectId: string;
  question: string;
  answer: string;
  locale: Locale;
  evidenceId: string | null;
};

const ScoreBreakdownSchema = z.strictObject({
  killer: z.number(),
  motive: z.number(),
  evidence: z.number(),
  unusedQuestions: z.number(),
  hintPenalty: z.number(),
  total: z.number(),
});
export type ScoreBreakdown = z.infer<typeof ScoreBreakdownSchema>;

/**
 * Sent to the player only after their one accusation. From then on the game is
 * over for them, so revealing the solution is safe. A schema (not just a type)
 * because it is stored in the database and validated when read back.
 */
export const GameResultSchema = z.strictObject({
  accusation: AccuseRequestSchema.omit({ caseNumber: true }),
  correct: z.strictObject({ killer: z.boolean(), motive: z.boolean(), evidence: z.boolean() }),
  questionsUsed: z.number().int().nonnegative(),
  hintsUsed: z.number().int().nonnegative(),
  score: ScoreBreakdownSchema,
  solution: z.strictObject({
    killerId: z.string(),
    motiveId: z.string(),
    keyEvidenceIds: z.array(z.string()),
    method: LocalizedTextSchema,
    trueStory: LocalizedTextSchema,
    evidenceExplanations: z.array(
      z.strictObject({ evidenceId: z.string(), explanation: LocalizedTextSchema }),
    ),
  }),
});
export type GameResult = z.infer<typeof GameResultSchema>;

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
  /** How all players did on this case. Only sent once this player's game is over. */
  stats: CaseStats | null;
};

/** Totals across every finished game of one case; never one player's answers. */
export type CaseStats = { finished: number; solved: number; averageScore: number };

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
  "unauthenticated",
] as const;
export type GameError = (typeof GAME_ERRORS)[number];

/** Response header carrying the server's count after this question. */
export const QUESTIONS_USED_HEADER = "X-Questions-Used";
