import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

// Runs before every matched request: redirects "/" to "/en" or "/tr" based on the
// browser language (or a saved cookie) and keeps the locale prefix on every URL.
export default createMiddleware(routing);

export const config = {
  // Skip API routes, Next.js internals and files with an extension (favicon.ico, images...).
  matcher: ["/((?!api|_next|_vercel|.*\\..*).*)"],
};
