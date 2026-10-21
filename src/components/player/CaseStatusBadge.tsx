"use client";

import { useTranslations } from "next-intl";
import type { PlayedCase } from "./usePlayerRecord";

/** "Solved · 230", "Unsolved", "In progress" or nothing for a case the player hasn't opened. */
export function CaseStatusBadge({ game }: { game: PlayedCase | undefined }) {
  const t = useTranslations("Player");
  if (!game) return null;
  if (!game.finished) {
    return (
      <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-900">
        {t("inProgress")}
      </span>
    );
  }
  return game.solved ? (
    <span className="rounded bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-900">
      {t("solved", { score: game.score ?? 0 })}
    </span>
  ) : (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-semibold text-red-900">
      {t("unsolved")}
    </span>
  );
}
