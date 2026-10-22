// Character-consistency eval: every suspect of the chosen cases gets the same
// six-question interview (English and Turkish) through the game's real prompt,
// settings and history window. A separate model then grades each answer against
// that suspect's private notes; cheap code checks add language, length and the
// output guard.
//
// Run: npm run eval:consistency [-- --cases=1,2]   (default: every approved case)
// Cost: per case 4 suspects x 2 languages x (6 answers + 1 judge call) = 56 calls
// on the free tier, about 5 minutes per case.
//
// Writes the full transcripts to eval/results/private/ (git-ignored: they can
// hold unpublished cases' secrets) and a numbers-only entry to summary.json.
import { parseArgs } from "node:util";
import { LOCALES, type Locale } from "../src/lib/case/schema.ts";
import { CONSISTENCY_METRICS, type ConsistencyRun } from "../src/lib/eval/summary.ts";
import { getChatModel, getJudgeModel } from "../src/server/ai/index.ts";
import { languageOk, MAX_SENTENCES, sentenceCount } from "../src/server/eval/answer-checks.ts";
import { loadEvalCases, parseCaseList } from "../src/server/eval/cases.ts";
import {
  interviewScript,
  judgeInterview,
  type TurnVerdict,
} from "../src/server/eval/consistency.ts";
import { interview, type InterviewExchange } from "../src/server/eval/interview.ts";
import { appendRun, writePrivate } from "../src/server/eval/summary-file.ts";
import { findViolation } from "../src/server/interrogation/answer-guard.ts";

const { values } = parseArgs({ options: { cases: { type: "string" } } });
const DELAY_MS = Number(process.env.EVAL_DELAY_MS) || 4500;

const cases = await loadEvalCases(parseCaseList(values.cases));
if (cases.length === 0) throw new Error("No approved cases found.");
const model = getChatModel();
const judge = getJudgeModel();

type Graded = InterviewExchange & {
  verdict: TurnVerdict;
  languageOk: boolean;
  lengthOk: boolean;
  guard: string | null;
};
type Interview = {
  caseNumber: number;
  suspectId: string;
  locale: Locale;
  isKiller: boolean;
  answers: Graded[];
};

console.log(
  `Consistency eval · cases ${cases.map((c) => `#${c.caseNumber}`).join(", ")} · model ${model.id} · judge ${judge.id}\n`,
);
const interviews: Interview[] = [];
for (const c of cases) {
  for (const suspect of c.public.suspects) {
    for (const locale of LOCALES) {
      const isKiller = suspect.id === c.secret.solution.killerId;
      process.stdout.write(`#${c.caseNumber} ${suspect.id.padEnd(22)} ${locale} `);
      const transcript = await interview(
        model,
        c,
        suspect.id,
        locale,
        interviewScript(c, suspect.id, locale),
        DELAY_MS,
      );
      const verdicts = await judgeInterview(judge, c, suspect.id, transcript, locale);
      const answers = transcript.map((t, i) => ({
        ...t,
        verdict: verdicts[i]!,
        languageOk: languageOk(t.answer, locale),
        lengthOk: sentenceCount(t.answer) <= MAX_SENTENCES,
        guard: findViolation(t.answer, { isKiller }),
      }));
      interviews.push({
        caseNumber: c.caseNumber,
        suspectId: suspect.id,
        locale,
        isKiller,
        answers,
      });
      const flags = answers.filter((a) => !isClean(a)).length;
      console.log(flags === 0 ? "✓" : `${flags} flagged`);
      await new Promise((r) => setTimeout(r, DELAY_MS));
    }
  }
}

// --- Metrics -------------------------------------------------------------------
function isClean(a: Graded): boolean {
  const v = a.verdict;
  return (
    !v.contradicts_self &&
    !v.contradicts_notes &&
    !v.invents_facts &&
    !v.revealed_too_early &&
    !v.missed_reveal &&
    !v.out_of_character &&
    a.languageOk &&
    a.lengthOk
  );
}

const all = interviews.flatMap((i) => i.answers);
const rate = (pass: (a: Graded) => boolean) =>
  all.length === 0 ? 1 : all.filter(pass).length / all.length;
const metrics: Record<(typeof CONSISTENCY_METRICS)[number], number> = {
  consistent: rate((a) => !a.verdict.contradicts_self && !a.verdict.contradicts_notes),
  no_invention: rate((a) => !a.verdict.invents_facts),
  no_early_reveal: rate((a) => !a.verdict.revealed_too_early),
  reveals_on_cue: rate((a) => !a.verdict.missed_reveal),
  in_character: rate((a) => !a.verdict.out_of_character && a.guard === null),
  language: rate((a) => a.languageOk),
  length: rate((a) => a.lengthOk),
};

console.log(`\n${all.length} answers in ${interviews.length} interviews:`);
for (const key of CONSISTENCY_METRICS) {
  console.log(`  ${key.padEnd(16)} ${(metrics[key] * 100).toFixed(1)}%`);
}

const date = new Date().toISOString();
const run: ConsistencyRun = {
  kind: "consistency",
  date,
  model: model.id,
  judgeModel: judge.id,
  cases: cases.length,
  interviews: interviews.length,
  answers: all.length,
  metrics,
};
appendRun(run);
const path = writePrivate(`consistency-${date.slice(0, 19).replace(/:/g, "")}.json`, {
  ...run,
  interviews,
});
console.log(`\nSaved ${path} and appended to eval/results/summary.json`);
