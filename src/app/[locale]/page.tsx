import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { getPublicCase, getTodaysCaseNumber } from "@/server/cases/repository";

export default async function HomePage() {
  const t = await getTranslations("Home");
  const tCase = await getTranslations("Case");
  const locale = await getAppLocale();

  const todaysNumber = await getTodaysCaseNumber();
  const today = todaysNumber === null ? null : await getPublicCase(todaysNumber);

  return (
    <div className="mx-auto max-w-4xl pt-16">
      <p className="font-display max-w-xl text-3xl leading-snug sm:text-4xl">{t("tagline")}</p>

      {today && (
        <section className="border-rule bg-card mt-12 rounded-lg border p-6">
          <p className="text-accent text-sm font-semibold tracking-widest uppercase">
            {t("todaysCase")} · {tCase("caseNumber", { number: today.caseNumber })}
          </p>
          <h2 className="font-display mt-2 text-2xl font-bold">
            {localize(today.briefing.title, locale)}
          </h2>
          <p className="text-muted mt-1">{localize(today.briefing.setting.place, locale)}</p>
          <Link
            href={`/case/${today.caseNumber}`}
            className="bg-ink text-paper mt-6 inline-block rounded px-5 py-2.5 font-semibold hover:opacity-90"
          >
            {t("openCase")}
          </Link>
        </section>
      )}
    </div>
  );
}
