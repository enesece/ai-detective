// Builds every suspect's real system prompt and fails if it contains anything
// that suspect must not know: other suspects' secrets, or (for innocent
// suspects) any part of the solution.
// Run: npm run check:prompts   (Node strips the TypeScript types itself.)
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { buildSuspectPrompt } from "../src/server/interrogation/prompt.ts";
import type { CaseFile, Locale } from "../src/lib/case/schema.ts";

const FIXTURES_DIR = "src/server/cases/fixtures";
const MIN_LENGTH = 12;

function strings(value: unknown): string[] {
  if (typeof value === "string") return value.length >= MIN_LENGTH ? [value] : [];
  if (Array.isArray(value)) return value.flatMap(strings);
  if (value && typeof value === "object") return Object.values(value).flatMap(strings);
  return [];
}

const failures: string[] = [];
let prompts = 0;

for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json"))) {
  const c = JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")) as CaseFile;
  const { killerId } = c.secret.solution;
  const publicText = new Set(strings(c.public));
  const solutionText = strings(c.secret.solution).filter((s) => !publicText.has(s));

  for (const suspect of c.public.suspects) {
    const own = c.secret.suspects.find((s) => s.suspectId === suspect.id);
    if (!own) throw new Error(`${file}: no secret for ${suspect.id}`);
    const ownText = new Set(strings(own));
    const othersText = c.secret.suspects
      .filter((s) => s.suspectId !== suspect.id)
      .flatMap(strings)
      .filter((s) => !ownText.has(s) && !publicText.has(s));
    const isKiller = suspect.id === killerId;

    for (const locale of ["en", "tr"] satisfies Locale[]) {
      const prompt = buildSuspectPrompt({ briefing: c.public, suspect, secret: own, isKiller, locale });
      prompts += 1;
      const where = `${file} / ${suspect.id} / ${locale}`;

      for (const s of othersText) {
        if (prompt.includes(s)) failures.push(`${where}: contains another suspect's secret: "${s.slice(0, 50)}…"`);
      }
      for (const s of solutionText) {
        if (prompt.includes(s)) failures.push(`${where}: contains solution text: "${s.slice(0, 50)}…"`);
      }
      if (!isKiller && /you killed/i.test(prompt)) failures.push(`${where}: innocent suspect told they killed`);
    }
  }
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} isolation failure(s):`);
  failures.forEach((f) => console.error(`  ${f}`));
  process.exit(1);
}
console.log(`✓ Prompt isolation holds for ${prompts} suspect prompts.`);
