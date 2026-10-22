import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { routing } from "./i18n/routing";
import { refreshSupabaseSession } from "./lib/supabase/proxy";

const handleI18nRouting = createMiddleware(routing);

/*
 * Runs before every matched request:
 * - pages: next-intl redirects "/" to "/en" or "/tr" and keeps the locale prefix;
 * - everything: the player's Supabase session cookie is refreshed.
 */
export default async function proxy(request: NextRequest) {
  const isApi = request.nextUrl.pathname.startsWith("/api");
  return refreshSupabaseSession(request, () =>
    isApi ? NextResponse.next({ request }) : handleI18nRouting(request),
  );
}

export const config = {
  // Skips Next internals, files with an extension and the generated icons (/icon, /apple-icon).
  matcher: ["/((?!_next|_vercel|icon|apple-icon|.*\\..*).*)"],
};
