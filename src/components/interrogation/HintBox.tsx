"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { localize } from "@/lib/case/localize";
import type { LocalizedText } from "@/lib/case/schema";
import { SCORING } from "@/lib/game/scoring";

type Props = {
  used: number;
  /** null while the player's progress is still loading. */
  limit: number | null;
  revealed: LocalizedText[];
  pending: boolean;
  disabled: boolean;
  onRequest: () => void;
};

/** Unlocks pre-written hints one by one; asks for confirmation because each costs points. */
export function HintBox({ used, limit, revealed, pending, disabled, onRequest }: Props) {
  const t = useTranslations("Hints");
  const rawLocale = useLocale();
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const [confirming, setConfirming] = useState(false);
  const left = limit === null ? null : Math.max(0, limit - used);

  return (
    <section className="border-rule bg-card rounded-lg border p-3">
      <h3 className="font-display font-bold">{t("title")}</h3>
      {revealed.length > 0 && (
        <ol className="mt-2 space-y-2 text-sm">
          {revealed.map((hint, i) => (
            <li key={i} className="border-accent border-l-2 pl-2 leading-relaxed">
              <span className="text-accent font-semibold">💡 {i + 1}. </span>
              {localize(hint, locale)}
            </li>
          ))}
        </ol>
      )}

      {left === null ? (
        <button
          type="button"
          disabled
          className="border-rule mt-2 w-full rounded border px-3 py-1.5 text-sm font-semibold opacity-40"
        >
          {t("getLoading")}
        </button>
      ) : left === 0 ? (
        <p className="text-muted mt-2 text-xs italic">{t("noneLeft")}</p>
      ) : confirming ? (
        <div className="mt-2 space-y-2 text-sm">
          <p>{t("confirm", { penalty: SCORING.perHint })}</p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setConfirming(false);
                onRequest();
              }}
              className="bg-accent text-paper rounded px-3 py-1 font-semibold disabled:opacity-50"
            >
              {t("yes")}
            </button>
            <button type="button" onClick={() => setConfirming(false)} className="text-muted px-2">
              {t("cancel")}
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          disabled={disabled || pending}
          onClick={() => setConfirming(true)}
          className="border-rule hover:border-ink mt-2 w-full rounded border px-3 py-1.5 text-sm font-semibold disabled:opacity-40"
        >
          {t("get", { left, penalty: SCORING.perHint })}
        </button>
      )}
    </section>
  );
}
