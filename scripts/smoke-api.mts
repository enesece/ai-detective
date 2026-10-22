// End-to-end smoke test against a running app (npm run dev) and the real
// Supabase project. Plays one game as a fresh player, then tries to cheat
// directly against the database with that player's credentials.
// Uses one real AI call. Run: npm run smoke
//
// Players are throwaway email users created with the secret key and signed in
// through a one-time link, because anonymous sign-in needs a real Turnstile
// token once CAPTCHA is on. They are deleted at the end.
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types.ts";

const APP = process.env.SMOKE_APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || !secretKey) throw new Error("Missing Supabase env");

const admin = createClient<Database>(url, secretKey, { auth: { persistSession: false } });
const createdUsers: string[] = [];

const step = (name: string) => console.log(`• ${name}`);

/** A player with their own cookie jar and a fresh account. */
async function newPlayer() {
  const email = `smoke-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`;
  const created = await admin.auth.admin.createUser({ email, email_confirm: true });
  if (created.error) throw new Error(`createUser failed: ${created.error.message}`);
  createdUsers.push(created.data.user.id);
  const link = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (link.error) throw new Error(`generateLink failed: ${link.error.message}`);

  const jar = new Map<string, string>();
  const auth = createServerClient<Database>(url!, key!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => toSet.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { data, error } = await auth.auth.verifyOtp({
    type: "magiclink",
    token_hash: link.data.properties.hashed_token,
  });
  if (error || !data.session) throw new Error(`sign-in failed: ${error?.message}`);
  const cookie = () => [...jar].map(([n, v]) => `${n}=${v}`).join("; ");
  const call = (path: string, body?: unknown) =>
    fetch(`${APP}${path}`, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie: cookie(), "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  // Talks to Supabase directly with the player's JWT, like a hand-crafted request would.
  const db = createClient<Database>(url!, key!, {
    global: { headers: { Authorization: `Bearer ${data.session.access_token}` } },
    auth: { persistSession: false },
  });
  const deleteSelf = () =>
    fetch(`${APP}/api/player`, { method: "DELETE", headers: { cookie: cookie() } });
  return { id: data.session.user.id, call, db, deleteSelf };
}

try {
  const p = await newPlayer();
  step(`player ${p.id.slice(0, 8)}…`);

  let res = await p.call("/api/game/1");
  let snap = await res.json();
  assert.equal(res.status, 200);
  assert.equal(snap.questionsUsed, 0);
  step("fresh snapshot is empty");

  res = await p.call("/api/hint", { caseNumber: 1 });
  snap = await res.json();
  assert.equal(res.status, 200, JSON.stringify(snap));
  assert.equal(snap.hintsUsed, 1);
  assert.equal(snap.revealedHints.length, 1);
  step("hint 1 unlocked");

  // Shown evidence must be one of the case's own items.
  res = await p.call("/api/interrogate", {
    caseNumber: 1,
    suspectId: "thomas-reed",
    question: "Explain this.",
    locale: "en",
    evidenceId: "not-in-this-case",
  });
  assert.equal(res.status, 400);
  step("unknown evidence rejected");

  res = await p.call("/api/interrogate", {
    caseNumber: 1,
    suspectId: "thomas-reed",
    question: "Where were you this evening?",
    locale: "en",
    evidenceId: "telephone-log",
  });
  const answer = await res.text();
  assert.equal(res.status, 200, answer);
  assert.equal(res.headers.get("x-questions-used"), "1");
  assert.ok(answer.trim().length > 0);
  step(`question answered: "${answer.trim().slice(0, 70)}…"`);

  snap = await (await p.call("/api/game/1")).json();
  assert.equal(snap.questionsUsed, 1);
  assert.equal(snap.exchanges.length, 1);
  assert.equal(snap.exchanges[0].evidenceId, "telephone-log");
  assert.equal(snap.hintsUsed, 1);
  // Everyone's results could hint at the answer: none while still playing.
  assert.equal(snap.stats, null);
  step("progress (with the shown evidence) persisted; no solve stats before the accusation");

  // --- Cheating attempts with the player's own credentials -----------------
  const secret = await p.db.from("cases").select("secret");
  assert.ok(secret.error, "reading cases.secret must fail");
  const ownGame = await p.db.from("games").select("id, questions_used").single();
  assert.equal(ownGame.error, null);
  const bump = await p.db
    .from("games")
    .update({ questions_used: 0 })
    .eq("id", ownGame.data!.id)
    .select();
  assert.ok(bump.error || bump.data?.length === 0, "resetting the counter must fail");
  const rpc = await p.db.rpc("reserve_question", { p_game_id: ownGame.data!.id, p_limit: 99 });
  assert.ok(rpc.error, "calling game functions must fail");
  step("blocked: read secret, reset counter, call game function");

  const note = await p.db
    .from("notes")
    .upsert({ case_number: 1, text: "smoke", pins: [] }, { onConflict: "player_id,case_number" });
  assert.equal(note.error, null, note.error?.message);
  const other = await newPlayer();
  const peek = await other.db.from("notes").select("text");
  assert.equal(peek.data?.length, 0, "another player must not see these notes");
  const peekGames = await other.db.from("games").select("id");
  assert.equal(peekGames.data?.length, 0, "another player must not see this game");
  step("notes saved; invisible to another player (and so is the game)");

  // --- Accusation ---------------------------------------------------------
  res = await p.call("/api/accuse", {
    caseNumber: 1,
    killerId: "helena-voss",
    motiveId: "exposure",
    evidenceId: "gramophone-records",
  });
  const accused = await res.json();
  assert.equal(res.status, 200, JSON.stringify(accused));
  // 100 + 30 + 20 + 19 unused × 5 − 1 hint × 15 = 230
  assert.equal(accused.result.score.total, 230);
  step("accusation scored 230");

  res = await p.call("/api/accuse", {
    caseNumber: 1,
    killerId: "julian-ashcombe",
    motiveId: "inheritance",
    evidenceId: "muddy-footprints",
  });
  assert.equal(res.status, 409);
  res = await p.call("/api/interrogate", {
    caseNumber: 1,
    suspectId: "thomas-reed",
    question: "hi",
    locale: "en",
  });
  assert.equal(res.status, 409);
  step("second accusation and further questions rejected (game over)");

  snap = await (await p.call("/api/game/1")).json();
  assert.equal(snap.result.score.total, 230);
  assert.ok(snap.stats.finished >= 1 && snap.stats.solved >= 1, JSON.stringify(snap.stats));
  step(`solve stats after the accusation: ${snap.stats.solved}/${snap.stats.finished} solved`);
  // Only the case of the day counts towards the streak.
  const day = await p.db
    .from("daily_schedule")
    .select("publish_date, cases!inner(case_number)")
    .eq("cases.case_number", 1)
    .single();
  const isToday = day.data?.publish_date === new Date().toISOString().slice(0, 10);
  const profile = await p.db.from("profiles").select("streak").single();
  assert.equal(profile.data?.streak, isToday ? 1 : 0);
  step(
    `result persisted; streak = ${profile.data?.streak} (case #1 ${isToday ? "is" : "isn't"} today's)`,
  );

  res = await fetch(`${APP}/api/interrogate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ caseNumber: 1, suspectId: "thomas-reed", question: "hi", locale: "en" }),
  });
  assert.equal(res.status, 401);
  step("request without a session rejected (401)");

  // "Delete my data": only for a signed-in, anonymous account.
  assert.equal((await fetch(`${APP}/api/player`, { method: "DELETE" })).status, 401);
  assert.equal((await p.deleteSelf()).status, 403);
  step("data deletion: 401 without a session, 403 for a non-anonymous account");

  // --- Rate limit -----------------------------------------------------------
  const spammer = await newPlayer();
  const codes: number[] = [];
  // 25 requests: even if they straddle a minute boundary (fixed windows reset),
  // one window gets more than the per-player limit of 10.
  for (let i = 0; i < 25; i++)
    codes.push((await spammer.call("/api/hint", { caseNumber: 1 })).status);
  assert.ok(
    codes.slice(0, 10).every((c) => c !== 429),
    `first 10 allowed: ${codes}`,
  );
  assert.ok(codes.includes(429), `some requests limited: ${codes}`);
  step(`rate limit: ${codes.join(" ")}`);

  console.log("✓ smoke test passed");
} finally {
  for (const id of createdUsers) await admin.auth.admin.deleteUser(id);
  console.log(`(deleted ${createdUsers.length} test users)`);
}
