"use client"; // Error boundaries must be Client Components.

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { buttonPrimary, linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";

/** Shown when a page fails to render (e.g. the database is briefly unreachable). */
export default function ErrorPage({ error, retry }: { error: unknown; retry: () => void }) {
  const t = useTranslations("Error");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-4xl pt-16">
      <h1 className="font-display text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="text-muted mt-4 text-xl italic">{t("body")}</p>
      <div className="mt-8 flex flex-wrap items-center gap-6">
        <button type="button" onClick={() => retry()} className={buttonPrimary}>
          {t("retry")}
        </button>
        <Link href="/" className={linkCaps}>
          ← {t("home")}
        </Link>
      </div>
    </div>
  );
}
