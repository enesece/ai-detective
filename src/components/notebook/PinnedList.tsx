"use client";

import type { ReactNode } from "react";
import { useTranslations } from "next-intl";
import type { EvidenceOption, SuspectOption } from "@/components/interrogation/types";
import { Link } from "@/i18n/navigation";
import { pinKey, type PinnedItem, type PinTarget } from "@/lib/notebook/schema";

type Props = {
  pins: PinnedItem[];
  suspects: SuspectOption[];
  evidence: EvidenceOption[];
  caseNumber: number;
  onUnpin: (target: PinTarget) => void;
};

/**
 * Pins grouped by suspect (first statement, then answers in order) so a lie
 * sits right next to what the suspect said before. Evidence comes last.
 */
export function PinnedList({ pins, suspects, evidence, caseNumber, onUnpin }: Props) {
  const t = useTranslations("Notebook");

  if (pins.length === 0) {
    return <p className="text-muted text-sm italic">{t("empty")}</p>;
  }

  const groups = suspects
    .map((suspect) => ({
      suspect,
      statement: pins.some((p) => p.kind === "statement" && p.suspectId === suspect.id),
      answers: pins
        .flatMap((p) => (p.kind === "answer" && p.suspectId === suspect.id ? [p] : []))
        .sort((a, b) => a.exchangeIndex - b.exchangeIndex),
    }))
    .filter((g) => g.statement || g.answers.length > 0);

  const pinnedEvidence = evidence.filter((e) =>
    pins.some((p) => p.kind === "evidence" && p.evidenceId === e.id),
  );

  return (
    <div className="space-y-5">
      {groups.map(({ suspect, statement, answers }) => (
        <section key={suspect.id}>
          <h4 className="font-display font-bold">{suspect.name}</h4>
          <ul className="mt-1 space-y-2">
            {statement && (
              <PinnedEntry
                label={t("statementLabel")}
                onRemove={() => onUnpin({ kind: "statement", suspectId: suspect.id })}
              >
                <span className="italic">“{suspect.statement}”</span>
              </PinnedEntry>
            )}
            {answers.map((a) => (
              <PinnedEntry key={pinKey(a)} label={a.question} onRemove={() => onUnpin(a)}>
                {a.answer}
              </PinnedEntry>
            ))}
          </ul>
        </section>
      ))}

      {pinnedEvidence.length > 0 && (
        <section>
          <h4 className="font-display font-bold">{t("evidenceGroup")}</h4>
          <ul className="mt-1 space-y-2">
            {pinnedEvidence.map((e) => (
              <PinnedEntry
                key={e.id}
                label={null}
                onRemove={() => onUnpin({ kind: "evidence", evidenceId: e.id })}
              >
                <Link
                  href={`/case/${caseNumber}/evidence/${e.id}`}
                  className="text-accent font-semibold hover:underline"
                >
                  {e.title} →
                </Link>
              </PinnedEntry>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

type EntryProps = { label: string | null; onRemove: () => void; children: ReactNode };

function PinnedEntry({ label, onRemove, children }: EntryProps) {
  const t = useTranslations("Notebook");

  return (
    <li className="border-rule bg-card rounded-md border px-3 py-2 text-sm">
      <div className="flex items-start justify-between gap-2">
        {label && <p className="text-muted text-xs font-semibold">{label}</p>}
        <button
          type="button"
          onClick={onRemove}
          className="text-muted hover:text-accent ml-auto shrink-0 text-xs"
        >
          {t("remove")}
        </button>
      </div>
      <p className="mt-1 leading-relaxed">{children}</p>
    </li>
  );
}
