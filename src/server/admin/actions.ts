"use server";

import { updateTag } from "next/cache";
import { z } from "zod";
import { recheckDraft, runPipeline } from "@/server/generator/pipeline";
import { createSupabaseAdminClient } from "@/server/supabase";
import { requireAdmin } from "./auth";

/*
 * Admin mutations, as Server Actions. Each one checks the caller is an admin
 * itself: Server Actions can be called with a plain POST, not only from our UI.
 * After a change, updateTag() expires the cached case/schedule reads so the
 * game shows the new state at once.
 */

export type ActionState = { ok: boolean; message: string } | null;

const CaseId = z.uuid();
const Day = z.iso.date();
const Difficulty = z.enum(["easy", "medium", "hard"]);

/** Vercel Hobby allows 300 s per request; leave room to save the result. */
const GENERATION_BUDGET_MS = 270_000;

function refreshGameCaches(): void {
  updateTag("cases");
  updateTag("schedule");
}

/** Turns Postgres errors from our functions into messages an admin can act on. */
function explain(error: { code?: string; message: string }): string {
  if (error.code === "23505") return "That day already has a case.";
  return error.message;
}

export async function approveCase(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = CaseId.safeParse(form.get("caseId"));
  const rawDate = form.get("publishDate");
  const date = rawDate ? Day.safeParse(rawDate) : null;
  if (!id.success || (date && !date.success)) return { ok: false, message: "Invalid input." };

  const { data, error } = await createSupabaseAdminClient().rpc("approve_case", {
    p_case_id: id.data,
    ...(date?.success ? { p_publish_date: date.data } : {}),
  });
  if (error) return { ok: false, message: explain(error) };
  refreshGameCaches();
  return {
    ok: true,
    message: date?.success
      ? `Approved as case #${data}, published on ${date.data}.`
      : `Approved as case #${data}, in the pool (no day yet).`,
  };
}

export async function rejectCase(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = CaseId.safeParse(form.get("caseId"));
  const notes = z
    .string()
    .trim()
    .max(2000)
    .safeParse(form.get("notes") ?? "");
  if (!id.success || !notes.success) return { ok: false, message: "Invalid input." };

  const db = createSupabaseAdminClient();
  const { data: draft } = await db.from("cases").select("status").eq("id", id.data).maybeSingle();
  if (draft?.status !== "draft") return { ok: false, message: "Only drafts can be rejected." };

  // A review row records the decision; the case itself stays a draft.
  const { error } = await db.from("case_reviews").insert({
    case_id: id.data,
    decision: "rejected",
    admin_notes: notes.data ? `Admin: ${notes.data}` : "Rejected by admin.",
  });
  if (error) return { ok: false, message: error.message };
  return { ok: true, message: "Rejected." };
}

export async function scheduleCase(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = CaseId.safeParse(form.get("caseId"));
  const date = Day.safeParse(form.get("publishDate"));
  if (!id.success || !date.success) return { ok: false, message: "Pick a day." };

  const { error } = await createSupabaseAdminClient().rpc("schedule_case", {
    p_case_id: id.data,
    p_publish_date: date.data,
  });
  if (error) return { ok: false, message: explain(error) };
  refreshGameCaches();
  return { ok: true, message: `Scheduled for ${date.data}.` };
}

export async function unscheduleDay(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const date = Day.safeParse(form.get("publishDate"));
  if (!date.success) return { ok: false, message: "Invalid day." };

  const { error } = await createSupabaseAdminClient().rpc("unschedule_day", {
    p_publish_date: date.data,
  });
  if (error) return { ok: false, message: explain(error) };
  refreshGameCaches();
  return { ok: true, message: `${date.data} is free again.` };
}

export async function recheckCase(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const id = CaseId.safeParse(form.get("caseId"));
  if (!id.success) return { ok: false, message: "Invalid input." };
  try {
    const outcome = await recheckDraft(id.data, { deadline: Date.now() + GENERATION_BUDGET_MS });
    return {
      ok: outcome.decision === "pending",
      message:
        outcome.decision === "pending"
          ? "All checks passed."
          : `Checks failed: ${outcome.reasons.join(" | ")}`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Recheck failed." };
  }
}

export async function generateCase(_prev: ActionState, form: FormData): Promise<ActionState> {
  await requireAdmin();
  const difficulty = Difficulty.safeParse(form.get("difficulty"));
  if (!difficulty.success) return { ok: false, message: "Pick a difficulty." };
  const theme = z
    .string()
    .trim()
    .max(200)
    .safeParse(form.get("theme") ?? "");

  try {
    const outcome = await runPipeline({
      difficulty: difficulty.data,
      theme: theme.success && theme.data ? theme.data : undefined,
      deadline: Date.now() + GENERATION_BUDGET_MS,
    });
    if (outcome.decision === "failed") {
      return { ok: false, message: `Generation failed: ${outcome.reasons.join(" | ")}` };
    }
    return {
      ok: outcome.decision === "pending",
      message:
        outcome.decision === "pending"
          ? `"${outcome.title}" is ready for review.`
          : `"${outcome.title}" was saved but rejected: ${outcome.reasons.join(" | ")}`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Generation failed." };
  }
}
