"use client";

import { buttonInk, kicker } from "@/components/ui/styles";
import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MAX_QUESTION_LENGTH } from "@/lib/game/rules";
import type { EvidenceOption } from "./types";

type Props = {
  suspectName: string;
  evidence: EvidenceOption[];
  disabled: boolean;
  /** Resolves to false when the question was not answered (error, limit…). */
  onAsk: (question: string, evidenceId: string | null) => Promise<boolean>;
};

export function QuestionForm({ suspectName, evidence, disabled, onAsk }: Props) {
  const t = useTranslations("Interrogation");
  const [draft, setDraft] = useState("");
  const [shownId, setShownId] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);
  const shown = evidence.find((e) => e.id === shownId) ?? null;
  // Showing evidence without words is fine: the detective just puts it on the table.
  const question = draft.trim() || (shown ? t("showDefault") : "");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !question) return;
    const sentEvidence = shownId;
    setDraft("");
    setShownId(null);
    setPicking(false);
    // If it failed, give the question (and evidence) back so nothing has to be redone,
    // unless the player has already started on a new one.
    if (!(await onAsk(question, sentEvidence))) {
      setDraft((current) => current || draft.trim());
      setShownId((current) => current ?? sentEvidence);
    }
  }

  function choose(id: string) {
    setShownId(id);
    setPicking(false);
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      {picking && (
        <fieldset className="border-ink bg-card min-w-0 border px-3 pt-1 pb-2">
          <legend className={`${kicker} px-1`}>
            {t("showEvidenceTitle", { name: suspectName })}
          </legend>
          {/* One scrolling row, so the chat box above keeps its room on small screens. */}
          <ul className="flex gap-2 overflow-x-auto pb-1">
            {evidence.map((e) => (
              <li key={e.id} className="shrink-0">
                <button
                  type="button"
                  onClick={() => choose(e.id)}
                  aria-pressed={e.id === shownId}
                  className={`border px-3 py-2 text-left text-sm whitespace-nowrap ${
                    e.id === shownId
                      ? "border-ink bg-ink text-paper"
                      : "border-rule hover:border-ink bg-paper"
                  }`}
                >
                  📎 {e.title}
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => setPicking((open) => !open)}
          aria-expanded={picking}
          disabled={disabled}
          className="border-ink min-h-9 border px-3 font-sans text-xs font-bold tracking-[0.12em] uppercase disabled:opacity-60"
        >
          📎 {t("showEvidence")}
        </button>
        {shown && (
          <span className="bg-ink text-paper inline-flex items-center gap-2 py-1 pr-1 pl-3 text-sm">
            <span>
              <span className="sr-only">{t("showing")} </span>
              {shown.title}
            </span>
            <button
              type="button"
              onClick={() => setShownId(null)}
              aria-label={t("removeEvidence", { title: shown.title })}
              className="hover:bg-paper hover:text-ink px-2 leading-6"
            >
              ✕
            </button>
          </span>
        )}
      </div>

      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="sr-only">{t("askPlaceholder", { name: suspectName })}</span>
          <textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              // Not while an input method is still composing a character.
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                e.currentTarget.form?.requestSubmit();
              }
            }}
            maxLength={MAX_QUESTION_LENGTH}
            rows={2}
            disabled={disabled}
            placeholder={shown ? t("showPlaceholder") : t("askPlaceholder", { name: suspectName })}
            className="border-ink bg-card w-full resize-none border px-3 py-2 text-lg disabled:opacity-60"
          />
          <span className="text-muted block text-right font-sans text-xs max-sm:hidden">
            {draft.length}/{MAX_QUESTION_LENGTH}
          </span>
        </label>
        <button
          type="submit"
          disabled={disabled || !question}
          className={`${buttonInk} max-sm:min-h-12 max-sm:px-4 sm:mb-5`}
        >
          {shown ? t("show") : t("ask")}
        </button>
      </div>
    </form>
  );
}
