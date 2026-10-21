import { getFormatter, getTranslations } from "next-intl/server";
import { kicker } from "@/components/ui/styles";
import { localize } from "@/lib/case/localize";
import type { Locale, PublicCase } from "@/lib/case/schema";

type Props = { publicCase: PublicCase; locale: Locale };

export async function CaseHeader({ publicCase, locale }: Props) {
  const t = await getTranslations("Case");
  const format = await getFormatter();
  const { briefing } = publicCase;

  return (
    <header className="pt-10 pb-8">
      <p className={`${kicker} text-accent`}>
        {t("caseNumber", { number: publicCase.caseNumber })} ·{" "}
        {t(`difficulty.${publicCase.difficulty}`)}
      </p>
      <h1 className="font-display mt-3 text-5xl leading-[1.02] sm:text-6xl">
        {localize(briefing.title, locale)}
      </h1>
      <p className="text-muted mt-3 text-xl italic">
        {localize(briefing.setting.place, locale)} ·{" "}
        {format.dateTime(new Date(`${briefing.setting.date}T00:00:00Z`), {
          dateStyle: "long",
          timeZone: "UTC",
        })}
      </p>
      <p className="first-letter:font-display mt-6 text-lg leading-relaxed text-pretty first-letter:float-left first-letter:pt-1 first-letter:pr-2 first-letter:text-6xl first-letter:leading-[0.8] md:columns-2 md:gap-8 md:text-justify md:hyphens-auto">
        {localize(briefing.setting.summary, locale)}
      </p>
    </header>
  );
}
