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
    // Phones: a small portrait beside name and role, the text below. Wider: a portrait column.
    <article className="grid grid-cols-[5.5rem_1fr] content-start gap-x-4 sm:flex sm:flex-col">
      <Portrait
        name={suspect.name}
        seed={suspect.id}
        appearance={suspect.appearance}
        className="row-span-2 aspect-4/5 w-full"
      />
      <h3 className="self-end text-xl leading-tight font-bold sm:mt-4 sm:self-auto">
        {suspect.name}
      </h3>
      <p className={`${label} mt-1 self-start sm:self-auto`}>{localize(suspect.role, locale)}</p>
      <p className="col-span-2 mt-3 leading-relaxed">{localize(suspect.profile, locale)}</p>
      <figure className="border-rule col-span-2 mt-4 border-t pt-3">
        <figcaption className={label}>{t("statement")}</figcaption>
        <blockquote className="mt-2 leading-relaxed italic">
          “{localize(suspect.initialStatement, locale)}”
        </blockquote>
      </figure>
    </article>
  );
}
