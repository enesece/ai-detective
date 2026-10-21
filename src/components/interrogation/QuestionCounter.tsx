"use client";

import { kicker } from "@/components/ui/styles";
import { useTranslations } from "next-intl";

type Props = { used: number; limit: number };

export function QuestionCounter({ used, limit }: Props) {
  const t = useTranslations("Interrogation");
  const left = Math.max(0, limit - used);

  return (
    <div aria-live="polite">
      <p className={kicker}>{t("questionsLeft", { left, limit })}</p>
      <div className="mt-2 flex gap-0.5" aria-hidden>
        {Array.from({ length: limit }, (_, i) => (
          <span key={i} className={`h-2 flex-1 ${i < used ? "bg-rule" : "bg-ink"}`} />
        ))}
      </div>
    </div>
  );
}
