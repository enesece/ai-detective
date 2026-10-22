import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";

/*
 * Basic security headers on every response. A strict Content-Security-Policy is
 * left out on purpose: it needs a fresh nonce per request, which would turn off
 * the static prerendering the pages rely on.
 */
const securityHeaders = [
  // Never render this site inside someone else's frame (clickjacking).
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  // Don't let the browser guess file types.
  { key: "X-Content-Type-Options", value: "nosniff" },
  // Other sites see only our domain, not the page (case or admin URLs).
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  cacheComponents: true,
  // Share images read their fonts from disk at runtime (for cases published after the build).
  outputFileTracingIncludes: { "/**/opengraph-image*": ["./assets/fonts/*.ttf"] },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Points next-intl at src/i18n/request.ts (its default location).
const withNextIntl = createNextIntlPlugin();

export default withNextIntl(nextConfig);
