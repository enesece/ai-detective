import { routing } from "@/i18n/routing";

/**
 * The public address of the site, for absolute links in metadata, the sitemap
 * and share images. Vercel sets VERCEL_PROJECT_PRODUCTION_URL at build and run time.
 */
export const SITE_URL = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

/**
 * Canonical URL plus links to the same page in every language (hreflang).
 * `path` is the part after the locale, e.g. "/case/2" or "" for the home page.
 */
export function pageAlternates(locale: string, path: string) {
  const languages: Record<string, string> = Object.fromEntries(
    routing.locales.map((l) => [l, `/${l}${path}`]),
  );
  languages["x-default"] = `/${routing.defaultLocale}${path}`;
  return { canonical: `/${locale}${path}`, languages };
}
