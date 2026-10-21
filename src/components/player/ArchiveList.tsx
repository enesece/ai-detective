"use client";

import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { CaseStatusBadge } from "./CaseStatusBadge";
import { usePlayerRecord } from "./usePlayerRecord";

/** Already translated, public fields only (rendered on the server, see archive/page.tsx). */
export type ArchiveRow = {
  caseNumber: number;
  date: string;
  title: string;
  place: string;
  difficulty: string;
};

export function ArchiveList({ rows }: { rows: ArchiveRow[] }) {
  const t = useTranslations("Case");
  const record = usePlayerRecord();

  return (
    <ul className="divide-rule border-rule bg-card divide-y rounded-lg border">
      {rows.map((row) => (
        <li key={row.caseNumber}>
          <Link
            href={`/case/${row.caseNumber}`}
            className="flex flex-col gap-1 px-4 py-4 hover:bg-white sm:flex-row sm:items-center sm:gap-4"
          >
            <span className="text-muted w-32 shrink-0 text-sm">{row.date}</span>
            <span className="min-w-0 flex-1">
              <span className="text-accent text-xs font-semibold tracking-widest uppercase">
                {t("caseNumber", { number: row.caseNumber })} · {row.difficulty}
              </span>
              <span className="font-display block text-lg font-bold">{row.title}</span>
              <span className="text-muted block text-sm">{row.place}</span>
            </span>
            <CaseStatusBadge game={record.games[row.caseNumber]} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
