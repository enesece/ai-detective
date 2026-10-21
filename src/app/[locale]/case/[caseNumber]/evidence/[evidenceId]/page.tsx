import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFallback } from "@/components/ui/PageFallback";
import { getTranslations } from "next-intl/server";
import { EvidencePinButton } from "@/components/notebook/EvidencePinButton";
import { kicker, linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { parseCaseNumber } from "../../case-number";

export async function generateStaticParams() {
  const cases = await Promise.all((await listCaseNumbers()).map((n) => getPublicCase(n)));
  return cases.flatMap((c) =>
    (c?.briefing.evidence ?? []).map((e) => ({
      caseNumber: String(c?.caseNumber),
      evidenceId: e.id,
    })),
  );
}

async function EvidenceContent({
  params,
}: {
  params: PageProps<"/[locale]/case/[caseNumber]/evidence/[evidenceId]">["params"];
}) {
  const { caseNumber: raw, evidenceId } = await params;
  const caseNumber = parseCaseNumber(raw);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  const evidence = publicCase?.briefing.evidence.find((e) => e.id === evidenceId);
  if (!publicCase || !evidence) notFound();

  const t = await getTranslations("Case");
  const tKind = await getTranslations("EvidenceKind");
  const locale = await getAppLocale();
  const place = publicCase.briefing.locations.find((l) => l.id === evidence.foundAt);

  return (
    <article className="mx-auto max-w-4xl pt-10">
      <Link href={`/case/${publicCase.caseNumber}`} className={linkCaps}>
        ← {t("backToCase")}
      </Link>

      <div className="border-ink bg-card mt-6 border-t-[3px] p-6 shadow-[0_1px_0_var(--color-rule)] sm:p-10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <p className={`${kicker} text-muted`}>
            {tKind(evidence.kind)}
            {place && ` · ${t("foundAt", { place: localize(place.name, locale) })}`}
          </p>
          <EvidencePinButton caseNumber={publicCase.caseNumber} evidenceId={evidence.id} />
        </div>
        <h1 className="font-display mt-3 text-4xl sm:text-5xl">
          {localize(evidence.title, locale)}
        </h1>
        <p className="first-letter:font-display mt-6 text-lg leading-relaxed whitespace-pre-line first-letter:float-left first-letter:pt-1 first-letter:pr-2 first-letter:text-6xl first-letter:leading-[0.8]">
          {localize(evidence.description, locale)}
        </p>
      </div>

      <p className="text-muted mt-4 italic">{t("evidenceHint")}</p>
    </article>
  );
}

// Reading `params` happens inside <Suspense>, so navigation can show the shell instantly.
export default function EvidencePage({
  params,
}: PageProps<"/[locale]/case/[caseNumber]/evidence/[evidenceId]">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <EvidenceContent params={params} />
    </Suspense>
  );
}
