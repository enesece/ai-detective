import summaryJson from "../../../eval/results/summary.json";
import { EvalSummarySchema, type ConsistencyRun, type EvalRun, type InjectionRun } from "./summary";

/*
 * The eval summary, read at build time. Parsing with the strict schema means a
 * summary holding anything but numbers and short keys breaks the build instead
 * of reaching a page.
 */
const summary = EvalSummarySchema.parse(summaryJson);

/** Newest first. */
export const evalRuns: EvalRun[] = [...summary.runs].sort((a, b) => b.date.localeCompare(a.date));

export const latestInjection = evalRuns.find((r): r is InjectionRun => r.kind === "injection");
export const latestConsistency = evalRuns.find(
  (r): r is ConsistencyRun => r.kind === "consistency",
);
