import "server-only";

import { createHmac } from "node:crypto";
import { getServerEnv } from "./env";
import { createSupabaseAdminClient } from "./supabase";

/*
 * Per-player, per-IP and global limits, counted in Postgres
 * (check_rate_limits). The game's own rules already cap AI use at 20
 * questions per case; these stop scripted abuse and protect the free AI quota.
 */

type Rule = { key: string; limit: number; windowSeconds: number };

const MINUTE = 60;
const DAY = 24 * 60 * MINUTE;

/** Stays under the free Gemini tier for the whole app; adjust to the current quota. */
// An empty or invalid value falls back to the default instead of becoming 0.
const AI_CALLS_PER_DAY = Number(process.env.AI_DAILY_LIMIT) || 1000;

export type LimitedAction = "ask" | "hint" | "accuse";

const PER_PLAYER: Record<LimitedAction, number> = { ask: 8, hint: 10, accuse: 10 };
const PER_IP: Record<LimitedAction, number> = { ask: 30, hint: 40, accuse: 40 };

/**
 * The client IP as seen by Vercel (first x-forwarded-for entry). Hashed with
 * the server secret before storage: rate limiting needs equality, not the IP.
 */
function hashedIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const ip = forwarded || request.headers.get("x-real-ip") || "unknown";
  return createHmac("sha256", getServerEnv().SUPABASE_SECRET_KEY)
    .update(ip)
    .digest("base64url")
    .slice(0, 22);
}

/** True when this request is allowed. Every rule is counted, allowed or not. */
export async function withinRateLimits(
  action: LimitedAction,
  playerId: string,
  request: Request,
): Promise<boolean> {
  const rules: Rule[] = [
    { key: `${action}:player:${playerId}`, limit: PER_PLAYER[action], windowSeconds: MINUTE },
    { key: `${action}:ip:${hashedIp(request)}`, limit: PER_IP[action], windowSeconds: MINUTE },
  ];
  if (action === "ask") {
    rules.push({ key: "ai:day", limit: AI_CALLS_PER_DAY, windowSeconds: DAY });
  }

  const { data, error } = await createSupabaseAdminClient().rpc("check_rate_limits", {
    p_keys: rules.map((r) => r.key),
    p_limits: rules.map((r) => r.limit),
    p_window_seconds: rules.map((r) => r.windowSeconds),
  });
  if (error) {
    // Fail open: a broken limiter shouldn't take the game down. The game's
    // own 20-question cap still bounds AI use per player.
    console.error("[rate-limit] check failed:", error.message);
    return true;
  }
  return data === true;
}
