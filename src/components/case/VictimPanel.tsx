import { getTranslations } from "next-intl/server";
import { localize } from "@/lib/case/localize";
import type { Locale, PublicBriefing } from "@/lib/case/schema";

type Props = { briefing: PublicBriefing; locale: Locale };

export async function VictimPanel({ briefing, locale }: Props) {
  const t = await getTranslations("Case");
  const scene = briefing.locations.find((l) => l.id === briefing.crimeSceneId);
  const { from, to } = briefing.estimatedTimeOfDeath;

  return (
    <section className="border-rule bg-card grid gap-6 rounded-lg border p-6 sm:grid-cols-[2fr_1fr]">
      <div>
        <h2 className="text-muted text-xs font-semibold tracking-widest uppercase">
          {t("victim")}
        </h2>
        <p className="font-display mt-1 text-2xl font-bold">{briefing.victim.name}</p>
        <p className="mt-2 leading-relaxed">{localize(briefing.victim.description, locale)}</p>
      </div>
      <dl className="border-rule space-y-4 border-t pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-6">
        <div>
          <dt className="text-muted text-xs font-semibold tracking-widest uppercase">
            {t("scene")}
          </dt>
          <dd className="mt-1">{scene ? localize(scene.name, locale) : "—"}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs font-semibold tracking-widest uppercase">
            {t("timeOfDeath")}
          </dt>
          <dd className="mt-1">{t("timeWindow", { from, to })}</dd>
        </div>
      </dl>
    </section>
  );
}
