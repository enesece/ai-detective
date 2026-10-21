"use client";

import { useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { hasLocale } from "next-intl";
import { routing } from "@/i18n/routing";
import { ChatLog } from "./ChatLog";
import { QuestionCounter } from "./QuestionCounter";
import { QuestionForm } from "./QuestionForm";
import { StatementCard } from "./StatementCard";
import { SuspectPicker } from "./SuspectPicker";
import type { SuspectOption } from "./types";
import { useInterrogation } from "./useInterrogation";

type Props = { caseNumber: number; suspects: SuspectOption[] };

export function InterrogationRoom({ caseNumber, suspects }: Props) {
  const t = useTranslations("Interrogation");
  const rawLocale = useLocale();
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const { status, exchanges, questionsUsed, questionLimit, error, ask } = useInterrogation(
    caseNumber,
    locale,
  );
  const [selectedId, setSelectedId] = useState(suspects[0]?.id ?? "");

  const selected = suspects.find((s) => s.id === selectedId);
  if (!selected) return null;

  const visible = exchanges.filter((e) => e.suspectId === selected.id);
  const outOfQuestions = questionsUsed >= questionLimit;

  return (
    <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
      <aside className="space-y-4">
        <QuestionCounter used={questionsUsed} limit={questionLimit} />
        <SuspectPicker
          suspects={suspects}
          selectedId={selected.id}
          askedCount={(id) => exchanges.filter((e) => e.suspectId === id).length}
          onSelect={setSelectedId}
        />
      </aside>

      <section className="border-rule flex min-h-[28rem] flex-col rounded-lg border bg-paper">
        <header className="border-rule border-b px-4 py-3">
          <h2 className="font-display text-xl font-bold">{selected.name}</h2>
          <p className="text-muted text-sm">{selected.role}</p>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <StatementCard suspect={selected} />
          {status === "loading" ? (
            <p className="text-muted py-10 text-center italic">{t("loading")}</p>
          ) : (
            <ChatLog
              suspectName={selected.name}
              exchanges={visible}
              waitingForAnswer={status === "asking"}
            />
          )}
        </div>

        <footer className="border-rule border-t p-4">
          {error && (
            <p role="alert" className="text-accent mb-2 text-sm font-semibold">
              {t(`errors.${error}`)}
            </p>
          )}
          {outOfQuestions ? (
            <p className="text-muted text-center italic">{t("noQuestionsLeft")}</p>
          ) : (
            <QuestionForm
              suspectName={selected.name}
              disabled={status !== "ready"}
              onAsk={(question) => ask(selected.id, question)}
            />
          )}
        </footer>
      </section>
    </div>
  );
}
