import "server-only";

import {
  CaseSchema,
  PublicBriefingSchema,
  type CaseFile,
  type CaseSecret,
  type PublicCase,
} from "@/lib/case/schema";
import case001 from "./fixtures/case-001.json";

/*
 * Single entry point for reading cases. Phase 1 reads JSON fixtures; phase 3
 * swaps this for Supabase without touching the pages that call it.
 *
 * Fixtures are validated at module load, so a broken case fails the build
 * instead of reaching a player.
 */
const cases: ReadonlyMap<number, CaseFile> = new Map(
  [case001].map((raw) => {
    const parsed = CaseSchema.parse(raw);
    return [parsed.caseNumber, parsed];
  }),
);

export function listCaseNumbers(): number[] {
  return [...cases.keys()];
}

/** Only the public half. Safe to render and to pass to Client Components. */
export function getPublicCase(caseNumber: number): PublicCase | null {
  const found = cases.get(caseNumber);
  if (!found) return null;

  return {
    caseNumber: found.caseNumber,
    difficulty: found.difficulty,
    // Re-parse so the returned object is a fresh copy holding public keys only.
    briefing: PublicBriefingSchema.parse(found.public),
  };
}

/** Secret half. Server only: for AI prompts and accusation checks (phase 2+). */
export function getCaseSecret(caseNumber: number): CaseSecret | null {
  return cases.get(caseNumber)?.secret ?? null;
}
