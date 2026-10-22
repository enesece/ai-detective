"use client";

import { Portrait } from "@/components/ui/Portrait";
import { buttonOutline, buttonPrimary, kicker, linkCaps } from "@/components/ui/styles";
import { useEffect, useRef, useState } from "react";
import { hasLocale, useLocale, useTranslations } from "next-intl";
import { NotebookPanel } from "@/components/notebook/NotebookPanel";
import { useNotebook } from "@/components/notebook/useNotebook";
import { Link } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { ChatLog } from "./ChatLog";
import { HintBox } from "./HintBox";
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
  const {
    status,
    exchanges,
    questionsUsed,
    questionLimit,
    error,
    ask,
    hints,
    requestHint,
    finished,
  } = useInterrogation(caseNumber, locale);
  const { notebook, isPinned, togglePin, setText } = useNotebook(caseNumber);
  const [selectedId, setSelectedId] = useState(suspects[0]?.id ?? "");
  const [notebookOpen, setNotebookOpen] = useState(false);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const notebookRef = useRef<HTMLDivElement>(null);

  // Below xl the notebook opens under the chat: bring it into view, or it opens off-screen.
  function toggleNotebook() {
    const opening = !notebookOpen;
    setNotebookOpen(opening);
    if (opening) {
      requestAnimationFrame(() =>
        notebookRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }),
      );
    }
  }
  const lastAnswer = exchanges.at(-1)?.answer;
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Keep the newest message in view. On wide screens the chat is its own scroll box:
  // scroll only that box (scrollIntoView would also move the page). On phones the
  // chat flows in the page, so the page follows a question and its streaming answer.
  useEffect(() => {
    const box = chatScrollRef.current;
    if (!box) return;
    if (getComputedStyle(box).overflowY === "auto") box.scrollTop = box.scrollHeight;
  }, [exchanges.length, lastAnswer, selectedId]);
  useEffect(() => {
    const box = chatScrollRef.current;
    if (!box || getComputedStyle(box).overflowY === "auto" || status !== "asking") return;
    chatEndRef.current?.scrollIntoView({ block: "end" });
  }, [exchanges.length, lastAnswer, status]);

  const selected = suspects.find((s) => s.id === selectedId);
  if (!selected) return null;

  const visible = exchanges
    .map((e, index) => ({ ...e, index }))
    .filter((e) => e.suspectId === selected.id);
  const outOfQuestions = questionsUsed >= questionLimit;
  const statementTarget = { kind: "statement", suspectId: selected.id } as const;

  return (
    <div className="grid gap-6 lg:grid-cols-[250px_1fr] xl:grid-cols-[250px_1fr_320px]">
      {/* On phones the sidebar dissolves into the grid ("contents") so its pieces can be
          reordered: counter and suspects, the chat, the notebook (when open), then accuse and hints. */}
      <aside className="max-lg:contents lg:space-y-4">
        <div className="max-lg:order-1">
          <QuestionCounter used={questionsUsed} limit={questionLimit} />
        </div>
        {/* The accusation is open at any time, not only after all 20 questions. */}
        <Link
          href={finished ? `/case/${caseNumber}/result` : `/case/${caseNumber}/accuse`}
          className={`${buttonPrimary} w-full px-4 max-lg:order-5`}
        >
          {finished ? t("seeResult") : t("accuse")}
        </Link>
        <div className="max-lg:order-6">
          <HintBox
            used={hints.used}
            limit={status === "loading" ? null : hints.limit}
            revealed={hints.revealed}
            pending={hints.pending}
            disabled={finished || status === "loading"}
            onRequest={requestHint}
          />
        </div>
        <div className="min-w-0 max-lg:order-2">
          <SuspectPicker
            suspects={suspects}
            selectedId={selected.id}
            askedCount={(id) => exchanges.filter((e) => e.suspectId === id).length}
            onSelect={setSelectedId}
          />
        </div>
      </aside>

      {/* Wide screens: a framed box with its own scroll. Phones: no frame, the chat flows in the
          page and the question bar sticks to the bottom of the screen, like a messaging app. */}
      <section className="border-ink bg-paper flex min-w-0 flex-col max-lg:order-3 lg:h-[70dvh] lg:min-h-[24rem] lg:border">
        {/* On phones the suspect strip above already shows face and role, so the header stays slim. */}
        <header className="border-ink flex items-center justify-between gap-3 border-b py-2 sm:py-3 lg:px-4">
          <div className="flex min-w-0 items-center gap-4">
            <Portrait
              name={selected.name}
              seed={selected.id}
              appearance={selected.appearance}
              crop="head"
              className="h-16 w-16 shrink-0 max-lg:hidden"
            />
            <div className="min-w-0">
              <p className={`${kicker} text-muted max-sm:hidden`}>{t("interviewWith")}</p>
              <h2 className="font-display text-xl leading-tight sm:text-3xl">{selected.name}</h2>
              <p className="text-muted italic max-sm:hidden">{selected.role}</p>
            </div>
          </div>
          {/* Below xl the notebook is a panel you open; on wide screens it's always visible. */}
          <button
            type="button"
            onClick={toggleNotebook}
            aria-expanded={notebookOpen}
            aria-controls="notebook-panel"
            className={`${buttonOutline} min-h-11 shrink-0 px-3 text-xs xl:hidden`}
          >
            {tNotebook("toggle", { count: notebook.pins.length })}
          </button>
        </header>

        <div ref={chatScrollRef} className="py-4 lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:px-4">
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
              evidenceTitle={(id) => evidence.find((e) => e.id === id)?.title}
            />
          )}
          {/* Phones scroll this into view; the margin keeps it clear of the sticky question bar. */}
          <div ref={chatEndRef} className="scroll-mb-56" aria-hidden />
        </div>

        <footer className="border-ink bg-paper border-t py-3 max-lg:sticky max-lg:bottom-0 max-lg:z-10 max-lg:-mx-4 max-lg:px-4 max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:p-4">
          {error && (
            <p role="alert" className="text-alert mb-2 text-sm font-semibold">
              {t(`errors.${error}`)}
            </p>
          )}
          {finished ? (
            <p className="text-center">
              <span className="text-muted italic">{t("caseClosed")} </span>
              <Link href={`/case/${caseNumber}/result`} className={linkCaps}>
                {t("seeResult")} →
              </Link>
            </p>
          ) : outOfQuestions ? (
            <p className="text-muted text-center italic">{t("noQuestionsLeft")}</p>
          ) : (
            <QuestionForm
              suspectName={selected.name}
              evidence={evidence}
              disabled={status !== "ready"}
              onAsk={(question, evidenceId) => ask(selected.id, question, evidenceId)}
            />
          )}
        </footer>
      </section>

      <div
        id="notebook-panel"
        ref={notebookRef}
        className={`${notebookOpen ? "block" : "hidden"} max-lg:order-4 lg:col-span-2 xl:col-span-1 xl:block xl:h-[70dvh] xl:overflow-y-auto`}
      >
        <NotebookPanel
          notebook={notebook}
          suspects={suspects}
          evidence={evidence}
          caseNumber={caseNumber}
          onTextChange={setText}
          onUnpin={togglePin}
        />
      </div>
    </div>
  );
}
