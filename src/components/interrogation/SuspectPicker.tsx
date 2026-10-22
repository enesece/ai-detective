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
      className="border-rule lg:border-ink -mx-4 flex gap-1 overflow-x-auto border-b px-4 lg:mx-0 lg:grid lg:grid-cols-1 lg:gap-0 lg:overflow-visible lg:border-t lg:border-b-0 lg:px-0"
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
            // Phones: a light tab strip, the chosen one underlined in ink.
            // Wide screens: a list, the chosen one inked in.
            className={`lg:border-rule min-h-11 w-40 shrink-0 border-b-[3px] px-2 py-2 text-left transition-colors lg:w-auto lg:border-b lg:p-3 ${
              selected ? "border-ink lg:bg-ink lg:text-paper" : "hover:bg-card border-transparent"
            }`}
          >
            <span className="flex items-start gap-3">
              <Portrait
                name=""
                seed={s.id}
                appearance={s.appearance}
                crop="head"
                className="h-10 w-10 shrink-0 lg:h-11 lg:w-11"
              />
              <span className="min-w-0">
                <span className="block leading-tight font-bold">{s.name}</span>
                <span
                  className={`hidden text-sm italic lg:block ${selected ? "lg:opacity-80" : "text-muted"}`}
                >
                  {s.role}
                </span>
                <span
                  className={`mt-1 block font-sans text-[11px] font-bold tracking-[0.08em] uppercase lg:tracking-[0.15em] ${selected ? "lg:opacity-80" : "text-muted"}`}
                >
                  <span className="lg:hidden">{t("askedShort", { count: askedCount(s.id) })}</span>
                  <span className="max-lg:hidden">
                    {t("askedCount", { count: askedCount(s.id) })}
                  </span>
                </span>
              </span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
