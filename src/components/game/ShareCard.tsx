"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { QUESTION_LIMIT, type GameResult } from "@/lib/game/rules";

type Props = { caseNumber: number; result: GameResult };

const mark = (ok: boolean) => (ok ? "✅" : "❌");

/** Spoiler-free summary: says what the player got right, never who did it. */
export function ShareCard({ caseNumber, result }: Props) {
  const t = useTranslations("Share");
  const [copied, setCopied] = useState(false);

  const lines = [
    t("headline", { number: caseNumber }),
    `${mark(result.correct.killer)} ${t("killer")} · ${mark(result.correct.motive)} ${t("motive")} · ${mark(result.correct.evidence)} ${t("evidence")}`,
    `🗣️ ${result.questionsUsed}/${QUESTION_LIMIT} · 💡 ${result.hintsUsed} · ⭐ ${result.score.total}`,
  ];

  async function copy() {
    try {
      await navigator.clipboard.writeText([...lines, window.location.origin].join("\n"));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }

  return (
    <section className="border-rule bg-card rounded-lg border p-5">
      <h2 className="font-display text-xl font-bold">{t("title")}</h2>
      <pre className="bg-paper border-rule mt-3 overflow-x-auto rounded border p-3 font-mono text-sm leading-relaxed whitespace-pre-wrap">
        {lines.join("\n")}
      </pre>
      <button
        type="button"
        onClick={copy}
        className="bg-ink text-paper mt-3 rounded-lg px-5 py-2 font-semibold hover:opacity-90"
      >
        {copied ? t("copied") : t("copy")}
      </button>
    </section>
  );
}
