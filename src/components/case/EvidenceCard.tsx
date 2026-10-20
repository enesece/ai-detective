import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { localize } from "@/lib/case/localize";
import type { Locale, LocalizedText, PublicEvidence } from "@/lib/case/schema";

type Props = {
  evidence: PublicEvidence;
  placeName: LocalizedText | undefined;
  caseNumber: number;
  locale: Locale;
};

export async function EvidenceCard({ evidence, placeName, caseNumber, locale }: Props) {
  const t = await getTranslations("Case");
  const tKind = await getTranslations("EvidenceKind");

  return (
    <Link
      href={`/case/${caseNumber}/evidence/${evidence.id}`}
      className="border-rule bg-card group hover:border-accent flex flex-col rounded-lg border p-5 transition-colors"
    >
      <span className="text-muted text-xs font-semibold tracking-widest uppercase">
        {tKind(evidence.kind)}
      </span>
      <span className="font-display mt-1 text-lg font-bold">
        {localize(evidence.title, locale)}
      </span>
      {placeName && (
        <span className="text-muted mt-1 text-sm">
          {t("foundAt", { place: localize(placeName, locale) })}
        </span>
      )}
      <span className="text-accent mt-3 text-sm font-semibold group-hover:underline">
        {t("examine")} →
      </span>
    </Link>
  );
}
