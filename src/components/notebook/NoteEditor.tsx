"use client";

import { label } from "@/components/ui/styles";
import { useTranslations } from "next-intl";
import { NOTE_MAX_LENGTH } from "@/lib/notebook/schema";

type Props = { text: string; onChange: (text: string) => void };

export function NoteEditor({ text, onChange }: Props) {
  const t = useTranslations("Notebook");

  return (
    <label className="block">
      <span className={label}>{t("notesLabel")}</span>
      <textarea
        value={text}
        onChange={(e) => onChange(e.target.value)}
        maxLength={NOTE_MAX_LENGTH}
        rows={6}
        placeholder={t("placeholder")}
        className="border-ink bg-card mt-2 w-full resize-y border px-3 py-2 leading-relaxed"
      />
      <span className="text-muted flex justify-between font-sans text-xs">
        <span>{t("savedLocally")}</span>
        <span>
          {text.length}/{NOTE_MAX_LENGTH}
        </span>
      </span>
    </label>
  );
}
