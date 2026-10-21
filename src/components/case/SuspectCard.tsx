import { getTranslations } from "next-intl/server";
import { Portrait } from "@/components/ui/Portrait";
import { label } from "@/components/ui/styles";
import { localize } from "@/lib/case/localize";
import type { Locale, PublicSuspect } from "@/lib/case/schema";

type Props = { suspect: PublicSuspect; locale: Locale };

/** One "person of interest" column: portrait, name, role, bio and first statement. */
export async function SuspectCard({ suspect, locale }: Props) {
  const t = await getTranslations("Case");

  return (
    <article className="flex flex-col">
      <Portrait
        name={suspect.name}
        className="aspect-[5/4] w-full max-sm:aspect-auto max-sm:h-28"
      />
      <h3 className="mt-4 text-xl font-bold">{suspect.name}</h3>
      <p className={`${label} mt-1`}>{localize(suspect.role, locale)}</p>
      <p className="mt-3 leading-relaxed">{localize(suspect.profile, locale)}</p>
      <figure className="border-rule mt-4 border-t pt-3">
        <figcaption className={label}>{t("statement")}</figcaption>
        <blockquote className="mt-2 leading-relaxed italic">
          “{localize(suspect.initialStatement, locale)}”
        </blockquote>
      </figure>
    </article>
  );
}
