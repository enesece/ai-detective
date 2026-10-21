"use client";

import { useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { MAX_QUESTION_LENGTH } from "@/lib/game/rules";

type Props = { suspectName: string; disabled: boolean; onAsk: (question: string) => void };

export function QuestionForm({ suspectName, disabled, onAsk }: Props) {
  const t = useTranslations("Interrogation");
  const [draft, setDraft] = useState("");
  const question = draft.trim();

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (disabled || !question) return;
    onAsk(question);
    setDraft("");
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
      <label className="flex-1">
        <span className="sr-only">{t("askPlaceholder", { name: suspectName })}</span>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          maxLength={MAX_QUESTION_LENGTH}
          rows={2}
          disabled={disabled}
          placeholder={t("askPlaceholder", { name: suspectName })}
          className="border-rule bg-card focus:border-ink w-full resize-none rounded-lg border px-3 py-2 outline-none disabled:opacity-60"
        />
        <span className="text-muted block text-right text-xs">
          {draft.length}/{MAX_QUESTION_LENGTH}
        </span>
      </label>
      <button
        type="submit"
        disabled={disabled || !question}
        className="bg-ink text-paper mb-5 rounded-lg px-5 py-2.5 font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {t("ask")}
      </button>
    </form>
  );
}
