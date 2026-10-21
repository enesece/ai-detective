"use client";

import { useTranslations } from "next-intl";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { usePlayerRecord } from "./usePlayerRecord";

/** On the home page: the player's streak and how today's case went. */
export function TodayStatus({ caseNumber }: { caseNumber: number | null }) {
  const t = useTranslations("Player");
  const record = usePlayerRecord();
  if (!record.loaded) return <div className="h-6" aria-hidden />;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {caseNumber !== null && <CaseStatusBadge game={record.games[caseNumber]} />}
      {record.streak > 0 && (
        <span className="font-semibold">🔥 {t("streak", { count: record.streak })}</span>
      )}
      {record.bestStreak > record.streak && (
        <span className="text-muted">{t("bestStreak", { count: record.bestStreak })}</span>
      )}
    </div>
  );
}
