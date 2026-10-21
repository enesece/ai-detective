"use client";

import { useTranslations } from "next-intl";

type Props = { pinned: boolean; onToggle: () => void };

export function PinButton({ pinned, onToggle }: Props) {
  const t = useTranslations("Notebook");

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-pressed={pinned}
      className={`rounded px-1.5 py-0.5 text-xs font-semibold transition-colors ${
        pinned ? "bg-accent text-paper" : "text-muted hover:text-accent"
      }`}
    >
      📌 {pinned ? t("pinned") : t("pin")}
    </button>
  );
}
