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
      <LocaleSwitcher />
    </header>
  );
}
