"use client";

import { useState } from "react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { NotebookPanel } from "@/components/notebook/NotebookPanel";
import { useNotebook } from "@/components/notebook/useNotebook";
import { routing } from "@/i18n/routing";
import { ChatLog } from "./ChatLog";
import { QuestionCounter } from "./QuestionCounter";
import { QuestionForm } from "./QuestionForm";
import { StatementCard } from "./StatementCard";
import { SuspectPicker } from "./SuspectPicker";
import type { EvidenceOption, SuspectOption } from "./types";
import { useInterrogation } from "./useInterrogation";

type Props = { caseNumber: number; suspects: SuspectOption[]; evidence: EvidenceOption[] };

export function InterrogationRoom({ caseNumber, suspects, evidence }: Props) {
  const t = useTranslations("Interrogation");
  const tNotebook = useTranslations("Notebook");
  const rawLocale = useLocale();
  const locale = hasLocale(routing.locales, rawLocale) ? rawLocale : routing.defaultLocale;
  const { status, exchanges, questionsUsed, questionLimit, error, ask } = useInterrogation(
    caseNumber,
    locale,
  );
  const { notebook, isPinned, togglePin, setText } = useNotebook(caseNumber);
  const [selectedId, setSelectedId] = useState(suspects[0]?.id ?? "");
  const [notebookOpen, setNotebookOpen] = useState(false);

  const selected = suspects.find((s) => s.id === selectedId);
  if (!selected) return null;

  const visible = exchanges
    .map((e, index) => ({ ...e, index }))
    .filter((e) => e.suspectId === selected.id);
  const outOfQuestions = questionsUsed >= questionLimit;
  const statementTarget = { kind: "statement", suspectId: selected.id } as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[200px_1fr] xl:grid-cols-[200px_1fr_320px]">
      <aside className="space-y-4">
        <QuestionCounter used={questionsUsed} limit={questionLimit} />
        <SuspectPicker
          suspects={suspects}
          selectedId={selected.id}
          askedCount={(id) => exchanges.filter((e) => e.suspectId === id).length}
          onSelect={setSelectedId}
        />
      </aside>

      <section className="border-rule bg-paper flex min-h-[28rem] min-w-0 flex-col rounded-lg border">
        <header className="border-rule flex items-start justify-between gap-3 border-b px-4 py-3">
          <div>
            <h2 className="font-display text-xl font-bold">{selected.name}</h2>
            <p className="text-muted text-sm">{selected.role}</p>
          </div>
          {/* Below xl the notebook is a panel you open; on wide screens it's always visible. */}
          <button
            type="button"
            onClick={() => setNotebookOpen((open) => !open)}
            aria-expanded={notebookOpen}
            aria-controls="notebook-panel"
            className="border-rule hover:border-ink shrink-0 rounded-lg border px-3 py-1.5 text-sm font-semibold xl:hidden"
          >
            {tNotebook("toggle", { count: notebook.pins.length })}
          </button>
        </header>

        <div className="flex-1 overflow-y-auto p-4">
          <StatementCard
            suspect={selected}
            pinned={isPinned(statementTarget)}
            onTogglePin={() => togglePin(statementTarget)}
          />
          {status === "loading" ? (
            <p className="text-muted py-6 text-center italic">{t("loading")}</p>
          ) : (
            <ChatLog
              suspectName={selected.name}
              exchanges={visible}
              waitingForAnswer={status === "asking"}
              isPinned={isPinned}
              onTogglePin={togglePin}
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

      <div
        id="notebook-panel"
        className={`${notebookOpen ? "block" : "hidden"} lg:col-span-2 xl:col-span-1 xl:block`}
      >
        <NotebookPanel
          notebook={notebook}
          suspects={suspects}
          evidence={evidence}
          onTextChange={setText}
          onUnpin={togglePin}
        />
      </div>
    </div>
  );
}
