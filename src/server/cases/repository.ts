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
 *
 * Players only ever see *published* cases: approved and scheduled for today
 * or an earlier day. A case approved for next week stays invisible until then.
 */

/** Schedule dates are UTC calendar days. */
export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

const DIFFICULTIES = ["easy", "medium", "hard"] as const;
type Difficulty = (typeof DIFFICULTIES)[number];

function toDifficulty(value: string): Difficulty {
  const found = DIFFICULTIES.find((d) => d === value);
  if (!found) throw new Error(`Unknown difficulty "${value}"`);
  return found;
}

/** Published case numbers, for prerendering. */
export async function listCaseNumbers(): Promise<number[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("cases", "schedule");

  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("case_number, daily_schedule!inner(publish_date)")
    .eq("status", "approved")
    .lte("daily_schedule.publish_date", utcToday())
    .order("case_number");
  if (error) throw new Error(`listCaseNumbers: ${error.message}`);
  return data.flatMap((row) => (row.case_number === null ? [] : [row.case_number]));
}

/** Only the public half. Safe to render and to pass to Client Components. */
export async function getPublicCase(caseNumber: number): Promise<PublicCase | null> {
  "use cache";
  cacheLife("hours");
  cacheTag("cases", "schedule", `case-${caseNumber}`);

  // Selects only public columns: the secret isn't even fetched here.
  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("difficulty, public_briefing, daily_schedule!inner(publish_date)")
    .eq("case_number", caseNumber)
    .eq("status", "approved")
    .lte("daily_schedule.publish_date", utcToday())
    .maybeSingle();
  if (error) throw new Error(`getPublicCase(${caseNumber}): ${error.message}`);
  if (!data) return null;

  return {
    caseNumber,
    difficulty: toDifficulty(data.difficulty),
    briefing: PublicBriefingSchema.parse(data.public_briefing),
  };
}

/** Secret half. Server only, never cached: for AI prompts, hints and accusation checks. */
export async function getCaseSecret(caseNumber: number): Promise<CaseSecret | null> {
  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select("secret, daily_schedule!inner(publish_date)")
    .eq("case_number", caseNumber)
    .eq("status", "approved")
    .lte("daily_schedule.publish_date", utcToday())
    .maybeSingle();
  if (error) throw new Error(`getCaseSecret(${caseNumber}): ${error.message}`);
  return data ? CaseSecretSchema.parse(data.secret) : null;
}

/**
 * The case scheduled for today, or the latest past day's if today is empty.
 * `isToday` is computed here, inside the cache, because a prerendered page
 * may not read the clock itself. The daily cron refreshes this tag.
 */
export async function getTodaysCase(): Promise<{
  caseNumber: number;
  publishDate: string;
  isToday: boolean;
} | null> {
  "use cache";
  cacheLife("minutes");
  cacheTag("schedule");

  const today = utcToday();
  const { data, error } = await createSupabaseAdminClient()
    .from("daily_schedule")
    .select("publish_date, cases!inner(case_number, status)")
    .lte("publish_date", today)
    .eq("cases.status", "approved")
    .order("publish_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`getTodaysCase: ${error.message}`);
  const caseNumber = data?.cases.case_number;
  return data && caseNumber != null
    ? { caseNumber, publishDate: data.publish_date, isToday: data.publish_date === today }
    : null;
}

export type ArchiveEntry = {
  caseNumber: number;
  publishDate: string;
  difficulty: Difficulty;
  title: PublicBriefingTitle;
  place: PublicBriefingTitle;
};
type PublicBriefingTitle = PublicCase["briefing"]["title"];

/** Every published case, newest day first. Public fields only. */
export async function listPublishedCases(): Promise<ArchiveEntry[]> {
  "use cache";
  cacheLife("hours");
  cacheTag("cases", "schedule");

  const { data, error } = await createSupabaseAdminClient()
    .from("daily_schedule")
    .select("publish_date, cases!inner(case_number, difficulty, status, public_briefing)")
    .lte("publish_date", utcToday())
    .eq("cases.status", "approved")
    .order("publish_date", { ascending: false });
  if (error) throw new Error(`listPublishedCases: ${error.message}`);

  return data.flatMap((row) => {
    const briefing = PublicBriefingSchema.safeParse(row.cases.public_briefing);
    if (!briefing.success || row.cases.case_number === null) return [];
    return [
      {
        caseNumber: row.cases.case_number,
        publishDate: row.publish_date,
        difficulty: toDifficulty(row.cases.difficulty),
        title: briefing.data.title,
        place: briefing.data.setting.place,
      },
    ];
  });
}
