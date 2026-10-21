"use client";

import { useLocale, useTranslations } from "next-intl";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localize } from "@/lib/case/localize";
import type { CaseOptions } from "@/lib/case/options";
import type { ScoreBreakdown } from "@/lib/game/rules";
import { ShareCard } from "./ShareCard";
import { useGameSnapshot } from "./useGameSnapshot";

type Props = { caseNumber: number; options: CaseOptions };

export function ResultView({ caseNumber, options }: Props) {
  const t = useTranslations("Result");
  const rawLocale = useLocale();
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const game = useGameSnapshot(caseNumber);

  if (game.status === "loading") {
    return <p className="text-muted py-10 italic">{t("loading")}</p>;
  }
  const result = game.snapshot?.result;
  if (!result) {
    return (
      <div className="py-10">
        <p>{t("notYet")}</p>
        <Link
          href={`/case/${caseNumber}/accuse`}
          className="text-accent mt-3 inline-block font-semibold hover:underline"
        >
          {t("goAccuse")} →
        </Link>
      </div>
    );
  }

  const suspectName = (id: string) => options.suspects.find((s) => s.id === id)?.name ?? id;
  const motiveLabel = (id: string) => options.motives.find((m) => m.id === id)?.label ?? id;
  const evidenceTitle = (id: string) => options.evidence.find((e) => e.id === id)?.title ?? id;
  const { accusation, correct, solution, score } = result;

  const rows = [
    {
      label: t("killer"),
      picked: suspectName(accusation.killerId),
      truth: suspectName(solution.killerId),
      ok: correct.killer,
    },
    {
      label: t("motive"),
      picked: motiveLabel(accusation.motiveId),
      truth: motiveLabel(solution.motiveId),
      ok: correct.motive,
    },
    {
      label: t("evidence"),
      picked: evidenceTitle(accusation.evidenceId),
      truth: solution.keyEvidenceIds.map(evidenceTitle).join(" / "),
      ok: correct.evidence,
    },
  ];

  return (
    <div className="space-y-10">
      <header>
        <p className="text-6xl" aria-hidden>
          {correct.killer ? "🕵️" : "🕯️"}
        </p>
        <h2 className="font-display mt-2 text-4xl font-bold">
          {correct.killer ? t("solved") : t("unsolved")}
        </h2>
        <p className="text-muted mt-1">
          {t("summary", { questions: result.questionsUsed, hints: result.hintsUsed })}
        </p>
      </header>

      <section className="border-rule bg-card overflow-hidden rounded-lg border">
        <table className="w-full text-left text-sm">
          <thead className="border-rule border-b">
            <tr>
              <th className="p-3" />
              <th className="p-3">{t("yourPick")}</th>
              <th className="p-3">{t("truth")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-rule border-b last:border-b-0">
                <th className="p-3 font-semibold">{row.label}</th>
                <td className="p-3">
                  {row.ok ? "✅" : "❌"} {row.picked}
                </td>
                <td className="p-3">{row.truth}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ScoreTable score={score} />

      <ShareCard caseNumber={caseNumber} result={result} />

      <section>
        <h2 className="font-display text-2xl font-bold">{t("trueStory")}</h2>
        <p className="text-muted mt-2 italic">{localize(solution.method, locale)}</p>
        <div className="mt-4 space-y-4 text-lg leading-relaxed whitespace-pre-line">
          {localize(solution.trueStory, locale)}
        </div>
      </section>

      <section>
        <h2 className="font-display text-2xl font-bold">{t("evidenceExplained")}</h2>
        <ul className="mt-4 space-y-3">
          {solution.evidenceExplanations.map((e) => (
            <li key={e.evidenceId} className="border-rule bg-card rounded-lg border p-4">
              <p className="font-semibold">
                {solution.keyEvidenceIds.includes(e.evidenceId) && "🔑 "}
                {evidenceTitle(e.evidenceId)}
              </p>
              <p className="mt-1 leading-relaxed">{localize(e.explanation, locale)}</p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

function ScoreTable({ score }: { score: ScoreBreakdown }) {
  const t = useTranslations("Result");
  const parts: { key: keyof Omit<ScoreBreakdown, "total">; label: string }[] = [
    { key: "killer", label: t("scoreKiller") },
    { key: "motive", label: t("scoreMotive") },
    { key: "evidence", label: t("scoreEvidence") },
    { key: "unusedQuestions", label: t("scoreUnused") },
    { key: "hintPenalty", label: t("scoreHints") },
  ];

  return (
    <section className="border-rule bg-card rounded-lg border p-5">
      <h2 className="font-display text-xl font-bold">{t("score")}</h2>
      <dl className="mt-3 space-y-1 text-sm">
        {parts.map((p) => (
          <div key={p.key} className="flex justify-between">
            <dt className="text-muted">{p.label}</dt>
            <dd className="tabular-nums">{score[p.key]}</dd>
          </div>
        ))}
        <div className="border-rule mt-2 flex justify-between border-t pt-2 text-base font-bold">
          <dt>{t("total")}</dt>
          <dd className="tabular-nums">{score.total}</dd>
        </div>
      </dl>
    </section>
  );
}
