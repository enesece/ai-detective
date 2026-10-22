"use client";

import { useNotebook } from "@/components/notebook/useNotebook";
import { NextCaseCountdown } from "@/components/player/NextCaseCountdown";
import { buttonPrimary, kicker, linkCaps } from "@/components/ui/styles";
import { useLocale, useTranslations } from "next-intl";
import { hasLocale } from "next-intl";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { localize } from "@/lib/case/localize";
import type { CaseOptions } from "@/lib/case/options";
import type { CaseStats, ScoreBreakdown } from "@/lib/game/rules";
import { useGameSnapshot } from "./useGameSnapshot";

type Props = { caseNumber: number; options: CaseOptions };

export function ResultView({ caseNumber, options }: Props) {
  const t = useTranslations("Result");
  const rawLocale = useLocale();
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const game = useGameSnapshot(caseNumber);
  const { notebook } = useNotebook(caseNumber);

  if (game.status === "loading") {
    return <p className="text-muted py-10 italic">{t("loading")}</p>;
  }
  const result = game.snapshot?.result;
  if (!result) {
    return (
      <div className="py-10">
        <p>{t("notYet")}</p>
        <Link href={`/case/${caseNumber}/accuse`} className={`${buttonPrimary} mt-4`}>
          {t("goAccuse")} →
        </Link>
      </div>
    );
  }

  const suspectName = (id: string) => options.suspects.find((s) => s.id === id)?.name ?? id;
  const motiveLabel = (id: string) => options.motives.find((m) => m.id === id)?.label ?? id;
  const evidenceTitle = (id: string) => options.evidence.find((e) => e.id === id)?.title ?? id;
  const { accusation, correct, solution, score } = result;
  const exchanges = game.snapshot?.exchanges ?? [];
  const stats = game.snapshot?.stats ?? null;

  // What the player could have looked at harder: key evidence that never made it
  // into their notebook, and suspects they never questioned.
  const pinnedEvidence = new Set(
    notebook.pins.flatMap((p) => (p.kind === "evidence" ? [p.evidenceId] : [])),
  );
  const missedEvidence = solution.keyEvidenceIds.filter((id) => !pinnedEvidence.has(id));
  const unquestioned = options.suspects.filter((s) => !exchanges.some((e) => e.suspectId === s.id));
  const neverShown = solution.keyEvidenceIds.filter(
    (id) => !exchanges.some((e) => e.evidenceId === id),
  );

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
      <header className="border-ink flex flex-wrap items-center gap-6 border-b pb-8">
        {/* A rubber stamp: "CASE CLOSED" in green, "UNSOLVED" in red. */}
        <p
          aria-hidden
          className={`font-display -rotate-6 border-4 px-4 py-1 text-3xl tracking-wider uppercase ${
            correct.killer ? "border-accent text-accent" : "border-alert text-alert"
          }`}
        >
          {correct.killer ? t("stampSolved") : t("stampUnsolved")}
        </p>
        <div>
          <h2 className="font-display text-4xl sm:text-5xl">
            {correct.killer ? t("solved") : t("unsolved")}
          </h2>
          <p className="text-muted mt-1 italic">
            {t("summary", { questions: result.questionsUsed, hints: result.hintsUsed })}
          </p>
          {stats && <StatsLine stats={stats} />}
          <NextCaseCountdown className="mt-1 font-sans text-sm font-bold tracking-[0.1em] uppercase" />
        </div>
      </header>

      <section className="border-ink overflow-x-auto border-y">
        <table className="w-full text-left">
          <thead className="border-ink text-muted border-b font-sans text-xs tracking-[0.15em] uppercase">
            <tr>
              <th className="p-3" />
              <th className="p-3">{t("yourPick")}</th>
              <th className="p-3">{t("truth")}</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className="border-rule border-b last:border-b-0">
                <th className="p-3 font-bold">{row.label}</th>
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

      <section aria-labelledby="missed-h">
        <h2 id="missed-h" className="font-display border-ink border-b pb-2 text-3xl">
          {t("missedTitle")}
        </h2>
        {missedEvidence.length === 0 && unquestioned.length === 0 && neverShown.length === 0 ? (
          <p className="mt-4 text-lg leading-relaxed">{t("missedNothing")}</p>
        ) : (
          <dl className="mt-4 space-y-4">
            {missedEvidence.length > 0 && (
              <div>
                <dt className={kicker}>{t("missedEvidence")}</dt>
                <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {missedEvidence.map((id) => (
                    <a key={id} href={`#explain-${id}`} className={linkCaps}>
                      🔑 {evidenceTitle(id)}
                    </a>
                  ))}
                </dd>
              </div>
            )}
            {neverShown.length > 0 && (
              <div>
                <dt className={kicker}>{t("missedShown")}</dt>
                <dd className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                  {neverShown.map((id) => (
                    <a key={id} href={`#explain-${id}`} className={linkCaps}>
                      📎 {evidenceTitle(id)}
                    </a>
                  ))}
                </dd>
              </div>
            )}
            {unquestioned.length > 0 && (
              <div>
                <dt className={kicker}>{t("missedSuspects")}</dt>
                <dd className="mt-1 text-lg">{unquestioned.map((s) => s.name).join(", ")}</dd>
              </div>
            )}
          </dl>
        )}
      </section>

      <section>
        <h2 className="font-display border-ink border-b pb-2 text-3xl">{t("trueStory")}</h2>
        <p className="text-muted mt-3 text-lg italic">{localize(solution.method, locale)}</p>
        <div className="first-letter:font-display mt-4 space-y-4 text-lg leading-relaxed whitespace-pre-line first-letter:float-left first-letter:pt-1 first-letter:pr-2 first-letter:text-6xl first-letter:leading-[0.8] md:columns-2 md:gap-8">
          {localize(solution.trueStory, locale)}
        </div>
      </section>

      <section>
        <h2 className="font-display border-ink border-b pb-2 text-3xl">{t("evidenceExplained")}</h2>
        <ul className="mt-4 space-y-3">
          {solution.evidenceExplanations.map((e) => (
            <li
              key={e.evidenceId}
              id={`explain-${e.evidenceId}`}
              className="border-ink bg-card scroll-mt-6 border-t-[3px] p-4"
            >
              <p className="font-bold">
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

function StatsLine({ stats }: { stats: CaseStats }) {
  const t = useTranslations("Result");
  if (stats.finished === 0) return null;
  const percent = Math.round((stats.solved / stats.finished) * 100);
  return (
    <p className="mt-1">
      {t("stats", { percent, finished: stats.finished, average: stats.averageScore })}
    </p>
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
    <section className="border-ink bg-card border p-5">
      <h2 className={kicker}>{t("score")}</h2>
      <dl className="mt-3 space-y-1">
        {parts.map((p) => (
          <div key={p.key} className="flex justify-between">
            <dt className="text-muted">{p.label}</dt>
            <dd className="tabular-nums">{score[p.key]}</dd>
          </div>
        ))}
        <div className="border-ink mt-2 flex items-baseline justify-between border-t pt-2 text-lg font-bold">
          <dt>{t("total")}</dt>
          <dd className="tabular-nums">{score.total}</dd>
        </div>
      </dl>
    </section>
  );
}
