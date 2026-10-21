import { getTranslations } from "next-intl/server";
import { TodayStatus } from "@/components/player/TodayStatus";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { getPublicCase, getTodaysCaseNumber } from "@/server/cases/repository";

const STEPS = ["read", "ask", "note", "accuse"] as const;

export default async function HomePage() {
  const t = await getTranslations("Home");
  const tCase = await getTranslations("Case");
  const locale = await getAppLocale();

  const todaysNumber = await getTodaysCaseNumber();
  const today = todaysNumber === null ? null : await getPublicCase(todaysNumber);

  return (
    <div className="mx-auto max-w-4xl pt-10 sm:pt-16">
      <p className="font-display max-w-xl text-3xl leading-snug sm:text-4xl">{t("tagline")}</p>
      <p className="text-muted mt-3">{t("daily")}</p>

      {today ? (
        <section className="border-rule bg-card mt-10 rounded-lg border p-5 sm:p-6">
          <p className="text-accent text-sm font-semibold tracking-widest uppercase">
            {t("todaysCase")} · {tCase("caseNumber", { number: today.caseNumber })} ·{" "}
            {tCase(`difficulty.${today.difficulty}`)}
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold">
            {localize(today.briefing.title, locale)}
          </h2>
          <p className="text-muted mt-1">{localize(today.briefing.setting.place, locale)}</p>
          <p className="mt-4 leading-relaxed">{localize(today.briefing.setting.summary, locale)}</p>
          <div className="mt-6 flex flex-wrap items-center gap-4">
            <Link
              href={`/case/${today.caseNumber}`}
              className="bg-ink text-paper inline-block rounded px-5 py-2.5 font-semibold hover:opacity-90"
            >
              {t("openCase")}
            </Link>
            <TodayStatus caseNumber={today.caseNumber} />
          </div>
        </section>
      ) : (
        <p className="border-rule bg-card mt-10 rounded-lg border p-6">{t("noCase")}</p>
      )}

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">{t("howToPlay")}</h2>
        <ol className="mt-4 grid gap-4 sm:grid-cols-2">
          {STEPS.map((step, i) => (
            <li key={step} className="border-rule flex gap-3 rounded-lg border p-4">
              <span className="font-display text-accent text-2xl font-bold">{i + 1}</span>
              <span>{t(`steps.${step}`)}</span>
            </li>
          ))}
        </ol>
        <Link
          href="/archive"
          className="text-accent mt-6 inline-block font-semibold hover:underline"
        >
          {t("archiveLink")} →
        </Link>
      </section>
    </div>
  );
}
