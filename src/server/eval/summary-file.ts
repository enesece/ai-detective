import "server-only";

import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname } from "node:path";
import { EvalSummarySchema, type EvalRun } from "@/lib/eval/summary";

export const SUMMARY_PATH = "eval/results/summary.json";
/** Full results (answers, transcripts) go here; git-ignored, never shipped. */
export const PRIVATE_DIR = "eval/results/private";

/** Validates a run and appends it to the public summary file. */
export function appendRun(run: EvalRun): void {
  const summary = existsSync(SUMMARY_PATH)
    ? EvalSummarySchema.parse(JSON.parse(readFileSync(SUMMARY_PATH, "utf8")))
    : { runs: [] };
  summary.runs.push(run);
  writeFileSync(SUMMARY_PATH, JSON.stringify(EvalSummarySchema.parse(summary), null, 2) + "\n");
}

export function writePrivate(name: string, data: unknown): string {
  const path = `${PRIVATE_DIR}/${name}`;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
  return path;
}
