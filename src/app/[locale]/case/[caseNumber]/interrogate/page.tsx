import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFallback } from "@/components/ui/PageFallback";
import { getTranslations } from "next-intl/server";
import { InterrogationRoom } from "@/components/interrogation/InterrogationRoom";
import type { EvidenceOption, SuspectOption } from "@/components/interrogation/types";
import { linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { parseCaseNumber } from "../case-number";

export async function generateStaticParams() {
  return (await listCaseNumbers()).map((n) => ({ caseNumber: String(n) }));
}

async function InterrogateContent({
  params,
}: {
  params: PageProps<"/[locale]/case/[caseNumber]/interrogate">["params"];
}) {
  const { caseNumber: raw } = await params;
  const caseNumber = parseCaseNumber(raw);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  if (!publicCase) notFound();

  const t = await getTranslations("Interrogation");
  const tCase = await getTranslations("Case");
  const locale = await getAppLocale();

  // Server → Client boundary: pass plain, already-translated, public fields only.
  const suspects: SuspectOption[] = publicCase.briefing.suspects.map((s) => ({
    id: s.id,
    name: s.name,
    role: localize(s.role, locale),
    statement: localize(s.initialStatement, locale),
  }));
  const evidence: EvidenceOption[] = publicCase.briefing.evidence.map((e) => ({
    id: e.id,
    title: localize(e.title, locale),
  }));

  return (
    <div className="pt-10">
      <Link href={`/case/${publicCase.caseNumber}`} className={linkCaps}>
        ← {tCase("backToCase")}
      </Link>
      <h1 className="font-display mt-4 text-4xl sm:text-5xl">{t("title")}</h1>
      <p className="text-muted mt-2 mb-6 text-lg italic">{t("intro")}</p>
      <InterrogationRoom
        caseNumber={publicCase.caseNumber}
        suspects={suspects}
        evidence={evidence}
      />
    </div>
  );
}

// Reading `params` happens inside <Suspense>, so navigation can show the shell instantly.
export default function InterrogatePage({
  params,
}: PageProps<"/[locale]/case/[caseNumber]/interrogate">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <InterrogateContent params={params} />
    </Suspense>
  );
}
