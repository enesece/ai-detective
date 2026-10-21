"use client";

import { useTranslations } from "next-intl";
import type { SuspectOption } from "./types";

type Props = {
  suspects: SuspectOption[];
  selectedId: string;
  askedCount: (suspectId: string) => number;
  onSelect: (suspectId: string) => void;
};

export function SuspectPicker({ suspects, selectedId, askedCount, onSelect }: Props) {
  const t = useTranslations("Interrogation");

  return (
    <div
      role="tablist"
      aria-label={t("chooseSuspect")}
      className="grid grid-cols-2 gap-2 lg:grid-cols-1"
    >
      {suspects.map((s) => {
        const selected = s.id === selectedId;
        return (
          <button
            key={s.id}
            type="button"
            role="tab"
            aria-selected={selected}
            onClick={() => onSelect(s.id)}
            className={`rounded-lg border p-3 text-left transition-colors ${
              selected ? "border-ink bg-ink text-paper" : "border-rule bg-card hover:border-ink"
            }`}
          >
            <span className="font-display block leading-tight font-bold">{s.name}</span>
            <span className={`block text-xs ${selected ? "opacity-80" : "text-muted"}`}>
              {s.role}
            </span>
            <span className={`mt-1 block text-xs ${selected ? "opacity-80" : "text-muted"}`}>
              {t("askedCount", { count: askedCount(s.id) })}
            </span>
          </button>
        );
      })}
    </div>
  );
}
