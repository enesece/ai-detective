import { getFormatter, getTranslations } from "next-intl/server";
import { TodayStatus } from "@/components/player/TodayStatus";
import { buttonPrimary, kicker, label, linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { getPublicCase, getTodaysCase, listPublishedCases } from "@/server/cases/repository";

const STEPS = ["read", "ask", "note", "accuse"] as const;

export default async function HomePage() {
  const t = await getTranslations("Home");
  const tHeader = await getTranslations("Header");
  const tCase = await getTranslations("Case");
  const format = await getFormatter();
  const locale = await getAppLocale();

  const todays = await getTodaysCase();
  const today = todays === null ? null : await getPublicCase(todays.caseNumber);
  const archive = (await listPublishedCases())
    .filter((c) => c.caseNumber !== todays?.caseNumber)
    .slice(0, 3);
  // If nothing is scheduled for today yet, this is yesterday's (or an older) case.
  const isToday = todays?.isToday ?? false;
  const day = (isoDate: string) =>
    format.dateTime(new Date(`${isoDate}T00:00:00Z`), { dateStyle: "full", timeZone: "UTC" });
  const scene = today?.briefing.locations.find((l) => l.id === today.briefing.crimeSceneId);

  return (
    <div className="pt-6">
      {/* Masthead */}
      <header className="border-ink border-t-[3px] text-center">
        <h1 className="font-display pt-4 text-5xl leading-none sm:text-6xl lg:text-7xl">
          {tHeader("brand")}
        </h1>
        <p className="text-muted mt-3 text-lg italic">{t("tagline")}</p>
        <p
          className={`${kicker} border-ink mt-4 border-y-4 border-double py-2 font-medium tracking-[0.15em] sm:tracking-[0.25em]`}
        >
          {todays ? `${day(todays.publishDate)} · ` : ""}
          {t("edition")}
        </p>
      </header>

      {today ? (
        <article className="border-ink flex flex-wrap gap-10 border-b py-10">
          <div className="min-w-0 flex-[999_1_32rem]">
            <p className={`${kicker} text-accent`}>
              {isToday ? t("todaysCase") : t("latestCase")} ·{" "}
              {tCase("caseNumber", { number: today.caseNumber })} ·{" "}
              {tCase(`difficulty.${today.difficulty}`)}
            </p>
            <h2 className="font-display mt-3 text-4xl leading-[1.02] sm:text-5xl">
              {localize(today.briefing.title, locale)}
            </h2>
            <p className="text-muted mt-3 text-xl italic">
              {localize(today.briefing.setting.place, locale)}
            </p>
            <p className="first-letter:font-display mt-6 text-lg leading-relaxed text-pretty first-letter:float-left first-letter:pt-1 first-letter:pr-2 first-letter:text-6xl first-letter:leading-[0.8] md:columns-2 md:gap-8 md:text-justify md:hyphens-auto">
              {localize(today.briefing.setting.summary, locale)}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3">
              <Link href={`/case/${today.caseNumber}`} className={buttonPrimary}>
                {t("openCase")}
              </Link>
              <span className="text-muted font-sans text-sm">{t("questionsNote")}</span>
              <TodayStatus caseNumber={today.caseNumber} />
            </div>
          </div>
          <aside
            aria-label={t("atAGlance")}
            className="border-ink flex-[1_1_16rem] border-t pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-7"
          >
            <h3 className={kicker}>{t("atAGlance")}</h3>
            <dl className="mt-4 space-y-4 text-lg">
              <div>
                <dt className={label}>{tCase("victim")}</dt>
                <dd className="mt-1">{today.briefing.victim.name}</dd>
              </div>
              <div>
                <dt className={label}>{tCase("scene")}</dt>
                <dd className="mt-1">{scene ? localize(scene.name, locale) : "—"}</dd>
              </div>
              <div>
                <dt className={label}>{tCase("timeOfDeath")}</dt>
                <dd className="mt-1">
                  {tCase("timeWindow", {
                    from: today.briefing.estimatedTimeOfDeath.from,
                    to: today.briefing.estimatedTimeOfDeath.to,
                  })}
                </dd>
              </div>
            </dl>
          </aside>
        </article>
      ) : (
        <p className="border-ink border-b py-10 text-lg">{t("noCase")}</p>
      )}

      {/* Rules of the game, as four newspaper columns */}
      <section aria-labelledby="rules-h" className="border-ink border-b py-10">
        <h2 id="rules-h" className="font-display text-center text-3xl">
          {t("rules")}
        </h2>
        <ol className="divide-rule mt-8 grid sm:grid-cols-2 lg:grid-cols-4 lg:divide-x">
          {STEPS.map((step, i) => (
            <li key={step} className="flex gap-3 px-0 py-3 lg:px-5 lg:py-0">
              <span className="font-display text-accent text-4xl leading-none">{i + 1}</span>
              <span className="leading-relaxed">{t(`steps.${step}`)}</span>
            </li>
          ))}
        </ol>
        <p className="text-muted mt-8 text-center italic">{t("daily")}</p>
      </section>

      {archive.length > 0 && (
        <section aria-labelledby="archive-h" className="py-10">
          <div className="flex flex-wrap items-baseline justify-between gap-4">
            <h2 id="archive-h" className={kicker}>
              {t("fromArchive")}
            </h2>
            <Link href="/archive" className={linkCaps}>
              {t("allCases")} →
            </Link>
          </div>
          <ul className="divide-rule mt-4 grid gap-6 md:grid-cols-3 md:gap-0 md:divide-x">
            {archive.map((c) => (
              <li key={c.caseNumber} className="md:px-5 md:first:pl-0">
                <Link href={`/case/${c.caseNumber}`} className="group block">
                  <span className={label}>
                    {tCase("caseNumber", { number: c.caseNumber })} · {day(c.publishDate)}
                  </span>
                  <span className="mt-1 block text-xl font-bold group-hover:underline">
                    {localize(c.title, locale)}
                  </span>
                  <span className="text-muted mt-1 block italic">{localize(c.place, locale)}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
