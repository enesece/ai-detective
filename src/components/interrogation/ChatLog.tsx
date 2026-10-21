"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { PinButton } from "@/components/notebook/PinButton";
import type { Exchange } from "@/lib/game/rules";
import type { PinTarget } from "@/lib/notebook/schema";

/** An exchange plus its position in the whole game's conversation (a stable pin key). */
export type IndexedExchange = Exchange & { index: number };

type Props = {
  suspectName: string;
  exchanges: IndexedExchange[];
  waitingForAnswer: boolean;
  isPinned: (target: PinTarget) => boolean;
  onTogglePin: (target: PinTarget) => void;
};

export function ChatLog({
  suspectName,
  exchanges,
  waitingForAnswer,
  isPinned,
  onTogglePin,
}: Props) {
  const t = useTranslations("Interrogation");
  const endRef = useRef<HTMLDivElement>(null);
  const lastAnswer = exchanges.at(-1)?.answer;

  // Keep the newest text in view while the answer streams in.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "nearest" });
  }, [exchanges.length, lastAnswer]);

  if (exchanges.length === 0) {
    return (
      <p className="text-muted py-6 text-center italic">{t("empty", { name: suspectName })}</p>
    );
  }

  return (
    <>
      <ol className="space-y-5" aria-live="polite">
        {exchanges.map((e, i) => {
          const streaming = waitingForAnswer && i === exchanges.length - 1;
          const target: PinTarget = {
            kind: "answer",
            exchangeIndex: e.index,
            suspectId: e.suspectId,
            question: e.question,
            answer: e.answer,
          };
          return (
            <li key={e.index} className="space-y-2">
              <p className="bg-ink text-paper ml-auto w-fit max-w-[85%] rounded-lg rounded-br-sm px-4 py-2">
                {e.question}
              </p>
              <div className="border-rule bg-card w-fit max-w-[85%] rounded-lg rounded-bl-sm border px-4 py-2">
                <p className="text-accent text-xs font-semibold">{suspectName}</p>
                <p className="leading-relaxed">
                  {e.answer ||
                    (streaming ? <span className="text-muted italic">{t("thinking")}</span> : null)}
                </p>
                {!streaming && e.answer && (
                  <div className="mt-1 text-right">
                    <PinButton pinned={isPinned(target)} onToggle={() => onTogglePin(target)} />
                  </div>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <div ref={endRef} />
    </>
  );
}
