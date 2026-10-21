// Generates one case with the full pipeline (generate → Zod → logic checks →
// blind solver) and saves it as a draft for the admin to review.
// Run: npm run generate -- --difficulty=medium [--theme="a lighthouse in 1930s Scotland"]
// Re-check a saved draft (new review, no generation): npm run generate -- --recheck=<case id>
import { parseArgs } from "node:util";
import { recheckDraft, runPipeline } from "../src/server/generator/pipeline.ts";

const { values } = parseArgs({
  options: {
    difficulty: { type: "string", default: "medium" },
    theme: { type: "string" },
    recheck: { type: "string" },
  },
});

const difficulty = values.difficulty;
if (difficulty !== "easy" && difficulty !== "medium" && difficulty !== "hard") {
  throw new Error("--difficulty must be easy, medium or hard");
}

const started = Date.now();
const outcome = values.recheck
  ? await recheckDraft(values.recheck, { log: console.log })
  : await runPipeline({ difficulty, theme: values.theme, log: console.log });
const seconds = Math.round((Date.now() - started) / 1000);

if (outcome.decision === "failed") {
  console.log(`\n✗ Failed after ${seconds}s, nothing saved:`);
  outcome.reasons.forEach((r) => console.log(`  - ${r}`));
  process.exitCode = 1;
} else {
  const mark = outcome.decision === "pending" ? "✓" : "✗";
  console.log(
    `\n${mark} "${outcome.title}" saved as draft ${outcome.caseId} (${outcome.decision}) in ${seconds}s`,
  );
  outcome.reasons.forEach((r) => console.log(`  - ${r}`));
}
