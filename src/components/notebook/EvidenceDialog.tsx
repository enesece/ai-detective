"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { EvidenceOption } from "@/components/interrogation/types";
import { buttonInk, kicker, linkCaps } from "@/components/ui/styles";
import { Link } from "@/i18n/navigation";

type Props = { evidence: EvidenceOption | null; caseNumber: number; onClose: () => void };

/*
 * A pinned piece of evidence, opened over the interrogation room so the
 * player doesn't lose their place. The native <dialog> with showModal() keeps
 * keyboard focus inside, closes on Esc and dims the page behind it.
 */
export function EvidenceDialog({ evidence, caseNumber, onClose }: Props) {
  const t = useTranslations("Notebook");
  const ref = useRef<HTMLDialogElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (evidence && !dialog.open) {
      dialog.showModal();
      // showModal() focuses the first link; start on "Close" instead.
      closeRef.current?.focus();
    }
    if (!evidence && dialog.open) dialog.close();
  }, [evidence]);

  return (
    <dialog
      ref={ref}
      aria-labelledby="evidence-dialog-title"
      onClose={onClose}
      // A click on the dimmed backdrop lands on the <dialog> itself, not its content.
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="border-ink bg-card text-ink m-auto w-[min(36rem,calc(100%-2rem))] border-t-[3px] p-0 shadow-xl backdrop:bg-black/50"
    >
      {evidence && (
        <div className="p-6 sm:p-8">
          <p className={`${kicker} text-muted`}>
            {evidence.kind}
            {evidence.place && ` · ${t("foundAt", { place: evidence.place })}`}
          </p>
          <h2 id="evidence-dialog-title" className="font-display mt-2 text-3xl sm:text-4xl">
            {evidence.title}
          </h2>
          <p className="mt-4 max-h-[50dvh] overflow-y-auto text-lg leading-relaxed whitespace-pre-line">
            {evidence.description}
          </p>
          <div className="border-ink mt-6 flex flex-wrap items-center justify-between gap-4 border-t pt-4">
            <Link href={`/case/${caseNumber}/evidence/${evidence.id}`} className={linkCaps}>
              {t("openEvidencePage")} →
            </Link>
            <button ref={closeRef} type="button" onClick={onClose} className={buttonInk}>
              {t("close")}
            </button>
          </div>
        </div>
      )}
    </dialog>
  );
}
