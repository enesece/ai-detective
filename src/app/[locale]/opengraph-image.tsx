import { getTranslations } from "next-intl/server";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { OG_SIZE, renderGazetteCard } from "@/server/og/gazette-card";

export const alt = "The Daily Alibi";
export const size = OG_SIZE;
export const contentType = "image/png";

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

/** Share image for the front page and any page without its own. */
export default async function Image({ params }: { params: Promise<{ locale: string }> }) {
  const { locale: raw } = await params;
  const locale = hasLocale(routing.locales, raw) ? raw : routing.defaultLocale;
  const t = await getTranslations({ locale, namespace: "Home" });
  const tHeader = await getTranslations({ locale, namespace: "Header" });
  const tMeta = await getTranslations({ locale, namespace: "Metadata" });

  return renderGazetteCard({
    brand: tHeader("brand"),
    kicker: t("edition"),
    headline: t("tagline"),
    standfirst: tMeta("description"),
  });
}
