"use client";

import { useTranslations } from "next-intl";
import { PinButton } from "@/components/notebook/PinButton";
import type { SuspectOption } from "./types";

type Props = { suspect: SuspectOption; pinned: boolean; onTogglePin: () => void };

/** The suspect's first statement, kept in view so answers can be compared with it. */
export function StatementCard({ suspect, pinned, onTogglePin }: Props) {
  const t = useTranslations("Interrogation");

  return (
    <figure className="border-accent/40 bg-card mb-5 rounded-lg border border-dashed px-4 py-3">
      <figcaption className="flex items-center justify-between gap-2">
        <span className="text-accent text-xs font-semibold tracking-widest uppercase">
          {t("initialStatement")}
        </span>
        <PinButton pinned={pinned} onToggle={onTogglePin} />
      </figcaption>
      <blockquote className="mt-1 leading-relaxed italic">“{suspect.statement}”</blockquote>
    </figure>
  );
}
