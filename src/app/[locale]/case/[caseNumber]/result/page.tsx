import { Suspense } from "react";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ResultView } from "@/components/game/ResultView";
import { PageFallback } from "@/components/ui/PageFallback";
import { kicker, linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";
import { getAppLocale } from "@/i18n/locale";
import { localize } from "@/lib/case/localize";
import { toCaseOptions } from "@/lib/case/options";
import { getPublicCase, listCaseNumbers } from "@/server/cases/repository";
import { parseCaseNumber } from "../case-number";

export async function generateStaticParams() {
  return (await listCaseNumbers()).map((n) => ({ caseNumber: String(n) }));
}

async function ResultContent({
  params,
}: {
  params: PageProps<"/[locale]/case/[caseNumber]/result">["params"];
}) {
  const { caseNumber: raw } = await params;
  const caseNumber = parseCaseNumber(raw);
  const publicCase = caseNumber === null ? null : await getPublicCase(caseNumber);
  if (!publicCase) notFound();

  const t = await getTranslations("Result");
  const tCase = await getTranslations("Case");
  const locale = await getAppLocale();

  return (
    <div className="mx-auto max-w-4xl pt-10">
      <Link href={`/case/${publicCase.caseNumber}/interrogate`} className={linkCaps}>
        ← {t("back")}
      </Link>
      <p className={`${kicker} text-accent mt-6`}>
        {tCase("caseNumber", { number: publicCase.caseNumber })} ·{" "}
        {localize(publicCase.briefing.title, locale)}
      </p>
      <h1 className="font-display mt-2 mb-8 text-4xl sm:text-5xl">{t("title")}</h1>
      {/* Only public, translated options cross to the client. */}
      <ResultView
        caseNumber={publicCase.caseNumber}
        options={toCaseOptions(publicCase.briefing, locale)}
      />
    </div>
  );
}

// Reading `params` happens inside <Suspense>, so navigation can show the shell instantly.
export default function ResultPage({ params }: PageProps<"/[locale]/case/[caseNumber]/result">) {
  return (
    <Suspense fallback={<PageFallback />}>
      <ResultContent params={params} />
    </Suspense>
  );
}
