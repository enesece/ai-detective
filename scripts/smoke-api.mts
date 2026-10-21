// End-to-end smoke test against a running app (npm run dev) and the real
// Supabase project. Plays one game as a fresh anonymous player, then tries to
// cheat directly against the database with that player's credentials.
// Uses one real AI call. Run: npm run smoke
import assert from "node:assert/strict";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "../src/lib/supabase/database.types.ts";

const APP = process.env.SMOKE_APP_URL ?? "http://localhost:3000";
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Missing Supabase env");

const step = (name: string) => console.log(`• ${name}`);

/** A player with their own cookie jar, signed in anonymously like the browser does. */
async function newPlayer() {
  const jar = new Map<string, string>();
  const auth = createServerClient<Database>(url!, key!, {
    cookies: {
      getAll: () => [...jar].map(([name, value]) => ({ name, value })),
      setAll: (toSet) => toSet.forEach(({ name, value }) => jar.set(name, value)),
    },
  });
  const { data, error } = await auth.auth.signInAnonymously();
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
  return { id: data.session.user.id, call, db };
}

const p = await newPlayer();
step(`anonymous player ${p.id.slice(0, 8)}…`);

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

res = await p.call("/api/interrogate", {
  caseNumber: 1,
  suspectId: "thomas-reed",
  question: "Where were you this evening?",
  locale: "en",
});
const answer = await res.text();
assert.equal(res.status, 200, answer);
assert.equal(res.headers.get("x-questions-used"), "1");
assert.ok(answer.trim().length > 0);
step(`question answered: "${answer.trim().slice(0, 70)}…"`);

snap = await (await p.call("/api/game/1")).json();
assert.equal(snap.questionsUsed, 1);
assert.equal(snap.exchanges.length, 1);
assert.equal(snap.hintsUsed, 1);
step("progress persisted in Supabase");

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
const profile = await p.db.from("profiles").select("streak").single();
assert.equal(profile.data?.streak, 1);
step("result persisted; streak = 1");

res = await fetch(`${APP}/api/interrogate`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ caseNumber: 1, suspectId: "thomas-reed", question: "hi", locale: "en" }),
});
assert.equal(res.status, 401);
step("request without a session rejected (401)");

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
