"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/case/schema";
import {
  GAME_ERRORS,
  QUESTION_LIMIT,
  QUESTIONS_USED_HEADER,
  type Exchange,
  type GameSnapshot,
  type GameError,
  type InterrogateRequest,
} from "@/lib/game/rules";

type Status = "loading" | "ready" | "asking";

function toError(value: unknown): GameError {
  const code =
    typeof value === "object" && value !== null && "error" in value ? value.error : undefined;
  return GAME_ERRORS.find((e) => e === code) ?? "ai_unavailable";
}

/**
 * Talks to the interrogation API. The server owns the real counter; this hook
 * only mirrors it (from the response header) so the UI can show it.
 */
export function useInterrogation(caseNumber: number, locale: Locale) {
  const [status, setStatus] = useState<Status>("loading");
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [questionsUsed, setQuestionsUsed] = useState(0);
  const [questionLimit, setQuestionLimit] = useState(QUESTION_LIMIT);
  const [error, setError] = useState<GameError | null>(null);

  // Restore the server's state after a reload.
  useEffect(() => {
    let cancelled = false;
    fetch(`/api/game/${caseNumber}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<GameSnapshot>) : null))
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot) {
          setExchanges(snapshot.exchanges);
          setQuestionsUsed(snapshot.questionsUsed);
          setQuestionLimit(snapshot.questionLimit);
        }
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("ready"));
    return () => {
      cancelled = true;
    };
  }, [caseNumber]);

  const ask = useCallback(
    async (suspectId: string, question: string) => {
      setError(null);
      setStatus("asking");
      // Show the question immediately; the answer fills in as it streams.
      setExchanges((prev) => [...prev, { suspectId, question, answer: "", locale }]);
      const updateLastAnswer = (update: (answer: string) => string) =>
        setExchanges((prev) => {
          const last = prev.at(-1);
          return last ? [...prev.slice(0, -1), { ...last, answer: update(last.answer) }] : prev;
        });
      const dropLast = () => setExchanges((prev) => prev.slice(0, -1));

      const body: InterrogateRequest = { caseNumber, suspectId, question, locale };
      try {
        const res = await fetch("/api/interrogate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          const code = toError(await res.json().catch(() => null));
          dropLast();
          setError(code);
          if (code === "limit_reached") setQuestionsUsed(questionLimit);
          return;
        }

        const used = Number(res.headers.get(QUESTIONS_USED_HEADER));
        if (Number.isInteger(used)) setQuestionsUsed(used);

        const reader = res.body.pipeThrough(new TextDecoderStream()).getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          updateLastAnswer((answer) => answer + value);
        }
        updateLastAnswer((answer) => answer.trim());
      } catch {
        dropLast();
        setError("ai_unavailable");
      } finally {
        setStatus("ready");
      }
    },
    [caseNumber, locale, questionLimit],
  );

  return { status, exchanges, questionsUsed, questionLimit, error, ask };
}
