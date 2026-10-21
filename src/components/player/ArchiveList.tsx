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
    <ul className="divide-rule border-ink divide-y border-y">
      {rows.map((row) => (
        <li key={row.caseNumber}>
          <Link
            href={`/case/${row.caseNumber}`}
            className="hover:bg-card flex flex-col gap-1 py-5 sm:flex-row sm:items-center sm:gap-6 sm:px-2"
          >
            <span className="text-muted w-36 shrink-0 font-sans text-[13px] tracking-[0.1em] uppercase">
              {row.date}
            </span>
            <span className="min-w-0 flex-1">
              <span className="text-accent font-sans text-xs font-bold tracking-[0.2em] uppercase">
                {t("caseNumber", { number: row.caseNumber })} · {row.difficulty}
              </span>
              <span className="font-display mt-1 block text-2xl sm:text-3xl">{row.title}</span>
              <span className="text-muted block italic">{row.place}</span>
            </span>
            <CaseStatusBadge game={record.games[row.caseNumber]} />
          </Link>
        </li>
      ))}
    </ul>
  );
}
