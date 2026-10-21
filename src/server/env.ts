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
  // Case generation runs offline, so it can use a slower model that reasons
  // before answering (a "thinking" model): fewer broken plots.
  GEMINI_GENERATOR_MODEL: z
    .string()
    .optional()
    .transform((v) => (v ? v : "gemini-flash-latest")),
  // The blind solver that checks a generated case. A lighter model on purpose:
  // if even it can name the killer from the full facts, the case is fair. It
  // also has its own, larger free quota (the thinking model gets ~20 calls a day).
  GEMINI_SOLVER_MODEL: z
    .string()
    .optional()
    .transform((v) => (v ? v : "gemini-flash-lite-latest")),
});

export type AiEnv = z.infer<typeof AiEnvSchema>;

export function getAiEnv(): AiEnv {
  return AiEnvSchema.parse(process.env);
}
