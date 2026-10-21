import { localize } from "./localize";
import type { Locale, PublicBriefing } from "./schema";

/**
 * The choices a player sees for a case, already translated. Built from the
 * public briefing only, so it is safe to pass to Client Components.
 */
export type CaseOptions = {
  suspects: { id: string; name: string; role: string }[];
  motives: { id: string; label: string }[];
  evidence: { id: string; title: string }[];
};

export function toCaseOptions(briefing: PublicBriefing, locale: Locale): CaseOptions {
  return {
    suspects: briefing.suspects.map((s) => ({
      id: s.id,
      name: s.name,
      role: localize(s.role, locale),
    })),
    motives: briefing.motiveOptions.map((m) => ({ id: m.id, label: localize(m.label, locale) })),
    evidence: briefing.evidence.map((e) => ({ id: e.id, title: localize(e.title, locale) })),
  };
}
