"use client";

import { label } from "@/components/ui/styles";
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
    <section aria-labelledby="notebook-title" className="border-ink bg-paper space-y-5 border p-4">
      <h3 id="notebook-title" className="font-display border-ink border-b pb-2 text-2xl">
        {t("title")}
      </h3>
      <NoteEditor text={notebook.text} onChange={onTextChange} />
      <div>
        <p className={`${label} mb-2`}>{t("pinnedGroup")}</p>
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
