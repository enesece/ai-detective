import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";

/*
 * Browser client. Uses only the publishable key, so everything it can read or
 * write is limited by Row Level Security. Never import the secret key here.
 * createBrowserClient returns one shared instance per page.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createBrowserClient<Database>(url, key);
}
