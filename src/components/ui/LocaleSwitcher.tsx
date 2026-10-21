"use client";

import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing, type AppLocale } from "@/i18n/routing";

const LABELS: Record<AppLocale, string> = { en: "EN", tr: "TR" };

/** Client Component: it reacts to clicks, which Server Components cannot do. */
export function LocaleSwitcher() {
  const t = useTranslations("Header");
  const current = useLocale();
  const pathname = usePathname(); // e.g. "/case/1", without the locale prefix
  const router = useRouter();

  return (
    <nav aria-label={t("language")} className="flex gap-1 font-sans text-[13px] tracking-[0.1em]">
      {routing.locales.map((locale) => (
        <button
          key={locale}
          type="button"
          onClick={() => router.replace(pathname, { locale })}
          aria-current={locale === current ? "true" : undefined}
          className="border-ink min-h-11 min-w-11 border px-2 font-bold hover:bg-ink hover:text-paper aria-[current]:bg-ink aria-[current]:text-paper"
        >
          {LABELS[locale]}
        </button>
      ))}
    </nav>
  );
}
