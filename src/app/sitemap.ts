import type { MetadataRoute } from "next";
import { routing } from "@/i18n/routing";
import { SITE_URL } from "@/lib/site";
import { listPublishedCases } from "@/server/cases/repository";

/** Home, archive, privacy and every published case file, each in both languages. */
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entry = (path: string, lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: `${SITE_URL}/${routing.defaultLocale}${path}`,
    lastModified,
    alternates: {
      languages: Object.fromEntries(routing.locales.map((l) => [l, `${SITE_URL}/${l}${path}`])),
    },
  });

  const cases = await listPublishedCases();
  return [
    entry(""),
    entry("/archive"),
    entry("/privacy"),
    entry("/lab"),
    ...cases.map((c) => entry(`/case/${c.caseNumber}`, c.publishDate)),
  ];
}
