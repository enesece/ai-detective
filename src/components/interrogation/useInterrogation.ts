"use client";

import { useCallback, useEffect, useState } from "react";
import type { Locale } from "@/lib/case/schema";
import { toGameError } from "@/components/game/errors";
import { gameFetch } from "@/lib/supabase/session";
import type { LocalizedText } from "@/lib/case/schema";
import {
  QUESTION_LIMIT,
  QUESTIONS_USED_HEADER,
  type Exchange,
  type GameSnapshot,
  type GameError,
  type HintRequest,
  type HintResponse,
  type InterrogateRequest,
} from "@/lib/game/rules";

type Status = "loading" | "ready" | "asking";

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
  const [hintsUsed, setHintsUsed] = useState(0);
  const [hintLimit, setHintLimit] = useState(0);
  const [revealedHints, setRevealedHints] = useState<LocalizedText[]>([]);
  const [hintPending, setHintPending] = useState(false);
  const [finished, setFinished] = useState(false);

  // Restore the server's state after a reload.
  useEffect(() => {
    let cancelled = false;
    gameFetch(`/api/game/${caseNumber}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<GameSnapshot>) : null))
      .then((snapshot) => {
        if (cancelled) return;
        if (snapshot) {
          setExchanges(snapshot.exchanges);
          setQuestionsUsed(snapshot.questionsUsed);
          setQuestionLimit(snapshot.questionLimit);
          setHintsUsed(snapshot.hintsUsed);
          setHintLimit(snapshot.hintLimit);
          setRevealedHints(snapshot.revealedHints);
          setFinished(snapshot.result !== null);
        }
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("ready"));
    return () => {
      cancelled = true;
    };
  }, [caseNumber]);

  const ask = useCallback(
    async (suspectId: string, question: string): Promise<boolean> => {
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
        const res = await gameFetch("/api/interrogate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (!res.ok || !res.body) {
          const code = toGameError(await res.json().catch(() => null));
          dropLast();
          setError(code);
          if (code === "limit_reached") setQuestionsUsed(questionLimit);
          if (code === "game_over") setFinished(true);
          return false;
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
        return true;
      } catch {
        dropLast();
        setError("ai_unavailable");
        return false;
      } finally {
        setStatus("ready");
      }
    },
    [caseNumber, locale, questionLimit],
  );

  const requestHint = useCallback(async () => {
    setError(null);
    setHintPending(true);
    try {
      const body: HintRequest = { caseNumber };
      const res = await gameFetch("/api/hint", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        const code = toGameError(data);
        setError(code);
        if (code === "game_over") setFinished(true);
        return;
      }
      const hint = data as HintResponse;
      setHintsUsed(hint.hintsUsed);
      setHintLimit(hint.hintLimit);
      setRevealedHints(hint.revealedHints);
    } catch {
      setError("ai_unavailable");
    } finally {
      setHintPending(false);
    }
  }, [caseNumber]);

  return {
    status,
    exchanges,
    questionsUsed,
    questionLimit,
    error,
    ask,
    hints: { used: hintsUsed, limit: hintLimit, revealed: revealedHints, pending: hintPending },
    requestHint,
    finished,
  };
}
