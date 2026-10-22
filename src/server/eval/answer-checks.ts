import "server-only";

import type { Locale } from "@/lib/case/schema";

/*
 * Cheap, deterministic checks on a suspect's answer, shared by the evals.
 * The language check is a heuristic (Turkish letters and common words).
 */

export function languageOk(answer: string, locale: Locale): boolean {
  const turkish = /[çğıöşüÇĞİÖŞÜ]/.test(answer) || /\b(ve|bir|bu|ne|değil|ben|siz)\b/i.test(answer);
  return locale === "tr" ? turkish : !/[çğışÇĞİŞ]/.test(answer);
}

/** Sentences in an answer ("Dr." and "22.05" don't end one). */
export function sentenceCount(answer: string): number {
  return answer
    .replace(/\b(Dr|Mr|Mrs|Ms|St|Sir)\./g, "$1")
    .replace(/(\d)\.(\d)/g, "$1$2")
    .split(/[.!?…]+(?:\s|$)/)
    .filter((s) => s.trim().length > 0).length;
}

/** The game asks for at most 3-4 sentences; 5 is tolerated, more is a miss. */
export const MAX_SENTENCES = 5;
