import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { HeaderWordmark, Wordmark } from "./HeaderWordmark";
import { LocaleSwitcher } from "./ui/LocaleSwitcher";

/*
 * The thin strip above every page, like a newspaper's running head.
 * The parts that read the URL sit in <Suspense>: pages with runtime-only
 * params (e.g. /admin/cases/[id]) can't know the URL while prerendering.
 */
export async function SiteHeader() {
  const t = await getTranslations("Header");

  return (
    <header className="mx-auto w-full max-w-6xl px-4">
      <div className="border-ink flex min-h-16 items-center justify-between gap-x-3 border-b-4 border-double py-2">
        <div className="flex items-center gap-x-4 sm:gap-x-6">
          <Suspense fallback={<Wordmark brand={t("brand")} />}>
            <HeaderWordmark brand={t("brand")} />
          </Suspense>
          <nav
            aria-label={t("nav")}
            className="flex gap-5 font-sans text-xs font-bold tracking-[0.1em] uppercase sm:text-[13px] sm:tracking-[0.15em]"
          >
            {/* On phones the wordmark already links home; this keeps the bar on one line. */}
            <Link href="/" className="hover:text-accent hidden sm:inline">
              {t("today")}
            </Link>
            <Link href="/archive" className="text-muted hover:text-accent">
              {t("archive")}
            </Link>
          </nav>
        </div>
        <Suspense fallback={<span className="h-11 w-24" aria-hidden />}>
          <LocaleSwitcher />
        </Suspense>
      </div>
    </header>
  );
}
