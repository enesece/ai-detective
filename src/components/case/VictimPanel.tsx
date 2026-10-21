import { getTranslations } from "next-intl/server";
import { kicker, label } from "@/components/ui/styles";
import { localize } from "@/lib/case/localize";
import type { Locale, PublicBriefing } from "@/lib/case/schema";

type Props = { briefing: PublicBriefing; locale: Locale };

/** The victim and the coroner's facts, boxed between ink rules. */
export async function VictimPanel({ briefing, locale }: Props) {
  const t = await getTranslations("Case");
  const scene = briefing.locations.find((l) => l.id === briefing.crimeSceneId);
  const { from, to } = briefing.estimatedTimeOfDeath;

  return (
    <section className="border-ink grid gap-6 border-y py-6 sm:grid-cols-[2fr_1fr]">
      <div>
        <h2 className={kicker}>{t("victim")}</h2>
        <p className="font-display mt-2 text-3xl">{briefing.victim.name}</p>
        <p className="mt-2 text-lg leading-relaxed">
          {localize(briefing.victim.description, locale)}
        </p>
      </div>
      <dl className="border-ink space-y-4 border-t pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
        <div>
          <dt className={label}>{t("scene")}</dt>
          <dd className="mt-1 text-lg">{scene ? localize(scene.name, locale) : "—"}</dd>
        </div>
        <div>
          <dt className={label}>{t("timeOfDeath")}</dt>
          <dd className="mt-1 text-lg">{t("timeWindow", { from, to })}</dd>
        </div>
      </dl>
    </section>
  );
}
