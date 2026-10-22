import { getTranslations } from "next-intl/server";
import { DeleteMyData } from "@/components/privacy/DeleteMyData";
import { kicker } from "@/components/ui/styles";
import { getAppLocale } from "@/i18n/locale";
import { pageAlternates } from "@/lib/site";

const SECTIONS = ["stored", "ai", "abuse", "services", "notDone"] as const;

export async function generateMetadata() {
  const t = await getTranslations("Privacy");
  return { title: t("title"), alternates: pageAlternates(await getAppLocale(), "/privacy") };
}

export default async function PrivacyPage() {
  const t = await getTranslations("Privacy");

  return (
    <article className="mx-auto max-w-3xl pt-10">
      <p className={`${kicker} text-muted`}>{t("updated")}</p>
      <h1 className="font-display mt-2 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="mt-4 text-xl leading-relaxed italic">{t("intro")}</p>

      {SECTIONS.map((section) => (
        <section key={section} className="border-ink mt-10 border-t pt-4">
          <h2 className="font-display text-2xl">{t(`${section}.heading`)}</h2>
          <p className="mt-3 text-lg leading-relaxed">{t(`${section}.body`)}</p>
        </section>
      ))}

      <section className="border-ink mt-10 border-t-4 border-double pt-4">
        <h2 className="font-display text-2xl">{t("delete.heading")}</h2>
        <p className="mt-3 mb-5 text-lg leading-relaxed">{t("delete.body")}</p>
        <DeleteMyData />
      </section>
    </article>
  );
}
