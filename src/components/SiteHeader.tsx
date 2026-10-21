import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { LocaleSwitcher } from "./ui/LocaleSwitcher";

export async function SiteHeader() {
  const t = await getTranslations("Header");

  return (
    <header className="border-rule mx-auto flex w-full max-w-6xl items-center justify-between border-b px-4 py-4">
      <Link href="/" className="font-display text-xl font-bold tracking-tight">
        {t("brand")}
      </Link>
      {/* It reads the URL (usePathname), which pages with runtime-only params
          (e.g. /admin/cases/[id]) can't know while prerendering. */}
      <Suspense fallback={<span className="h-7 w-16" aria-hidden />}>
        <LocaleSwitcher />
      </Suspense>
    </header>
  );
}
