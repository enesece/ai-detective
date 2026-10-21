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
      className={`inline-flex min-h-8 items-center gap-1.5 border px-2 font-sans text-[11px] font-bold tracking-[0.15em] uppercase transition-colors ${
        pinned
          ? "border-accent bg-accent text-paper"
          : "border-rule text-muted hover:border-accent hover:text-accent"
      }`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 16 16"
        className="h-3 w-3"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
      >
        <path d="M6 2h4l-.5 4 2.5 2v1H4V8l2.5-2L6 2ZM8 9v5" />
      </svg>
      {pinned ? t("pinned") : t("pin")}
    </button>
  );
}
