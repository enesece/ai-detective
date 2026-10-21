import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { AccusationForm } from "@/components/game/AccusationForm";
import { PageFallback } from "@/components/ui/PageFallback";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { toCaseOptions } from "@/lib/case/options";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { parseCaseNumber } from "../case-number";

export async function generateStaticParams() {
  return (await listCaseNumbers()).map((n) => ({ caseNumber: String(n) }));
}

async function AccuseContent({
  params,
}: {
  params: PageProps<"/[locale]/case/[caseNumber]/accuse">["params"];
}) {
  const { caseNumber: raw } = await params;
  const caseNumber = parseCaseNumber(raw);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  if (!publicCase) notFound();

  const t = await getTranslations("Accusation");
  const tCase = await getTranslations("Case");
  const locale = await getAppLocale();

  return (
    <div className="mx-auto max-w-4xl pt-10">
      <Link
        href={`/case/${publicCase.caseNumber}/interrogate`}
        className="text-accent text-sm font-semibold hover:underline"
      >
        ← {t("back")}
      </Link>
      <p className="text-accent mt-4 text-sm font-semibold tracking-widest uppercase">
        {tCase("caseNumber", { number: publicCase.caseNumber })} ·{" "}
        {localize(publicCase.briefing.title, locale)}
      </p>
      <h1 className="font-display mt-1 mb-8 text-3xl font-bold">{t("title")}</h1>
      {/* Only public, translated options cross to the client. */}
      <AccusationForm
        caseNumber={publicCase.caseNumber}
        options={toCaseOptions(publicCase.briefing, locale)}
      />
    </div>
  );
}

// Reading `params` happens inside <Suspense>, so navigation can show the shell instantly.
export default function AccusePage({ params }: PageProps<"/[locale]/case/[caseNumber]/accuse">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <AccuseContent params={params} />
    </Suspense>
  );
}
