import { hasLocale } from "next-intl";
import { getLocale } from "next-intl/server";
import { routing, type AppLocale } from "./routing";

/** The current locale, narrowed from `string` to "en" | "tr". Server only. */
export async function getAppLocale(): Promise<AppLocale> {
  const locale = await getLocale();
  return hasLocale(routing.locales, locale) ? locale : routing.defaultLocale;
}
