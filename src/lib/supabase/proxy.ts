import { createServerClient } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";

/**
 * Refreshes the player's Supabase session cookies on every request (Server
 * Components can't write cookies, so this happens in the proxy).
 * `makeResponse` builds the response to send (e.g. next-intl's redirect or
 * rewrite); it's called again if Supabase updates the request cookies.
 */
export async function refreshSupabaseSession(
  request: NextRequest,
  makeResponse: () => NextResponse,
): Promise<NextResponse> {
  let response = makeResponse();
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return response;

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (cookiesToSet, headers) => {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = makeResponse();
        cookiesToSet.forEach(({ name, value, options }) =>
          response.cookies.set(name, value, options),
        );
        Object.entries(headers).forEach(([header, value]) => response.headers.set(header, value));
      },
    },
  });

  // Don't put code between createServerClient and getClaims (Supabase's advice):
  // this call is what refreshes an expired token.
  await supabase.auth.getClaims();
  return response;
}
