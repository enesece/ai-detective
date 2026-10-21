"use client";

import { gameFetch } from "@/lib/supabase/session";
import { useEffect, useState } from "react";
import type { GameSnapshot } from "@/lib/game/rules";

type State = { status: "loading" } | { status: "ready"; snapshot: GameSnapshot | null };

/** Loads the player's progress for a case (result, hints, counters) once. */
export function useGameSnapshot(caseNumber: number): State {
  const [state, setState] = useState<State>({ status: "loading" });

  useEffect(() => {
    let cancelled = false;
    gameFetch(`/api/game/${caseNumber}`, { cache: "no-store" })
      .then((res) => (res.ok ? (res.json() as Promise<GameSnapshot>) : null))
      .catch(() => null)
      .then((snapshot) => {
        if (!cancelled) setState({ status: "ready", snapshot });
      });
    return () => {
      cancelled = true;
    };
  }, [caseNumber]);

  return state;
}
