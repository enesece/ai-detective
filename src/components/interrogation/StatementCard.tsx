"use client";

import { kicker } from "@/components/ui/styles";
import { useTranslations } from "next-intl";
import { PinButton } from "@/components/notebook/PinButton";
import type { SuspectOption } from "./types";

type Props = { suspect: SuspectOption; pinned: boolean; onTogglePin: () => void };

/** The suspect's first statement, kept in view so answers can be compared with it. */
export function StatementCard({ suspect, pinned, onTogglePin }: Props) {
  const t = useTranslations("Interrogation");

  return (
    <figure className="border-ink bg-card mb-4 border-l-[3px] px-4 py-3">
      <figcaption className="flex items-center justify-between gap-2">
        <span className={`${kicker} text-accent`}>{t("initialStatement")}</span>
        <PinButton pinned={pinned} onToggle={onTogglePin} />
      </figcaption>
      <blockquote className="mt-2 text-lg leading-relaxed italic">“{suspect.statement}”</blockquote>
    </figure>
  );
}
