import type { CaseSecret, PublicBriefing } from "@/lib/case/schema";
import { Bilingual } from "./Bilingual";
import { Section } from "./Section";

type Props = { briefing: PublicBriefing; secret: CaseSecret };

/** The whole case, public and secret halves side by side. Admin pages only. */
export function CaseContent({ briefing, secret }: Props) {
  const place = (id: string) => briefing.locations.find((l) => l.id === id)?.name.en ?? id;
  const name = (id: string | null) =>
    id === null
      ? "—"
      : id === "victim"
        ? briefing.victim.name
        : (briefing.suspects.find((s) => s.id === id)?.name ?? id);
  const killer = name(secret.solution.killerId);
  const motive = briefing.motiveOptions.find((m) => m.id === secret.solution.motiveId);

  return (
    <div className="space-y-6">
      <Section title="Solution">
        <p>
          <strong>Killer:</strong> {killer} · <strong>Motive:</strong>{" "}
          {motive?.label.en ?? secret.solution.motiveId} · <strong>Time of death:</strong>{" "}
          {secret.exactTimeOfDeath} (window {briefing.estimatedTimeOfDeath.from}–
          {briefing.estimatedTimeOfDeath.to}) · <strong>Key evidence:</strong>{" "}
          {secret.solution.keyEvidenceIds.join(", ")}
        </p>
        <h3 className="font-semibold">Method</h3>
        <Bilingual text={secret.solution.method} />
        <h3 className="font-semibold">True story</h3>
        <Bilingual text={secret.solution.trueStory} />
      </Section>

      <Section title="Case file">
        <Bilingual text={briefing.title} />
        <Bilingual text={briefing.setting.place} />
        <p className="text-muted text-sm">{briefing.setting.date}</p>
        <Bilingual text={briefing.setting.summary} />
        <h3 className="font-semibold">Victim: {briefing.victim.name}</h3>
        <Bilingual text={briefing.victim.description} />
        <p className="text-sm">
          <strong>Scene:</strong> {place(briefing.crimeSceneId)} · <strong>Places:</strong>{" "}
          {briefing.locations.map((l) => `${l.name.en} / ${l.name.tr}`).join(", ")}
        </p>
        <h3 className="font-semibold">Motive options</h3>
        <ul className="space-y-1 text-sm">
          {briefing.motiveOptions.map((m) => (
            <li key={m.id}>
              {m.id === secret.solution.motiveId ? "★ " : ""}
              {m.label.en} / {m.label.tr}
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Suspects">
        {briefing.suspects.map((s) => {
          const own = secret.suspects.find((x) => x.suspectId === s.id);
          return (
            <article
              key={s.id}
              className="border-rule space-y-2 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <h3 className="font-semibold">
                {s.name}{" "}
                {s.id === secret.solution.killerId && <span className="text-alert">(killer)</span>}
              </h3>
              <Bilingual text={s.role} />
              <Bilingual text={s.profile} />
              <p className="text-muted text-xs font-semibold uppercase">Initial statement</p>
              <Bilingual text={s.initialStatement} />
              {own && (
                <div className="bg-paper space-y-1 rounded p-3 text-sm">
                  <p>
                    <strong>Personality:</strong> {own.personality}
                  </p>
                  <p>
                    <strong>Claims:</strong> {own.alibi.claimed}
                  </p>
                  <p>
                    <strong>Truth:</strong> {own.alibi.truth}
                  </p>
                  <p className="font-semibold">Knows</p>
                  <ul className="list-disc pl-5">
                    {own.knows.map((k, i) => (
                      <li key={i}>{k}</li>
                    ))}
                  </ul>
                  <p className="font-semibold">Hides</p>
                  <ul className="list-disc pl-5">
                    {own.hides.map((h, i) => (
                      <li key={i}>
                        {h.secret} <span className="text-muted">— reveals: {h.revealWhen}</span>
                      </li>
                    ))}
                  </ul>
                  <p className="font-semibold">Lies</p>
                  <ul className="list-disc pl-5">
                    {own.lies.map((l, i) => (
                      <li key={i}>
                        {l.topic}: “{l.lie}” <span className="text-muted">— truth: {l.truth}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </article>
          );
        })}
      </Section>

      <Section title="Evidence">
        {briefing.evidence.map((e) => {
          const own = secret.evidence.find((x) => x.evidenceId === e.id);
          return (
            <article
              key={e.id}
              className="border-rule space-y-2 border-t pt-3 first:border-t-0 first:pt-0"
            >
              <h3 className="font-semibold">
                {secret.solution.keyEvidenceIds.includes(e.id) ? "🔑 " : ""}
                {e.title.en} / {e.title.tr}{" "}
                <span className="text-muted text-sm">
                  ({e.kind}, {place(e.foundAt)})
                </span>
              </h3>
              <Bilingual text={e.description} />
              {own && (
                <div className="bg-paper rounded p-3 text-sm">
                  <p>
                    <strong>Points to:</strong>{" "}
                    {own.pointsTo.map(name).join(", ") || "nobody (red herring)"}
                  </p>
                  <Bilingual text={own.explanation} />
                </div>
              )}
            </article>
          );
        })}
      </Section>

      <Section title="True timeline">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-muted">
              <tr>
                <th className="pr-3">Time</th>
                <th className="pr-3">Who</th>
                <th className="pr-3">Where</th>
                <th>What</th>
              </tr>
            </thead>
            <tbody>
              {secret.timeline.map((t, i) => (
                <tr key={i} className="border-rule border-t align-top">
                  <td className="py-1 pr-3 font-mono whitespace-nowrap">
                    {t.at}
                    {t.until ? `–${t.until}` : ""}
                  </td>
                  <td className="py-1 pr-3">{name(t.actorId)}</td>
                  <td className="py-1 pr-3">{place(t.locationId)}</td>
                  <td className="py-1">{t.event.en}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="Hints">
        <ol className="list-decimal space-y-2 pl-5">
          {secret.hints.map((h, i) => (
            <li key={i}>
              <Bilingual text={h} />
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
