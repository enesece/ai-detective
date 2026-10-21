"use client";

import { useTranslations } from "next-intl";
import type { PlayedCase } from "./usePlayerRecord";

/** "Solved · 230", "Unsolved", "In progress" or nothing for a case the player hasn't opened. */
export function CaseStatusBadge({ game }: { game: PlayedCase | undefined }) {
  const t = useTranslations("Player");
  if (!game) return null;
  if (!game.finished) {
    return (
      <span className="font-sans text-[11px] font-bold uppercase tracking-[0.15em] border px-2 py-1 border-muted text-muted">
        {t("inProgress")}
      </span>
    );
  }
  return game.solved ? (
    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.15em] border px-2 py-1 border-accent bg-accent text-paper">
      {t("solved", { score: game.score ?? 0 })}
    </span>
  ) : (
    <span className="font-sans text-[11px] font-bold uppercase tracking-[0.15em] border px-2 py-1 border-alert text-alert">
      {t("unsolved")}
    </span>
  );
}
