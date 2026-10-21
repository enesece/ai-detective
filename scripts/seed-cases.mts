// Loads the hand-written case fixtures into Supabase as approved cases and
// schedules any unscheduled one for today (UTC). Safe to run again: it upserts.
// Run: npm run db:seed
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";
import { CaseSchema } from "../src/lib/case/schema.ts";
import type { Database } from "../src/lib/supabase/database.types.ts";

const FIXTURES_DIR = "src/server/cases/fixtures";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !secretKey) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY");

const db = createClient<Database>(url, secretKey, { auth: { persistSession: false } });
const today = new Date().toISOString().slice(0, 10);

for (const file of readdirSync(FIXTURES_DIR).filter((f) => f.endsWith(".json")).sort()) {
  // Same validation the app uses: a broken fixture never reaches the database.
  const parsed = CaseSchema.parse(JSON.parse(readFileSync(join(FIXTURES_DIR, file), "utf8")));

  const { data: row, error } = await db
    .from("cases")
    .upsert(
      {
        case_number: parsed.caseNumber,
        difficulty: parsed.difficulty,
        status: "approved",
        public_briefing: parsed.public,
        secret: parsed.secret,
      },
      { onConflict: "case_number" },
    )
    .select("id")
    .single();
  if (error) throw new Error(`${file}: ${error.message}`);

  const { data: scheduled } = await db
    .from("daily_schedule")
    .select("publish_date")
    .eq("case_id", row.id)
    .maybeSingle();

  if (scheduled) {
    console.log(`✓ case #${parsed.caseNumber} upserted (scheduled ${scheduled.publish_date})`);
    continue;
  }

  const { error: scheduleError } = await db
    .from("daily_schedule")
    .insert({ publish_date: today, case_id: row.id });
  if (scheduleError) {
    console.log(`✓ case #${parsed.caseNumber} upserted (not scheduled: ${scheduleError.message})`);
  } else {
    console.log(`✓ case #${parsed.caseNumber} upserted and scheduled for ${today}`);
  }
}
