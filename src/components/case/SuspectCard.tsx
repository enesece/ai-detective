import { getTranslations } from "next-intl/server";
import { localize } from "@/lib/case/localize";
import type { Locale, PublicSuspect } from "@/lib/case/schema";

type Props = { suspect: PublicSuspect; locale: Locale };

export async function SuspectCard({ suspect, locale }: Props) {
  const t = await getTranslations("Case");

  return (
    <article className="border-rule bg-card flex flex-col rounded-lg border p-5">
      <h3 className="font-display text-xl font-bold">{suspect.name}</h3>
      <p className="text-accent text-sm font-semibold">{localize(suspect.role, locale)}</p>
      <p className="text-muted mt-3 text-sm leading-relaxed">{localize(suspect.profile, locale)}</p>
      <figure className="border-rule mt-4 border-t pt-4">
        <figcaption className="text-muted text-xs font-semibold tracking-widest uppercase">
          {t("statement")}
        </figcaption>
        <blockquote className="mt-1 leading-relaxed italic">
          “{localize(suspect.initialStatement, locale)}”
        </blockquote>
      </figure>
    </article>
  );
}
