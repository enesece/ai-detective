import { getFormatter, getTranslations } from "next-intl/server";
import { RateBars, type RateRow } from "@/components/lab/RateBars";
import { StatTile } from "@/components/lab/StatTile";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { kicker } from "@/components/ui/styles";
import { getAppLocale } from "@/i18n/locale";
import { evalRuns, latestConsistency, latestInjection } from "@/lib/eval/results";
import { CONSISTENCY_METRICS } from "@/lib/eval/summary";
import { pageAlternates } from "@/lib/site";

export async function generateMetadata() {
  const t = await getTranslations("Lab");
  return {
    title: t("title"),
    description: t("intro"),
    alternates: pageAlternates(await getAppLocale(), "/lab"),
  };
}

const pct = (rate: number) => `${(Math.round(rate * 1000) / 10).toString()}%`;
// Model ids are stored as "provider:model"; the page shows the model.
const modelName = (id: string) => id.split(":").at(-1) ?? id;

/**
 * Public results of the AI evals (scripts/eval-*.mts). Static: built from
 * eval/results/summary.json, which holds numbers only.
 */
export default async function LabPage() {
  const t = await getTranslations("Lab");
  const format = await getFormatter();
  const injection = latestInjection;
  const consistency = latestConsistency;
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "long" });
  const latestDate = evalRuns[0]?.date;

  if (!injection && !consistency) {
    return <p className="pt-10 text-lg">{t("empty")}</p>;
  }

  const attackRows: RateRow[] = injection
    ? Object.entries(injection.byCategory).map(([key, tally]) => ({
        key,
        label: t.has(`categories.${key}`) ? t(`categories.${key}`) : key,
        rate: tally.total === 0 ? 1 : tally.passed / tally.total,
        detail: `${tally.passed}/${tally.total}`,
      }))
    : [];
  const metricRows: RateRow[] = consistency
    ? CONSISTENCY_METRICS.filter((key) => key in consistency.metrics).map((key) => ({
        key,
        label: t(`metrics.${key}`),
        rate: consistency.metrics[key] ?? 0,
      }))
    : [];
  const answersPassing = (key: string) =>
    consistency ? Math.round((consistency.metrics[key] ?? 0) * consistency.answers) : 0;

  return (
    <article className="mx-auto max-w-4xl pt-10">
      <p className={`${kicker} text-accent`}>{t("kicker")}</p>
      <h1 className="font-display mt-2 text-4xl leading-tight sm:text-5xl">{t("heading")}</h1>
      <p className="mt-4 text-lg leading-relaxed">{t("intro")}</p>
      {latestDate && (
        <p className="text-muted mt-2 text-sm italic">{t("lastRun", { date: date(latestDate) })}</p>
      )}

      {/* Headline numbers */}
      <div className="mt-10 grid gap-8 sm:grid-cols-3">
        {injection && (
          <StatTile
            label={t("kpi.defended")}
            value={pct(injection.withGuard)}
            sub={t("kpi.defendedSub", {
              passed: Math.round(injection.withGuard * injection.attacks),
              total: injection.attacks,
              cases: injection.cases,
            })}
          />
        )}
        {consistency && (
          <StatTile
            label={t("kpi.consistent")}
            value={pct(consistency.metrics.consistent ?? 0)}
            sub={t("kpi.consistentSub", {
              passed: answersPassing("consistent"),
              total: consistency.answers,
              cases: consistency.cases,
            })}
          />
        )}
        {consistency && (
          <StatTile
            label={t("kpi.secretsKept")}
            value={pct(consistency.metrics.no_early_reveal ?? 0)}
            sub={t("kpi.secretsKeptSub", {
              passed: answersPassing("no_early_reveal"),
              total: consistency.answers,
            })}
          />
        )}
      </div>

      {injection && (
        <section className="mt-14" aria-labelledby="injection-h">
          <SectionHeading id="injection-h" aside={modelName(injection.model)}>
            {t("injection.heading")}
          </SectionHeading>
          <p className="leading-relaxed">{t("injection.body")}</p>
          <div className="mt-6">
            <RateBars title={t("injection.chartTitle")} rows={attackRows} />
          </div>
          <p className="text-muted mt-4 text-sm">
            {t("injection.modelAlone", { rate: pct(injection.modelAlone) })} {t("injection.note")}
          </p>
        </section>
      )}

      {consistency && (
        <section className="mt-14" aria-labelledby="consistency-h">
          <SectionHeading id="consistency-h" aside={modelName(consistency.model)}>
            {t("consistency.heading")}
          </SectionHeading>
          <p className="leading-relaxed">{t("consistency.body")}</p>
          <div className="mt-6">
            <RateBars title={t("consistency.chartTitle")} rows={metricRows} />
          </div>
          <p className="text-muted mt-4 text-sm">
            {t("consistency.judge", { judge: modelName(consistency.judgeModel) })}
          </p>
        </section>
      )}

      <div className="mt-14 grid gap-10 md:grid-cols-2">
        <TextList heading={t("found.heading")} items={t.raw("found.items")} />
        <TextList heading={t("how.heading")} items={t.raw("how.items")} />
      </div>

      <section className="mt-14" aria-labelledby="limits-h">
        <SectionHeading id="limits-h">{t("limits.heading")}</SectionHeading>
        <p className="leading-relaxed">{t("limits.body")}</p>
      </section>

      <section className="mt-14" aria-labelledby="log-h">
        <SectionHeading id="log-h">{t("log.heading")}</SectionHeading>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted font-sans text-xs tracking-[0.15em] uppercase">
              <tr className="border-ink border-b">
                <th className="py-2 pr-4">{t("log.date")}</th>
                <th className="py-2 pr-4">{t("log.kind")}</th>
                <th className="py-2 pr-4">{t("log.cases")}</th>
                <th className="py-2 pr-4">{t("log.size")}</th>
                <th className="py-2">{t("log.result")}</th>
              </tr>
            </thead>
            <tbody>
              {evalRuns.map((run) => (
                <tr key={`${run.kind}-${run.date}`} className="border-rule border-b">
                  <td className="py-2 pr-4 whitespace-nowrap">{date(run.date)}</td>
                  <td className="py-2 pr-4">{t(`log.${run.kind}`)}</td>
                  <td className="py-2 pr-4 tabular-nums">{run.cases}</td>
                  <td className="py-2 pr-4 whitespace-nowrap">
                    {run.kind === "injection"
                      ? t("log.attacks", { count: run.attacks })
                      : t("log.answers", { count: run.answers })}
                  </td>
                  <td className="py-2 font-bold tabular-nums">
                    {pct(run.kind === "injection" ? run.withGuard : (run.metrics.consistent ?? 0))}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </article>
  );
}

function TextList({ heading, items }: { heading: string; items: unknown }) {
  const lines = Array.isArray(items) ? items.filter((i): i is string => typeof i === "string") : [];
  return (
    <section>
      <h2 className="font-display border-ink border-b pb-2 text-2xl">{heading}</h2>
      <ul className="mt-4 space-y-3">
        {lines.map((line) => (
          <li key={line} className="border-rule border-l-2 pl-3 leading-relaxed">
            {line}
          </li>
        ))}
      </ul>
    </section>
  );
}
