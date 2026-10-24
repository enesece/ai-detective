import "server-only";

import { z } from "zod";
import {
  ChatModelError,
  type ChatModel,
  type ChatRequest,
  type JsonModel,
  type JsonRequest,
  type JsonResult,
} from "./types";

const API_BASE = "https://generativelanguage.googleapis.com/v1beta/models";

// Only the fields we read from each streamed chunk.
const ChunkSchema = z.object({
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
              .optional(),
          })
          .optional(),
      }),
    )
    .optional(),
});

/** Gemini over plain fetch + Server-Sent Events, no SDK needed. */
export function createGeminiModel(apiKey: string, model: string): ChatModel {
  return {
    id: `gemini:${model}`,
    async *streamChat(request: ChatRequest) {
      const response = await fetch(`${API_BASE}/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: request.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [
            ...request.history.map((turn) => ({ role: turn.role, parts: [{ text: turn.text }] })),
            { role: "user", parts: [{ text: request.message }] },
          ],
          generationConfig: {
            maxOutputTokens: request.maxOutputTokens,
            temperature: request.temperature,
          },
        }),
      });

      if (!response.ok || !response.body) {
        // Don't forward the body: it can echo request details.
        throw new ChatModelError(`Gemini request failed (${response.status})`, response.status);
      }

      yield* readSseText(response.body);
    },
  };
}

/** Parses `data: {...}` lines from an SSE stream and yields each event's JSON. */
async function* readSseEvents(
  body: ReadableStream<Uint8Array<ArrayBuffer>>,
): AsyncGenerator<unknown> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += value;

      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? ""; // keep a partial line for the next read

      for (const line of lines) {
        if (line.startsWith("data:")) yield JSON.parse(line.slice(5));
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/** The text parts of a streamed answer (the model's private "thoughts" are skipped). */
async function* readSseText(body: ReadableStream<Uint8Array<ArrayBuffer>>): AsyncGenerator<string> {
  for await (const event of readSseEvents(body)) {
    const parsed = ChunkSchema.safeParse(event);
    if (!parsed.success) continue;
    for (const part of parsed.data.candidates?.[0]?.content?.parts ?? []) {
      if (part.text && !part.thought) yield part.text;
    }
  }
}

const GenerateResponseSchema = z.object({
  // Sent instead of candidates when the request fails mid-stream (e.g. overloaded).
  error: z.object({ code: z.number().optional(), message: z.string().optional() }).optional(),
  candidates: z
    .array(
      z.object({
        content: z
          .object({
            parts: z
              .array(z.object({ text: z.string().optional(), thought: z.boolean().optional() }))
              .optional(),
          })
          .optional(),
        finishReason: z.string().optional(),
      }),
    )
    .optional(),
  usageMetadata: z
    .object({
      promptTokenCount: z.number().optional(),
      candidatesTokenCount: z.number().optional(),
      thoughtsTokenCount: z.number().optional(),
    })
    .optional(),
});

/** Structured output: Gemini constrains its answer to the given JSON Schema. */
export function createGeminiJsonModel(apiKey: string, model: string): JsonModel {
  return {
    id: `gemini:${model}`,
    async generateJson(request: JsonRequest): Promise<JsonResult> {
      const schema = toGeminiSchema(request.schema);

      // Streamed even though we wait for the whole answer: the response headers
      // arrive at once, so a thinking model that takes over 5 minutes doesn't
      // hit Node's 300 s headers timeout (UND_ERR_HEADERS_TIMEOUT).
      const response = await fetch(`${API_BASE}/${model}:streamGenerateContent?alt=sse`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        signal: request.signal,
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: request.system }] },
          contents: [{ role: "user", parts: [{ text: request.prompt }] }],
          generationConfig: {
            maxOutputTokens: request.maxOutputTokens,
            temperature: request.temperature,
            responseMimeType: "application/json",
            responseJsonSchema: schema,
            ...(request.streamThoughts ? { thinkingConfig: { includeThoughts: true } } : {}),
          },
        }),
      });

      if (!response.ok) {
        // A short excerpt helps debug schema problems; this runs offline, never for players.
        const body = await response.text();
        throw new ChatModelError(
          `Gemini request failed (${response.status}): ${body.slice(0, 500)}`,
          response.status,
          parseRetryDelay(body),
        );
      }

      if (!response.body) throw new ChatModelError("Gemini returned no body");
      let text = "";
      let finishReason: string | undefined;
      let usage: z.infer<typeof GenerateResponseSchema>["usageMetadata"];
      for await (const event of readSseEvents(response.body)) {
        const data = GenerateResponseSchema.parse(event);
        if (data.error) {
          const code = data.error.code ?? 503;
          throw new ChatModelError(
            `Gemini stream error (${code}): ${(data.error.message ?? "").slice(0, 300)}`,
            code,
          );
        }
        const candidate = data.candidates?.[0];
        for (const part of candidate?.content?.parts ?? []) {
          if (!part.thought) text += part.text ?? "";
        }
        // The last event carries why it stopped and the token counts.
        finishReason = candidate?.finishReason ?? finishReason;
        usage = data.usageMetadata ?? usage;
      }

      // No finish reason: the connection closed before the answer was done. Worth a retry.
      if (!finishReason) {
        throw new ChatModelError(
          `Gemini's stream ended before the answer finished (${text.length} characters received)`,
          503,
        );
      }
      if (finishReason !== "STOP") {
        throw new ChatModelError(`Gemini stopped early: ${finishReason}`);
      }
      if (!text) {
        // Seen with the thinking model: it "finishes" after thinking without writing anything.
        throw new ChatModelError(
          `Gemini returned no text (finish: ${finishReason}, thinking tokens: ${usage?.thoughtsTokenCount ?? "?"}, output tokens: ${usage?.candidatesTokenCount ?? "?"})`,
          500,
        );
      }

      return {
        text,
        usage: usage
          ? {
              inputTokens: usage.promptTokenCount ?? 0,
              outputTokens: usage.candidatesTokenCount ?? 0,
              thinkingTokens: usage.thoughtsTokenCount ?? 0,
            }
          : null,
      };
    },
  };
}

/*
 * Keywords Gemini rejects in a large schema ("invalid argument"; found by
 * trial). Dropping them only loosens the hint given to the model: Zod still
 * enforces every length and count on the answer.
 */
const UNSUPPORTED_SCHEMA_KEYS = new Set(["$schema", "minLength", "minItems", "maxItems"]);

function toGeminiSchema(value: unknown): Record<string, unknown> {
  const strip = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(strip);
    if (v === null || typeof v !== "object") return v;
    return Object.fromEntries(
      Object.entries(v)
        .filter(([key]) => !UNSUPPORTED_SCHEMA_KEYS.has(key))
        .map(([key, child]) => [key, strip(child)]),
    );
  };
  const stripped = strip(value);
  return stripped !== null && typeof stripped === "object" && !Array.isArray(stripped)
    ? Object.fromEntries(Object.entries(stripped))
    : {};
}

/** Reads Gemini's RetryInfo ("retryDelay": "24s") from an error body, in ms. */
function parseRetryDelay(body: string): number | undefined {
  const match = /"retryDelay":\s*"(\d+(?:\.\d+)?)s"/.exec(body);
  if (match?.[1]) return Math.ceil(Number(match[1]) * 1000);
  // A daily quota says "Please retry in 18h20m47s" without a short delay.
  return /retry in \d+h/i.test(body) ? 24 * 60 * 60 * 1000 : undefined;
}
