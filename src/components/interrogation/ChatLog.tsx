"use client";

import { kicker } from "@/components/ui/styles";
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
  // Newspaper interviews label answers with the surname: "REED: ..."
  const speaker = suspectName.split(/\s+/).at(-1) ?? suspectName;
  if (exchanges.length === 0) {
    return (
      <p className="text-muted py-6 text-center italic">{t("empty", { name: suspectName })}</p>
    );
  }

  return (
    <ol className="divide-rule divide-y" aria-live="polite">
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
          <li key={e.index} className="space-y-3 py-5 first:pt-2">
            <p className="leading-relaxed">
              <strong className={`${kicker} mr-2`}>{t("you")}:</strong>
              {e.question}
            </p>
            <div>
              <p className="text-lg leading-relaxed">
                <strong className={`${kicker} text-accent mr-2`}>{speaker}:</strong>
                {e.answer ||
                  (streaming ? <span className="text-muted italic">{t("thinking")}</span> : null)}
              </p>
              {!streaming && e.answer && (
                <div className="mt-2">
                  <PinButton pinned={isPinned(target)} onToggle={() => onTogglePin(target)} />
                </div>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
