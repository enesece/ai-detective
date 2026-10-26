// Checks how withFallback races the primary and fallback models, with fake
// models and short timings. No AI calls.
// Run: npm run check:fallback
import assert from "node:assert/strict";
import { withFallback } from "../src/server/ai/fallback.ts";
import { ChatModelError, type ChatModel, type ChatRequest } from "../src/server/ai/types.ts";

console.warn = () => {}; // withFallback logs every switch; not needed here

/** Speaks `text` after `delayMs`, or throws `error` then. Records whether it was aborted. */
function fake(id: string, delayMs: number, outcome: string | ChatModelError) {
  const state = { aborted: false };
  const model: ChatModel = {
    id,
    async *streamChat(request: ChatRequest) {
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, delayMs);
        request.signal?.addEventListener("abort", () => {
          state.aborted = true;
          clearTimeout(timer);
          reject(new Error("aborted"));
        });
      });
      if (typeof outcome !== "string") throw outcome;
      yield outcome;
      yield "!";
    },
  };
  return { model, state };
}

const timing = { hedgeAfterMs: 50, giveUpAfterMs: 300 };
const request: ChatRequest = {
  system: "",
  history: [],
  message: "?",
  maxOutputTokens: 10,
  temperature: 0,
};

async function answer(primary: ChatModel, fallback: ChatModel): Promise<string> {
  let text = "";
  for await (const chunk of withFallback(primary, fallback, timing).streamChat(request))
    text += chunk;
  return text;
}

// Fast primary: answers alone, fallback never asked.
{
  const p = fake("p", 10, "primary");
  const f = fake("f", 10, "fallback");
  assert.equal(await answer(p.model, f.model), "primary!");
  assert.equal(f.state.aborted, false);
}
// Slow primary, fast fallback: fallback answers, primary is stopped.
{
  const p = fake("p", 200, "primary");
  const f = fake("f", 10, "fallback");
  assert.equal(await answer(p.model, f.model), "fallback!");
  assert.equal(p.state.aborted, true);
}
// Slow primary, stuck fallback: the primary is kept and still answers (the old code dropped it).
{
  const p = fake("p", 120, "primary");
  const f = fake("f", 10_000, "fallback");
  assert.equal(await answer(p.model, f.model), "primary!");
  assert.equal(f.state.aborted, true);
}
// Primary out of quota: fallback starts at once, without waiting for the hedge.
{
  const p = fake("p", 1, new ChatModelError("quota", 429));
  const f = fake("f", 10, "fallback");
  const t = Date.now();
  assert.equal(await answer(p.model, f.model), "fallback!");
  assert.ok(Date.now() - t < timing.hedgeAfterMs, "fallback should start before the hedge time");
}
// Both stuck: gives up with a 504 at giveUpAfterMs and stops both.
{
  const p = fake("p", 10_000, "primary");
  const f = fake("f", 10_000, "fallback");
  await assert.rejects(
    answer(p.model, f.model),
    (e) => e instanceof ChatModelError && e.status === 504,
  );
  assert.equal(p.state.aborted && f.state.aborted, true);
}
// A bad request (400) is not retried on the fallback.
{
  const p = fake("p", 1, new ChatModelError("bad", 400));
  const f = fake("f", 1, "fallback");
  await assert.rejects(
    answer(p.model, f.model),
    (e) => e instanceof ChatModelError && e.status === 400,
  );
}
// Both unavailable: the last error comes through.
{
  const p = fake("p", 1, new ChatModelError("quota", 429));
  const f = fake("f", 1, new ChatModelError("bad gateway", 502));
  await assert.rejects(
    answer(p.model, f.model),
    (e) => e instanceof ChatModelError && e.status === 502,
  );
}

console.log("✓ fallback: 7 scenarios");
