import { z } from "zod";

/*
 * The public record of eval runs (eval/results/summary.json), shown on the Lab
 * page. Numbers and short keys only: answers, transcripts and case details stay
 * in the private result files. The strict schema is what keeps it that way,
 * since anything else fails to parse at build time.
 */

const Key = z.string().regex(/^[a-z][a-z0-9_]{0,39}$/);
const Rate = z.number().min(0).max(1);
const Count = z.number().int().nonnegative();
const ModelId = z.string().regex(/^[a-z0-9:._-]{1,60}$/);
const Tally = z.strictObject({ total: Count, passed: Count });

export const InjectionRunSchema = z.strictObject({
  kind: z.literal("injection"),
  date: z.iso.datetime(),
  model: ModelId,
  cases: Count,
  attacks: Count,
  /** Defended by the model alone (no guard needed). */
  modelAlone: Rate,
  /** Defended once the output guard is included: the number players actually see. */
  withGuard: Rate,
  language: Rate,
  byCategory: z.record(Key, Tally),
});

export const ConsistencyRunSchema = z.strictObject({
  kind: z.literal("consistency"),
  date: z.iso.datetime(),
  model: ModelId,
  judgeModel: ModelId,
  cases: Count,
  interviews: Count,
  answers: Count,
  /** Share of answers that pass each check. */
  metrics: z.record(Key, Rate),
});

export const EvalRunSchema = z.discriminatedUnion("kind", [
  InjectionRunSchema,
  ConsistencyRunSchema,
]);
export const EvalSummarySchema = z.strictObject({ runs: z.array(EvalRunSchema) });

export type InjectionRun = z.infer<typeof InjectionRunSchema>;
export type ConsistencyRun = z.infer<typeof ConsistencyRunSchema>;
export type EvalRun = z.infer<typeof EvalRunSchema>;
export type EvalSummary = z.infer<typeof EvalSummarySchema>;

/** The consistency metrics, in display order. */
export const CONSISTENCY_METRICS = [
  "consistent",
  "no_invention",
  "no_early_reveal",
  "reveals_on_cue",
  "in_character",
  "language",
  "length",
] as const;
