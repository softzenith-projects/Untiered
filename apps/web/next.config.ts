import { existsSync } from "node:fs";
import { join } from "node:path";

import { withSentryConfig } from "@sentry/nextjs/config";
import type { NextConfig } from "next";

/*
 * There is one .env, at the repository root, shared by both apps. Next only looks in
 * its own directory, so load the root file here — for dev, build and start alike.
 * Variables already present in the environment win, which is what CI and deployments
 * rely on.
 */
const rootEnvFile = join(process.cwd(), "..", "..", ".env");
if (existsSync(rootEnvFile)) {
  process.loadEnvFile(rootEnvFile);
}

/*
 * Browser hardening that cannot break a page, sent on every response.
 *
 * The interview room opens the microphone and camera, so it must never be framed by
 * another site (clickjacking a consent click is the attack) and no third-party frame may
 * ask for either device. A full script/style Content-Security-Policy is deliberately not
 * here yet: Pyodide, Supabase, signed storage URLs and blob audio each need allowances
 * that should be proven in a real browser before they are enforced.
 */
const SECURITY_HEADERS = [
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; object-src 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "microphone=(self), camera=(self), geolocation=(), payment=(), usb=(), interest-cohort=()",
  },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
];

/*
 * Pages that should never appear in search results, whoever is looking at them. Most of these
 * redirect a signed-out crawler to /login anyway, so this is the second layer: it holds if a
 * route guard is ever loosened. Courses and the Arena are left out because whether they
 * belong in search is the owner's decision, not a side effect of this list.
 */
const NOINDEX_ROUTES =
  "/:route(dashboard|history|profile|report|rounds|interview|questions|upgrade|daily-challenge|unsubscribe|login|auth|api)/:path*";

const nextConfig: NextConfig = {
  // A self-contained server for the container image (apps/web/Dockerfile sets this). Off
  // otherwise, so `next dev`, `next start` and Vercel-style hosts are unchanged.
  ...(process.env.NEXT_OUTPUT_STANDALONE === "true"
    ? { output: "standalone" as const, outputFileTracingRoot: join(process.cwd(), "..", "..") }
    : {}),
  // Shared API types are consumed straight from TypeScript source in the workspace.
  transpilePackages: ["@untiered/shared"],
  typedRoutes: true,
  /*
   * No framework badge, and no route-info panel, over the candidate's interview.
   *
   * These only ever render in development, but development is where the product is
   * looked at and judged — and a floating "Static Route / prerendered at build time"
   * card sitting over a live interview reads as somebody's half-finished project. The
   * information is available in the terminal and the build output either way.
   */
  devIndicators: false,
  experimental: {
    agentUpgrade: "security",
    /*
     * Keep a visited on-demand page in the browser's router cache for a minute, so going
     * back to a tab you just left is instant instead of another server round trip (the
     * default is zero). Safe because personal data on these pages is fetched client-side
     * on mount, not baked into the server payload, and sign-out calls `router.refresh()`,
     * which empties this cache.
     */
    staleTimes: { dynamic: 60 },
  },
  async headers() {
    return [
      { source: "/:path*", headers: SECURITY_HEADERS },
      { source: NOINDEX_ROUTES, headers: [{ key: "X-Robots-Tag", value: "noindex" }] },
    ];
  },
};

/*
 * Source maps are uploaded only when SENTRY_AUTH_TOKEN, SENTRY_ORG and SENTRY_PROJECT are
 * set (a production build); without them the build is unchanged and nothing is sent.
 */
export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  telemetry: false,
});
