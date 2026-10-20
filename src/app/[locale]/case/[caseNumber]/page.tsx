import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { CaseHeader } from "@/components/case/CaseHeader";
import { EvidenceCard } from "@/components/case/EvidenceCard";
import { SuspectCard } from "@/components/case/SuspectCard";
import { VictimPanel } from "@/components/case/VictimPanel";
import { getAppLocale } from "@/i18n/locale";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { parseCaseNumber } from "./case-number";

// Prerender every known case at build time.
export function generateStaticParams() {
  return listCaseNumbers().map((n) => ({ caseNumber: String(n) }));
}

export default async function CasePage({ params }: PageProps<"/[locale]/case/[caseNumber]">) {
  const { caseNumber: raw } = await params;
  const caseNumber = parseCaseNumber(raw);
  const publicCase = caseNumber === null ? null : getPublicCase(caseNumber);
  if (!publicCase) notFound();

  const t = await getTranslations("Case");
  const locale = await getAppLocale();
  const { briefing } = publicCase;
  const placeName = (id: string) => briefing.locations.find((l) => l.id === id)?.name;

  return (
    <article>
      <CaseHeader publicCase={publicCase} locale={locale} />
      <VictimPanel briefing={briefing} locale={locale} />

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">{t("suspects")}</h2>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          {briefing.suspects.map((suspect) => (
            <SuspectCard key={suspect.id} suspect={suspect} locale={locale} />
          ))}
        </div>
      </section>

      <section className="mt-12">
        <h2 className="font-display text-2xl font-bold">{t("evidence")}</h2>
        <p className="text-muted mt-1 text-sm">{t("evidenceHint")}</p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {briefing.evidence.map((evidence) => (
            <EvidenceCard
              key={evidence.id}
              evidence={evidence}
              placeName={placeName(evidence.foundAt)}
              caseNumber={publicCase.caseNumber}
              locale={locale}
            />
          ))}
        </div>
      </section>
    </article>
  );
}
