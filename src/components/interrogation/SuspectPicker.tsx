"use client";

import { Portrait } from "@/components/ui/Portrait";
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
      className="border-ink grid grid-cols-2 border-t lg:grid-cols-1"
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
            className={`border-rule min-h-11 border-b p-3 text-left transition-colors odd:border-r lg:odd:border-r-0 ${
              selected ? "bg-ink text-paper" : "hover:bg-card"
            }`}
          >
            <span className="flex items-start gap-3">
              <Portrait
                name=""
                seed={s.id}
                appearance={s.appearance}
                crop="head"
                className="h-11 w-11 shrink-0"
              />
              <span className="min-w-0">
                <span className="block leading-tight font-bold">{s.name}</span>
                <span className={`block text-sm italic ${selected ? "opacity-80" : "text-muted"}`}>
                  {s.role}
                </span>
                <span
                  className={`mt-1 block font-sans text-[11px] font-bold tracking-[0.15em] uppercase ${selected ? "opacity-80" : "text-muted"}`}
                >
                  {t("askedCount", { count: askedCount(s.id) })}
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
