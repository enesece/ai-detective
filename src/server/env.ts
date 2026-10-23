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
  // Optional second key, from a separate Google Cloud project, for offline work
  // (case generation, the blind solver, evals). Free-tier quotas are per project,
  // so offline runs can't use up the calls the live game needs.
  GEMINI_OFFLINE_API_KEY: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  // "-latest" aliases follow Google's current model, so the default doesn't go stale.
  GEMINI_MODEL: z
    .string()
    .optional()
    .transform((v) => (v ? v : "gemini-flash-lite-latest")),
  // Used for suspects when GEMINI_MODEL's daily free quota is used up. "none" turns it off.
  GEMINI_FALLBACK_MODEL: z
    .string()
    .optional()
    .transform((v) => (v === "none" ? undefined : v ? v : "gemini-3.1-flash-lite")),
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
  // Offline evals: the model that grades suspects' answers. Defaults to the solver's model.
  EVAL_JUDGE_MODEL: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
});

export type AiEnv = z.infer<typeof AiEnvSchema>;

export function getAiEnv(): AiEnv {
  return AiEnvSchema.parse(process.env);
}

// Optional. When both are set, the admin panel runs case generation on GitHub
// Actions instead of inside a Vercel function (which stops after 300 s).
const GitHubEnvSchema = z.object({
  GITHUB_DISPATCH_TOKEN: z
    .string()
    .optional()
    .transform((v) => (v ? v : undefined)),
  GITHUB_REPO: z
    .string()
    .regex(/^[\w.-]+\/[\w.-]+$/, "GITHUB_REPO must look like owner/name")
    .optional()
    .or(z.literal("").transform(() => undefined)),
});

export type GitHubEnv = z.infer<typeof GitHubEnvSchema>;

export function getGitHubEnv(): GitHubEnv {
  return GitHubEnvSchema.parse(process.env);
}
