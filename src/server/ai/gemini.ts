import "server-only";

import { z } from "zod";
import { ChatModelError, type ChatModel, type ChatRequest } from "./types";

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

/** Parses `data: {...}` lines from an SSE stream and yields the text parts. */
async function* readSseText(body: ReadableStream<Uint8Array<ArrayBuffer>>): AsyncGenerator<string> {
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
        if (!line.startsWith("data:")) continue;
        const parsed = ChunkSchema.safeParse(JSON.parse(line.slice(5)));
        if (!parsed.success) continue;
        for (const part of parsed.data.candidates?.[0]?.content?.parts ?? []) {
          if (part.text && !part.thought) yield part.text;
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
