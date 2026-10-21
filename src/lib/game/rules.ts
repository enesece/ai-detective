import { z } from "zod";
import { LOCALES, type Locale } from "@/lib/case/schema";

/** Game rules shared by the server (enforces them) and the client (displays them). */
export const QUESTION_LIMIT = 20;
export const MAX_QUESTION_LENGTH = 280;
/** Earlier exchanges sent to the model with each question, per suspect. */
export const HISTORY_EXCHANGES = 4;

export const InterrogateRequestSchema = z.strictObject({
  caseNumber: z.number().int().positive(),
  suspectId: z.string().min(1).max(64),
  question: z.string().trim().min(1).max(MAX_QUESTION_LENGTH),
  locale: z.enum(LOCALES),
});
export type InterrogateRequest = z.infer<typeof InterrogateRequestSchema>;

/** One question and answer. `locale` is the language the answer was given in. */
export type Exchange = { suspectId: string; question: string; answer: string; locale: Locale };

/** What GET /api/game/[caseNumber] returns. Contains only the player's own conversation. */
export type GameSnapshot = {
  questionsUsed: number;
  questionLimit: number;
  exchanges: Exchange[];
};

export const INTERROGATE_ERRORS = [
  "invalid_request",
  "case_not_found",
  "suspect_not_found",
  "limit_reached",
  "busy",
  "ai_unavailable",
  "rate_limited",
] as const;
export type InterrogateError = (typeof INTERROGATE_ERRORS)[number];

/** Response header carrying the server's count after this question. */
export const QUESTIONS_USED_HEADER = "X-Questions-Used";
