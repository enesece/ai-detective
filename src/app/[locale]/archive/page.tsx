import { getFormatter, getTranslations } from "next-intl/server";
import { ArchiveList, type ArchiveRow } from "@/components/player/ArchiveList";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { listPublishedCases } from "@/server/cases/repository";

export async function generateMetadata() {
  const t = await getTranslations("Archive");
  return { title: t("title") };
}

export default async function ArchivePage() {
  const t = await getTranslations("Archive");
  const tCase = await getTranslations("Case");
  const format = await getFormatter();
  const locale = await getAppLocale();
  const cases = await listPublishedCases();

  // Server → Client boundary: plain, translated, public fields only.
  const rows: ArchiveRow[] = cases.map((c) => ({
    caseNumber: c.caseNumber,
    date: format.dateTime(new Date(`${c.publishDate}T00:00:00Z`), {
      dateStyle: "medium",
      timeZone: "UTC",
    }),
    title: localize(c.title, locale),
    place: localize(c.place, locale),
    difficulty: tCase(`difficulty.${c.difficulty}`),
  }));

  return (
    <div className="mx-auto max-w-4xl pt-10">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <p className="text-muted mt-2 mb-6">{t("intro")}</p>
      {rows.length === 0 ? <p>{t("empty")}</p> : <ArchiveList rows={rows} />}
    </div>
  );
}
