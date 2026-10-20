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
