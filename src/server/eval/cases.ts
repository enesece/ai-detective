import "server-only";

import {
  CaseSecretSchema,
  PublicBriefingSchema,
  type CaseSecret,
  type PublicBriefing,
} from "@/lib/case/schema";
import { hasOfflineKey } from "@/server/ai";
import { createSupabaseAdminClient } from "@/server/supabase";

/** A case as the evals need it: both halves. Offline scripts only. */
export type EvalCase = { caseNumber: number; public: PublicBriefing; secret: CaseSecret };

/**
 * Approved cases from the database (published or still in the pool), read with
 * the secret key. `numbers` limits it to some case numbers; empty = all approved.
 */
export async function loadEvalCases(numbers: number[] = []): Promise<EvalCase[]> {
  let query = createSupabaseAdminClient()
    .from("cases")
    .select("case_number, public_briefing, secret")
    .eq("status", "approved")
    .order("case_number");
  if (numbers.length > 0) query = query.in("case_number", numbers);
  const { data, error } = await query;
  if (error) throw new Error(`Loading cases failed: ${error.message}`);
  return data.flatMap((row) =>
    row.case_number === null
      ? []
      : [
          {
            caseNumber: row.case_number,
            public: PublicBriefingSchema.parse(row.public_briefing),
            secret: CaseSecretSchema.parse(row.secret),
          },
        ],
  );
}

/** "--cases=1,2" -> [1, 2]. */
export function parseCaseList(arg: string | undefined): number[] {
  return (arg ?? "")
    .split(",")
    .map((s) => Number(s.trim()))
    .filter((n) => Number.isInteger(n) && n > 0);
}

/** Above this many AI calls an eval asks for --yes first (see confirmBudget). */
export const EVAL_CALL_BUDGET = Number(process.env.EVAL_CALL_BUDGET) || 150;

/**
 * Evals use the suspects' own model. Without GEMINI_OFFLINE_API_KEY they spend
 * the same daily free quota the players need (about 500 calls/day for
 * flash-lite), so a large run needs an explicit --yes. On 22 October one used
 * it all up and the live game had to fall back to another model.
 */
export function confirmBudget(calls: number, yes: boolean | undefined): void {
  if (hasOfflineKey()) {
    console.log(`~${calls} AI calls on the offline key (separate quota).`);
    return;
  }
  if (calls <= EVAL_CALL_BUDGET || yes) return;
  throw new Error(
    `This run makes ~${calls} AI calls from the same daily free quota the players use. ` +
      `Run fewer cases (--cases=1) or add --yes.`,
  );
}
