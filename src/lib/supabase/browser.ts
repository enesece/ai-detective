import { createBrowserClient } from "@supabase/ssr";

/*
 * Browser client. Uses only the publishable key, so everything it can read is
 * limited by Row Level Security. Never import the secret key here.
 */
export function createSupabaseBrowserClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY");
  }
  return createBrowserClient(url, key);
}
