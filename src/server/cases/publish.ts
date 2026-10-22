import "server-only";

import { DifficultySchema } from "@/lib/case/schema";
import { pickForDay } from "@/lib/case/weekday";
import { utcToday } from "@/server/cases/repository";
import { createSupabaseAdminClient } from "@/server/supabase";

export type PublishResult =
  | { status: "already_scheduled"; date: string; caseNumber: number | null }
  | { status: "filled_from_pool"; date: string; caseNumber: number | null }
  | { status: "pool_empty"; date: string };

/**
 * Makes sure today (UTC) has a case. If the admin scheduled one, nothing to do.
 * Otherwise an approved case without a day is put on today: the oldest of the
 * difficulty the weekday asks for, or of the closest one (see weekday.ts). If
 * the pool is empty too, the home page keeps showing the latest past case.
 *
 * Safe to run twice: a second run finds today already scheduled, and the
 * unique publish_date stops two parallel runs from both inserting.
 */
export async function ensureTodayHasCase(): Promise<PublishResult> {
  const db = createSupabaseAdminClient();
  const date = utcToday();

  const { data: today, error } = await db
    .from("daily_schedule")
    .select("cases(case_number)")
    .eq("publish_date", date)
    .maybeSingle();
  if (error) throw new Error(`Reading today's schedule failed: ${error.message}`);
  if (today) return { status: "already_scheduled", date, caseNumber: today.cases.case_number };

  // Approved cases with no row in daily_schedule.
  const { data: pool, error: poolError } = await db
    .from("cases")
    .select("id, case_number, difficulty, daily_schedule(publish_date)")
    .eq("status", "approved")
    .is("daily_schedule", null);
  if (poolError) throw new Error(`Reading the pool failed: ${poolError.message}`);
  const next = pickForDay(
    pool.map((c) => ({
      id: c.id,
      caseNumber: c.case_number,
      difficulty: DifficultySchema.parse(c.difficulty),
    })),
    date,
  );
  if (!next) return { status: "pool_empty", date };

  const { error: insertError } = await db
    .from("daily_schedule")
    .insert({ publish_date: date, case_id: next.id });
  // 23505: a parallel run got there first, which is fine.
  if (insertError && insertError.code !== "23505") {
    throw new Error(`Scheduling failed: ${insertError.message}`);
  }
  return { status: "filled_from_pool", date, caseNumber: next.caseNumber };
}
