import "server-only";

import { z } from "zod";

const ServerEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
  SUPABASE_SECRET_KEY: z.string().min(1),
});

export type ServerEnv = z.infer<typeof ServerEnvSchema>;

/** Validated lazily so pages that don't touch Supabase work without keys. */
export function getServerEnv(): ServerEnv {
  return ServerEnvSchema.parse(process.env);
}

const AiEnvSchema = z.object({
  // Empty string counts as "not set" (that's how .env.example leaves it).
  GEMINI_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // "-latest" aliases follow Google's current model, so the default doesn't go stale.
  GEMINI_MODEL: z
    .string()
    .optional()
    .transform((v) => (v ? v : "gemini-flash-lite-latest")),
});

export type AiEnv = z.infer<typeof AiEnvSchema>;

export function getAiEnv(): AiEnv {
  return AiEnvSchema.parse(process.env);
}
