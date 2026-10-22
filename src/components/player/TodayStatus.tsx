"use client";

import { useTranslations } from "next-intl";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { NextCaseCountdown } from "./NextCaseCountdown";
import { usePlayerRecord } from "./usePlayerRecord";

/** On the home page: the player's streak and how today's case went. */
type Props = { caseNumber: number | null; isToday: boolean };

export function TodayStatus({ caseNumber, isToday }: Props) {
  const t = useTranslations("Player");
  const record = usePlayerRecord();
  if (!record.loaded) return <div className="h-6" aria-hidden />;
  const finishedToday = isToday && caseNumber !== null && record.games[caseNumber]?.finished;

  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      {caseNumber !== null && <CaseStatusBadge game={record.games[caseNumber]} />}
      {record.streak > 0 && (
        <span className="font-sans text-[13px] font-bold tracking-[0.15em] uppercase">
          {t("streak", { count: record.streak })}
        </span>
      )}
      {record.bestStreak > record.streak && (
        <span className="text-muted">{t("bestStreak", { count: record.bestStreak })}</span>
      )}
      {finishedToday && <NextCaseCountdown className="text-muted italic" />}
    </div>
  );
}
