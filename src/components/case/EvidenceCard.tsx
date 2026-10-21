import { getTranslations } from "next-intl/server";
import { kicker, linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/case/localize";
import type { Locale, LocalizedText, PublicEvidence } from "@/lib/case/schema";

type Props = {
  evidence: PublicEvidence;
  placeName: LocalizedText | undefined;
  caseNumber: number;
  locale: Locale;
};

/** An evidence "clipping": the whole card is the link to the evidence page. */
export async function EvidenceCard({ evidence, placeName, caseNumber, locale }: Props) {
  const t = await getTranslations("Case");
  const tKind = await getTranslations("EvidenceKind");

  return (
    <Link
      href={`/case/${caseNumber}/evidence/${evidence.id}`}
      className="border-ink bg-card group flex flex-col border-t-[3px] p-5 shadow-[0_1px_0_var(--color-rule)] transition-colors hover:bg-white"
    >
      <span className={`${kicker} text-muted`}>{tKind(evidence.kind)}</span>
      <span className="mt-2 text-xl font-bold">{localize(evidence.title, locale)}</span>
      {placeName && (
        <span className="text-muted mt-1 italic">
          {t("foundAt", { place: localize(placeName, locale) })}
        </span>
      )}
      <span className={`${linkCaps} mt-4 group-hover:underline`}>{t("examine")} →</span>
    </Link>
  );
}
