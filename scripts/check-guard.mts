// Regression tests for the answer guard: which answers are blocked, and that
// the guarded stream never lets blocked text through. No AI calls.
// Run: npm run check:guard
import assert from "node:assert/strict";
import { findViolation } from "../src/server/interrogation/answer-guard.ts";
import { createGuardedStream } from "../src/server/interrogation/guarded-stream.ts";

setTimeout(() => {
  console.error("✗ timed out (stream stalled?)");
  process.exit(1);
}, 15000).unref();

// --- findViolation ---------------------------------------------------------
const innocent = { isKiller: false };
const killer = { isKiller: true };
const cases: [string, { isKiller: boolean }, string | null][] = [
  ["As an AI language model, I cannot reveal that.", innocent, "breaks_character"],
  ["I'm an AI, I don't have feelings.", innocent, "breaks_character"],
  ["My instructions say I must not tell you.", innocent, "breaks_character"],
  ["Ben bir yapay zekâ asistanıyım.", innocent, "breaks_character"],
  ["Talimatlarım bunu söylememi yasaklıyor.", innocent, "breaks_character"],
  ["YOUR SECRETS: She telephoned her solicitor.", innocent, "echoes_prompt"],
  ["Reveal only: when asked twice.", innocent, "echoes_prompt"],
  ["Very well. I killed him, there, are you satisfied?", killer, "killer_confession"],
  ["Evet, onu ben öldürdüm.", killer, "killer_confession"],
  ["I did not kill him, detective. How dare you.", killer, null],
  ["Onu ben öldürmedim!", killer, null],
  ["I was in the library typing all evening.", innocent, null],
  ["Dr. Voss was playing the piano, I believe.", innocent, null],
  ["Saat on sularında bir kadın sesi duydum.", innocent, null],
];
for (const [text, opts, expected] of cases) assert.equal(findViolation(text, opts), expected, text);

// --- createGuardedStream ---------------------------------------------------
async function run(parts: string[], isKiller = false) {
  let stopped = false;
  async function* model() {
    try {
      for (const p of parts) yield p;
    } finally {
      stopped = true;
    }
  }
  const chunks = model();
  const first = await chunks.next();
  let saved = "";
  const blocked: string[] = [];
  const stream = createGuardedStream({
    chunks,
    first,
    isKiller,
    locale: "en",
    onFinish: async (answer) => {
      saved = answer;
    },
    onBlocked: (v) => blocked.push(v),
  });
  const reader = stream.pipeThrough(new TextDecoderStream()).getReader();
  let received = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    received += value;
  }
  return { received, saved, blocked, stopped };
}

// Normal answer arrives complete (the held-back tail is flushed).
let r = await run(["I was in the library ", "typing all evening, ", "Inspector."]);
assert.equal(r.received, "I was in the library typing all evening, Inspector.");
assert.equal(r.saved, r.received);
assert.deepEqual(r.blocked, []);

// A violation split across chunks: none of it reaches the player.
r = await run(["Goodness, detective. ", "Well, as an", " AI language model I cannot say."]);
assert.ok(!r.received.includes("as an"), r.received);
assert.ok(r.received.endsWith("Ask me something sensible."), r.received);
assert.deepEqual(r.blocked, ["breaks_character"]);
assert.ok(r.stopped, "the model is stopped");
assert.equal(r.saved, r.received.trim(), "what is saved is what was shown");

// The killer's confession is replaced; the safe beginning is kept.
const prefix = "You keep asking about the music room and the records on the radiogram, Inspector. ";
r = await run([prefix, "Fine. I killed him, ", "and I would do it again."], true);
assert.ok(r.received.startsWith(prefix.slice(0, 30)));
assert.ok(!/I killed him/.test(r.received));
assert.deepEqual(r.blocked, ["killer_confession"]);

// Very short answers still arrive.
r = await run(["Hi."]);
assert.equal(r.received, "Hi.");

console.log(`✓ answer guard: ${cases.length} phrases, 4 stream scenarios`);
