"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { createSupabaseBrowserClient } from "@/lib/supabase/browser";

/*
 * The visitor's own record (streak, which cases they played), read straight
 * from Supabase with their session: RLS returns only their rows. Visitors
 * without a session get an empty record and no anonymous user is created
 * just for looking at a page.
 */

export type PlayedCase = { finished: boolean; solved: boolean; score: number | null };
export type PlayerRecord = {
  loaded: boolean;
  streak: number;
  bestStreak: number;
  games: Record<number, PlayedCase>;
};

const EMPTY: PlayerRecord = { loaded: false, streak: 0, bestStreak: 0, games: {} };

const GameRowSchema = z.object({
  status: z.string(),
  score: z.number().nullable(),
  // Only this one field of the result is selected, not the revealed solution.
  solved: z.boolean().nullable(),
  cases: z.object({ case_number: z.number().nullable() }).nullable(),
});

export function usePlayerRecord(): PlayerRecord {
  const [record, setRecord] = useState<PlayerRecord>(EMPTY);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const supabase = createSupabaseBrowserClient();
      const { data } = await supabase.auth.getSession();
      if (!data.session) {
        if (!cancelled) setRecord({ ...EMPTY, loaded: true });
        return;
      }
      const [profile, games] = await Promise.all([
        supabase.from("profiles").select("streak, best_streak, last_solved_date").maybeSingle(),
        supabase
          .from("games")
          .select("status, score, solved:result->correct->killer, cases(case_number)"),
      ]);
      const parsed = z.array(GameRowSchema).safeParse(games.data ?? []);
      const byCase: Record<number, PlayedCase> = {};
      for (const g of parsed.success ? parsed.data : []) {
        const n = g.cases?.case_number;
        if (n === null || n === undefined) continue;
        byCase[n] = {
          finished: g.status === "finished",
          solved: g.solved === true,
          score: g.score,
        };
      }
      if (!cancelled) {
        setRecord({
          loaded: true,
          streak: currentStreak(profile.data?.streak ?? 0, profile.data?.last_solved_date ?? null),
          bestStreak: profile.data?.best_streak ?? 0,
          games: byCase,
        });
      }
    })().catch(() => {
      if (!cancelled) setRecord({ ...EMPTY, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, []);

  return record;
}

/**
 * The stored streak only resets on the next game, so a player who skipped
 * yesterday would still see it. It's alive only if the last solve was today
 * or yesterday (UTC, like the schedule).
 */
function currentStreak(streak: number, lastSolved: string | null): number {
  if (!lastSolved) return 0;
  const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
  return lastSolved >= yesterday ? streak : 0;
}
