import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PageFallback } from "@/components/ui/PageFallback";
import { getTranslations } from "next-intl/server";
import { EvidencePinButton } from "@/components/notebook/EvidencePinButton";
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
      <Link
        href={`/case/${publicCase.caseNumber}`}
        className="text-accent text-sm font-semibold hover:underline"
      >
        ← {t("backToCase")}
      </Link>

      <div className="border-rule bg-card mt-6 rounded-lg border p-6 sm:p-8">
        <div className="flex items-start justify-between gap-3">
          <p className="text-muted text-xs font-semibold tracking-widest uppercase">
            {tKind(evidence.kind)}
            {place && ` · ${t("foundAt", { place: localize(place.name, locale) })}`}
          </p>
          <EvidencePinButton caseNumber={publicCase.caseNumber} evidenceId={evidence.id} />
        </div>
        <h1 className="font-display mt-2 text-3xl font-bold">{localize(evidence.title, locale)}</h1>
        <p className="mt-6 text-lg leading-relaxed whitespace-pre-line">
          {localize(evidence.description, locale)}
        </p>
      </div>

      <p className="text-muted mt-4 text-sm">{t("evidenceHint")}</p>
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
