"use client";

import { useTranslations } from "next-intl";
import { NOTE_MAX_LENGTH } from "@/lib/notebook/schema";

type Props = { text: string; onChange: (text: string) => void };

export function NoteEditor({ text, onChange }: Props) {
  const t = useTranslations("Notebook");

  return (
    <label className="block">
      <span className="text-muted text-xs font-semibold tracking-widest uppercase">
        {t("notesLabel")}
      </span>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        rows={6}
        placeholder={t("placeholder")}
        className="border-rule bg-card focus:border-ink mt-1 w-full resize-y rounded-lg border px-3 py-2 text-sm leading-relaxed outline-none"
      />
      <span className="text-muted flex justify-between text-xs">
        <span>{t("savedLocally")}</span>
        <span>
          {text.length}/{NOTE_MAX_LENGTH}
        </span>
      </span>
    </label>
  );
}
