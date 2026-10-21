import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";

export default async function NotFound() {
  const t = await getTranslations("NotFound");

  return (
    <div className="mx-auto max-w-4xl pt-16">
      <h1 className="font-display text-3xl font-bold">{t("title")}</h1>
      <Link href="/" className="text-accent mt-4 inline-block font-semibold hover:underline">
        ← {t("home")}
      </Link>
    </div>
  );
}
