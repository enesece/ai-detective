import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { pageAlternates } from "@/lib/site";
import { getPublicCase } from "@/server/cases/repository";
import { parseCaseNumber } from "./case-number";

const DESCRIPTION_LENGTH = 160;

/**
 * Tab title, description and language links for a case page. Built only from
 * the public briefing, like everything else that reaches the browser.
 * `section` names the sub-page ("Interrogation"); `subPath` is its URL part ("/interrogate").
 */
export async function caseMetadata(
  rawCaseNumber: string,
  subPath = "",
  section?: string,
): Promise<Metadata> {
  const caseNumber = parseCaseNumber(rawCaseNumber);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  if (!publicCase) return {};

  const tCase = await getTranslations("Case");
  const locale = await getAppLocale();
  const title = localize(publicCase.briefing.title, locale);
  const label = tCase("caseNumber", { number: publicCase.caseNumber });
  const summary = localize(publicCase.briefing.setting.summary, locale);
  const description =
    summary.length > DESCRIPTION_LENGTH
      ? `${summary.slice(0, DESCRIPTION_LENGTH - 1).trimEnd()}…`
      : summary;

  return {
    title: section ? `${section} · ${title}` : `${label}: ${title}`,
    description,
    alternates: pageAlternates(locale, `/case/${publicCase.caseNumber}${subPath}`),
    openGraph: { title: `${label}: ${title}`, description, type: "article" },
  };
}
