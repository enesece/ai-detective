import { getTranslations } from "next-intl/server";
import { linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto max-w-4xl pt-16">
      <h1 className="font-display text-4xl sm:text-5xl">{t("title")}</h1>
      <Link href="/" className={`${linkCaps} mt-6 inline-block`}>
        ← {t("home")}
      </Link>
    </div>
  );
}
