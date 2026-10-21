"use client";

import { useTranslations } from "next-intl";
import type { EvidenceOption, SuspectOption } from "@/components/interrogation/types";
import type { Notebook, PinTarget } from "@/lib/notebook/schema";
import { NoteEditor } from "./NoteEditor";
import { PinnedList } from "./PinnedList";

type Props = {
  notebook: Notebook;
  suspects: SuspectOption[];
  evidence: EvidenceOption[];
  caseNumber: number;
  onTextChange: (text: string) => void;
  onUnpin: (target: PinTarget) => void;
};

export function NotebookPanel({
  notebook,
  suspects,
  evidence,
  caseNumber,
  onTextChange,
  onUnpin,
}: Props) {
  const t = useTranslations("Notebook");

  return (
    <section
      aria-labelledby="notebook-title"
      className="border-rule bg-paper space-y-5 rounded-lg border p-4"
    >
      <h3 id="notebook-title" className="font-display text-xl font-bold">
        {t("title")}
      </h3>
      <NoteEditor text={notebook.text} onChange={onTextChange} />
      <div>
        <p className="text-muted mb-2 text-xs font-semibold tracking-widest uppercase">
          {t("pinnedGroup")}
        </p>
        <PinnedList
          pins={notebook.pins}
          suspects={suspects}
          evidence={evidence}
          caseNumber={caseNumber}
          onUnpin={onUnpin}
        />
      </div>
    </section>
  );
}
