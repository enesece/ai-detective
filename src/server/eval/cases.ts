import "server-only";

import {
  CaseSecretSchema,
  PublicBriefingSchema,
  type CaseSecret,
  type PublicBriefing,
} from "@/lib/case/schema";
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
