import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFallback } from "@/components/ui/PageFallback";
import { getTranslations } from "next-intl/server";
import { CaseHeader } from "@/components/case/CaseHeader";
import { EvidenceCard } from "@/components/case/EvidenceCard";
import { SuspectCard } from "@/components/case/SuspectCard";
import { VictimPanel } from "@/components/case/VictimPanel";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { buttonOutline, buttonPrimary } from "@/components/ui/styles";
import { getAppLocale } from "@/i18n/locale";
import { Link } from "@/i18n/navigation";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { parseCaseNumber } from "./case-number";
import { caseMetadata } from "./case-metadata";

// Prerender every known case at build time.
export async function generateStaticParams() {
  return (await listCaseNumbers()).map((n) => ({ caseNumber: String(n) }));
}

export async function generateMetadata({ params }: PageProps<"/[locale]/case/[caseNumber]">) {
  const { caseNumber } = await params;
  return caseMetadata(caseNumber);
}

async function CaseContent({
  params,
}: {
  params: PageProps<"/[locale]/case/[caseNumber]">["params"];
}) {
  const { caseNumber: raw } = await params;
  const caseNumber = parseCaseNumber(raw);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  if (!publicCase) notFound();

  const t = await getTranslations("Case");
  const tInterrogation = await getTranslations("Interrogation");
  const locale = await getAppLocale();
  const { briefing } = publicCase;
  const placeName = (id: string) => briefing.locations.find((l) => l.id === id)?.name;

  return (
    <article className="mx-auto max-w-5xl">
      <CaseHeader publicCase={publicCase} locale={locale} />
      <VictimPanel briefing={briefing} locale={locale} />

      <section className="mt-12" aria-labelledby="suspects-h">
        <SectionHeading id="suspects-h">{t("suspects")}</SectionHeading>
        <div className="divide-rule grid gap-10 sm:grid-cols-2 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:[&>*]:px-5">
          {briefing.suspects.map((suspect) => (
            <SuspectCard key={suspect.id} suspect={suspect} locale={locale} />
          ))}
        </div>
      </section>

      <section className="mt-14" aria-labelledby="evidence-h">
        <SectionHeading id="evidence-h" aside={t("evidenceHint")}>
          {t("evidence")}
        </SectionHeading>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
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

      <div className="border-ink mt-14 flex flex-wrap items-center justify-center gap-4 border-t-4 border-double pt-8">
        <Link href={`/case/${publicCase.caseNumber}/interrogate`} className={buttonPrimary}>
          {tInterrogation("startInterrogation")} →
        </Link>
        <Link href={`/case/${publicCase.caseNumber}/accuse`} className={buttonOutline}>
          {tInterrogation("accuse")}
        </Link>
      </div>
    </article>
  );
}

// Reading `params` happens inside <Suspense>, so navigation can show the shell instantly.
export default function CasePage({ params }: PageProps<"/[locale]/case/[caseNumber]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <CaseContent params={params} />
    </Suspense>
  );
}
