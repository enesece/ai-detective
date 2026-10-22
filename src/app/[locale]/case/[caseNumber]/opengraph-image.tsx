import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { localize } from "@/lib/case/localize";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { OG_SIZE, renderGazetteCard } from "@/server/og/gazette-card";
import { parseCaseNumber } from "./case-number";

export const alt = "The Daily Alibi case file";
export const size = OG_SIZE;
export const contentType = "image/png";

export async function generateStaticParams() {
  return (await listCaseNumbers()).map((n) => ({ caseNumber: String(n) }));
}

/** Share image for a case: number, difficulty, title and place. Public briefing only. */
export default async function Image({
  params,
}: {
  params: Promise<{ locale: string; caseNumber: string }>;
}) {
  const { locale: raw, caseNumber: rawNumber } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const tHeader = await getTranslations({ locale, namespace: "Header" });
  const tCase = await getTranslations({ locale, namespace: "Case" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  const caseNumber = parseCaseNumber(rawNumber);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  if (!publicCase) {
    return renderGazetteCard({
      brand: tHeader("brand"),
      kicker: "",
      headline: tMeta("title"),
      standfirst: tMeta("description"),
    });
  }

  return renderGazetteCard({
    brand: tHeader("brand"),
    kicker: `${tCase("caseNumber", { number: publicCase.caseNumber })} · ${tCase(`difficulty.${publicCase.difficulty}`)}`,
    headline: localize(publicCase.briefing.title, locale),
    standfirst: localize(publicCase.briefing.setting.place, locale),
  });
}
