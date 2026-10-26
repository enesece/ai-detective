"use client";

import { kicker } from "@/components/ui/styles";
import { useTranslations } from "next-intl";
import { PinButton } from "@/components/notebook/PinButton";
import type { Exchange } from "@/lib/game/rules";
import type { PinTarget } from "@/lib/notebook/schema";
import { WaitingForAnswer } from "./WaitingForAnswer";

/** An exchange plus its position in the whole game's conversation (a stable pin key). */
export type IndexedExchange = Exchange & { index: number };

type Props = {
  suspectName: string;
  exchanges: IndexedExchange[];
  waitingForAnswer: boolean;
  isPinned: (target: PinTarget) => boolean;
  onTogglePin: (target: PinTarget) => void;
  /** Title of a piece of evidence, for questions that came with one. */
  evidenceTitle: (id: string) => string | undefined;
};

export function ChatLog({
  suspectName,
  exchanges,
  waitingForAnswer,
  isPinned,
  onTogglePin,
  evidenceTitle,
}: Props) {
  const t = useTranslations("Interrogation");
  // Newspaper interviews label answers with the surname: "REED: ..."
  const speaker = suspectName.split(/\s+/).at(-1) ?? suspectName;
  if (exchanges.length === 0) {
    return (
      <p className="text-muted py-6 text-center italic">{t("empty", { name: suspectName })}</p>
    );
  }

  // Screen readers hear the finished answer once, not every streamed chunk.
  const last = exchanges.at(-1);
  const announcement = !waitingForAnswer && last?.answer ? `${speaker}: ${last.answer}` : "";

  return (
    <>
      <p className="sr-only" aria-live="polite">
        {announcement}
      </p>
      <ol className="divide-rule divide-y">
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
                {e.evidenceId && (
                  <span className="bg-ink text-paper mr-2 inline-block px-2 font-sans text-xs leading-6 font-bold tracking-[0.08em]">
                    <span className="sr-only">{t("showing")} </span>📎{" "}
                    {evidenceTitle(e.evidenceId) ?? e.evidenceId}
                  </span>
                )}
                {e.question}
              </p>
              <div>
                <p className="text-lg leading-relaxed">
                  <strong className={`${kicker} text-accent mr-2`}>{speaker}:</strong>
                  {e.answer || (streaming ? <WaitingForAnswer name={suspectName} /> : null)}
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
    </>
  );
}
