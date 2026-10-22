import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

/** Bottom rule on every page: the privacy page and archive, like a newspaper's imprint. */
export async function SiteFooter() {
  const t = await getTranslations("Footer");

  return (
    <footer className="mx-auto w-full max-w-6xl px-4 pb-10">
      <div className="border-ink text-muted flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-t-4 border-double pt-4 font-sans text-xs">
        <p>{t("note")}</p>
        <nav className="flex gap-5 font-bold tracking-[0.15em] uppercase">
          <Link href="/archive" className="hover:text-accent">
            {t("archive")}
          </Link>
          <Link href="/privacy" className="hover:text-accent">
            {t("privacy")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
