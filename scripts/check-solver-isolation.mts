// Builds the blind solver's input for every fixture and fails if it contains
// anything a player could never learn: the solution, the hints, the true
// timeline, the evidence explanations, or the killer's own private notes.
// The briefing-only input must contain no secret text at all.
// Run: npm run check:solver
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSolverBrief } from "../src/server/generator/solver.ts";
import type { CaseFile } from "../src/lib/case/schema.ts";

const FIXTURES_DIR = "src/server/cases/fixtures";
const MIN_LENGTH = 12;

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.length >= MIN_LENGTH ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const failures: string[] = [];
let briefs = 0;

for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"))) {
  const c = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")) as CaseFile;
  const publicText = new Set(strings(c.public));
  const killer = c.secret.suspects.find((s) => s.suspectId === c.secret.solution.killerId);
  if (!killer) throw new Error(`${file}: no secret for the killer`);

  const forbidden = strings([
    c.secret.solution,
    c.secret.hints,
    c.secret.timeline,
    c.secret.evidence.map((e) => e.explanation),
    killer.knows,
    killer.alibi.truth,
    killer.hides,
    killer.lies.map((l) => l.truth),
  ]).filter((s) => !publicText.has(s));
  const allSecret = strings(c.secret).filter((s) => !publicText.has(s));

  const checks = [
    { mode: "full", text: buildSolverBrief(c, "full"), banned: forbidden },
    { mode: "briefing_only", text: buildSolverBrief(c, "briefing_only"), banned: allSecret },
  ] as const;

  for (const { mode, text, banned } of checks) {
    briefs += 1;
    for (const s of banned) {
      if (text.includes(s)) failures.push(`${file} / ${mode}: contains "${s.slice(0, 60)}…"`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} solver isolation failure(s):`);
  failures.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(`✓ Solver isolation holds for ${briefs} solver inputs.`);
