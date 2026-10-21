import "server-only";

import { z } from "zod";
import {
  CaseSecretSchema,
  PublicBriefingSchema,
  type CaseSecret,
  type PublicBriefing,
} from "@/lib/case/schema";
import { utcToday } from "@/server/cases/repository";
import { createSupabaseAdminClient } from "@/server/supabase";

/*
 * Reads for the admin panel. Uses the secret key, so every caller must have
 * checked getAdmin() first. Results (secrets included) are only ever rendered
 * by Server Components on admin pages, never passed to Client Components.
 */

const CheckResultSchema = z.object({
  id: z.string(),
  severity: z.enum(["error", "warning"]),
  ok: z.boolean(),
  message: z.string(),
});

const SolverRunSchema = z.object({
  mode: z.enum(["full", "briefing_only"]),
  answer: z.object({
    killerId: z.string(),
    motiveId: z.string(),
    keyEvidenceId: z.string(),
    reasoning: z.string(),
  }),
  killerProbability: z.number(),
  runnerUp: z.object({ suspectId: z.string(), probability: z.number() }).nullable(),
  correctMotive: z.boolean(),
  correctKeyEvidence: z.boolean(),
  passed: z.boolean(),
});

/** What the pipeline stores in case_reviews.checks. Loose: older reviews may lack fields. */
export const ReviewChecksSchema = z
  .object({
    theme: z.string().optional(),
    generatorModel: z.string().optional(),
    solverModel: z.string().optional(),
    durationMs: z.number().optional(),
    recheck: z.boolean().optional(),
    attempts: z
      .array(z.object({ kind: z.string(), ms: z.number(), problems: z.array(z.string()) }))
      .optional(),
    logic: z.array(CheckResultSchema).default([]),
    solver: z.array(SolverRunSchema).default([]),
    tooEasy: z.boolean().default(false),
  })
  .loose();
export type ReviewChecks = z.infer<typeof ReviewChecksSchema>;

export const DECISIONS = ["pending", "rejected", "approved"] as const;
export type Decision = (typeof DECISIONS)[number];

export type Review = {
  id: string;
  decision: Decision;
  adminNotes: string | null;
  createdAt: string;
  checks: ReviewChecks | null;
};

export type CaseRow = {
  id: string;
  caseNumber: number | null;
  status: "draft" | "approved";
  difficulty: string;
  createdAt: string;
  title: { en: string; tr: string };
  publishDate: string | null;
  review: Review | null;
};

const TitleSchema = z.object({ title: z.object({ en: z.string(), tr: z.string() }) }).loose();

type RawReview = {
  id: string;
  decision: string;
  admin_notes: string | null;
  created_at: string;
  checks: unknown;
};

function toReview(raw: RawReview): Review {
  const decision = DECISIONS.find((d) => d === raw.decision) ?? "pending";
  const checks = ReviewChecksSchema.safeParse(raw.checks);
  return {
    id: raw.id,
    decision,
    adminNotes: raw.admin_notes,
    createdAt: raw.created_at,
    checks: checks.success ? checks.data : null,
  };
}

function latest(reviews: RawReview[]): RawReview | undefined {
  return [...reviews].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
}

/** Every case, newest first, with its latest review and publish day. */
export async function listCases(): Promise<CaseRow[]> {
  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select(
      "id, case_number, status, difficulty, created_at, public_briefing, daily_schedule(publish_date), case_reviews(id, decision, admin_notes, created_at, checks)",
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(`listCases: ${error.message}`);

  return data.map((row) => {
    const title = TitleSchema.safeParse(row.public_briefing);
    const review = latest(row.case_reviews);
    return {
      id: row.id,
      caseNumber: row.case_number,
      status: row.status === "approved" ? "approved" : "draft",
      difficulty: row.difficulty,
      createdAt: row.created_at,
      title: title.success ? title.data.title : { en: "(untitled)", tr: "(başlıksız)" },
      publishDate: row.daily_schedule?.publish_date ?? null,
      review: review ? toReview(review) : null,
    };
  });
}

export type AdminCase = CaseRow & {
  briefing: PublicBriefing | null;
  secret: CaseSecret | null;
  /** Set when the stored JSON no longer matches the schema. */
  parseError: string | null;
  reviews: Review[];
};

export async function getAdminCase(id: string): Promise<AdminCase | null> {
  if (!z.uuid().safeParse(id).success) return null;
  const { data, error } = await createSupabaseAdminClient()
    .from("cases")
    .select(
      "id, case_number, status, difficulty, created_at, public_briefing, secret, daily_schedule(publish_date), case_reviews(id, decision, admin_notes, created_at, checks)",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`getAdminCase: ${error.message}`);
  if (!data) return null;

  const briefing = PublicBriefingSchema.safeParse(data.public_briefing);
  const secret = CaseSecretSchema.safeParse(data.secret);
  const reviews = [...data.case_reviews]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .map(toReview);

  return {
    id: data.id,
    caseNumber: data.case_number,
    status: data.status === "approved" ? "approved" : "draft",
    difficulty: data.difficulty,
    createdAt: data.created_at,
    title: briefing.success ? briefing.data.title : { en: "(untitled)", tr: "(başlıksız)" },
    publishDate: data.daily_schedule?.publish_date ?? null,
    review: reviews[0] ?? null,
    briefing: briefing.success ? briefing.data : null,
    secret: secret.success ? secret.data : null,
    parseError: !briefing.success
      ? briefing.error.message
      : !secret.success
        ? secret.error.message
        : null,
    reviews,
  };
}

export type ScheduleDay = {
  date: string;
  entry: { caseId: string; caseNumber: number | null; title: string } | null;
};

/** The next `days` days from today (UTC), each with its case or nothing. */
export async function getUpcomingSchedule(days: number): Promise<ScheduleDay[]> {
  const today = utcToday();
  const dates = Array.from({ length: days }, (_, i) => addDays(today, i));
  const { data, error } = await createSupabaseAdminClient()
    .from("daily_schedule")
    .select("publish_date, case_id, cases(case_number, public_briefing)")
    .gte("publish_date", today)
    .lte("publish_date", dates.at(-1) ?? today);
  if (error) throw new Error(`getUpcomingSchedule: ${error.message}`);

  return dates.map((date) => {
    const row = data.find((r) => r.publish_date === date);
    if (!row) return { date, entry: null };
    const title = TitleSchema.safeParse(row.cases.public_briefing);
    return {
      date,
      entry: {
        caseId: row.case_id,
        caseNumber: row.cases.case_number,
        title: title.success ? title.data.title.en : "(untitled)",
      },
    };
  });
}

/** "2026-10-21" + 2 days → "2026-10-23", in UTC. */
export function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
