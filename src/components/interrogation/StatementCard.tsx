"use client";

import { useTranslations } from "next-intl";
import type { SuspectOption } from "./types";

type Props = { suspect: SuspectOption };

/** The suspect's first statement, kept in view so answers can be compared with it. */
export function StatementCard({ suspect }: Props) {
  const t = useTranslations("Interrogation");

  return (
    <figure className="border-accent/40 bg-card mb-5 rounded-lg border border-dashed px-4 py-3">
      <figcaption className="text-accent text-xs font-semibold tracking-widest uppercase">
        {t("initialStatement")}
      </figcaption>
      <blockquote className="mt-1 leading-relaxed italic">“{suspect.statement}”</blockquote>
    </figure>
  );
}
