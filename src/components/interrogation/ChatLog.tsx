"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import type { Exchange } from "@/lib/game/rules";

type Props = { suspectName: string; exchanges: Exchange[]; waitingForAnswer: boolean };

export function ChatLog({ suspectName, exchanges, waitingForAnswer }: Props) {
  const t = useTranslations("Interrogation");
  const endRef = useRef<HTMLDivElement>(null);
  const lastAnswer = exchanges.at(-1)?.answer;

  // Keep the newest text in view while the answer streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [exchanges.length, lastAnswer]);

  if (exchanges.length === 0) {
    return (
      <p className="text-muted py-10 text-center italic">{t("empty", { name: suspectName })}</p>
    );
  }

  return (
    <ol className="space-y-5" aria-live="polite">
      {exchanges.map((e, i) => (
        <li key={i} className="space-y-2">
          <p className="bg-ink text-paper ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm px-4 py-2">
            {e.question}
          </p>
          <div className="border-rule bg-card w-fit max-w-[85%] rounded-lg rounded-bl-sm border px-4 py-2">
            <p className="text-accent text-xs font-semibold">{suspectName}</p>
            <p className="leading-relaxed">
              {e.answer ||
                (waitingForAnswer && i === exchanges.length - 1 ? (
                  <span className="text-muted italic">{t("thinking")}</span>
                ) : null)}
            </p>
          </div>
        </li>
      ))}
      <div ref={endRef} />
    </ol>
  );
}
