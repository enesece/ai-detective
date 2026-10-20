import { getFormatter, getTranslations } from "next-intl/server";
import { localize } from "@/lib/case/localize";
import type { Locale, PublicCase } from "@/lib/case/schema";

type Props = { publicCase: PublicCase; locale: Locale };

export async function CaseHeader({ publicCase, locale }: Props) {
  const t = await getTranslations("Case");
  const format = await getFormatter();
  const { briefing } = publicCase;

  return (
    <header className="pt-10 pb-8">
      <p className="text-accent text-sm font-semibold tracking-widest uppercase">
        {t("caseNumber", { number: publicCase.caseNumber })} ·{" "}
        {t(`difficulty.${publicCase.difficulty}`)}
      </p>
      <h1 className="font-display mt-2 text-4xl font-bold sm:text-5xl">
        {localize(briefing.title, locale)}
      </h1>
      <p className="text-muted mt-2">
        {localize(briefing.setting.place, locale)} ·{" "}
        {format.dateTime(new Date(briefing.setting.date), { dateStyle: "long" })}
      </p>
      <p className="mt-6 text-lg leading-relaxed">{localize(briefing.setting.summary, locale)}</p>
    </header>
  );
}
