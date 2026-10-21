import "server-only";

import { cacheLife, cacheTag } from "next/cache";
import {
  CaseSecretSchema,
  PublicBriefingSchema,
  type CaseSecret,
  type PublicCase,
} from "@/lib/case/schema";
import { createSupabaseAdminClient } from "@/server/supabase";

/*
 * Single entry point for reading cases from Supabase.
 *
 * The public half is cached ('use cache'), so case pages stay prerendered.
 * The secret half is never cached: it is read fresh for each request that
 * needs it, so it never lands in Next.js' cache, let alone a page.
 * Both halves are validated with Zod on the way out of the database.
 */

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function toDifficulty(value: string): Difficulty {
  const found = DIFFICULTIES.find((d) => d === value);
  if (!found) throw new Error(`Unknown difficulty "${value}"`);
  return found;
}

/** Approved case numbers, for prerendering. */
export async function listCaseNumbers(): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("cases");

  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("case_number")
    .eq("status", "approved")
    .order("case_number");
  if (error) throw new Error(`listCaseNumbers: ${error.message}`);
  return data.map((row) => row.case_number);
}

/** Only the public half. Safe to render and to pass to Client Components. */
export async function getPublicCase(caseNumber: number): Promise<PublicCase | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("cases", `case-${caseNumber}`);

  // Selects only public columns: the secret isn't even fetched here.
  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("case_number, difficulty, public_briefing")
    .eq("case_number", caseNumber)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(`getPublicCase(${caseNumber}): ${error.message}`);
  if (!data) return null;

  return {
    caseNumber: data.case_number,
    difficulty: toDifficulty(data.difficulty),
    briefing: PublicBriefingSchema.parse(data.public_briefing),
  };
}

/** Secret half. Server only, never cached: for AI prompts, hints and accusation checks. */
export async function getCaseSecret(caseNumber: number): Promise<CaseSecret | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("secret")
    .eq("case_number", caseNumber)
    .eq("status", "approved")
    .maybeSingle();
  if (error) throw new Error(`getCaseSecret(${caseNumber}): ${error.message}`);
  return data ? CaseSecretSchema.parse(data.secret) : null;
}

/** The case scheduled for today (or the latest past day), or null. */
export async function getTodaysCaseNumber(): Promise<number | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("schedule");

  const today = new Date().toISOString().slice(0, 10); // schedule dates are UTC
  const { data, error } = await createSupabaseAdminClient()
    .from("daily_schedule")
    .select("publish_date, cases!inner(case_number, status)")
    .lte("publish_date", today)
    .eq("cases.status", "approved")
    .order("publish_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getTodaysCaseNumber: ${error.message}`);
  return data?.cases.case_number ?? null;
}
