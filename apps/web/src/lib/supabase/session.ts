import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

import { env } from "@/lib/env";

/**
 * Routes that require a signed-in candidate. Courses and the Arena were public until the
 * owner decided (21 Sep 2026) that a visitor should sign up or in before seeing any of it.
 * The course catalogue and overviews are the one exception since; see `isPublicCoursePage`.
 */
const PROTECTED_PREFIXES = [
  "/dashboard",
  "/questions",
  "/courses",
  "/arena",
  "/interview",
  "/rounds",
  "/profile",
  "/history",
  "/report",
  "/campus",
  "/admin",
];

/**
 * The catalogue and each course's overview are public so they can be found in search, and
 * reading a chapter still takes an account (owner, 30 Oct 2026). Matches exactly those two
 * shapes: anything deeper under `/courses`, however it is spelled, stays protected.
 */
function isPublicCoursePage(pathname: string): boolean {
  return pathname === "/courses" || /^\/courses\/[^/]+$/.test(pathname);
}

/** Matches the prefix itself or anything beneath it — `/arena` but not `/arenas`. */
function isProtected(pathname: string): boolean {
  if (isPublicCoursePage(pathname)) return false;
  return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/** Routes a signed-in candidate has no reason to see. */
const SIGNED_OUT_ONLY = ["/login"];

/**
 * Refreshes the Supabase session on guarded routes and the sign-in page, and enforces
 * the route guard. Public content does not need an auth lookup.
 *
 * The guard here is a redirect, not a security boundary — it keeps signed-out people
 * off pages that would only fail for them. Authorisation is enforced by the API,
 * which verifies the token itself on every call.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;

  // Public marketing and legal pages do not need a verified identity. Let them serve
  // without a proxy auth round trip, including when the browser prefetches footer links.
  // Public course pages still go through: a signed-in learner's session keeps refreshing
  // there, and with no session cookie there is nothing to verify and no round trip.
  if (!isProtected(pathname) && !isPublicCoursePage(pathname) && !SIGNED_OUT_ONLY.includes(pathname)) {
    return NextResponse.next({ request });
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(env.supabaseUrl, env.supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // `getClaims` verifies the access token's signature locally against the project's JWKS,
  // which it caches, instead of asking the auth server who this is. `getUser` was here
  // before and cost a network round trip to Supabase on guarded route requests —
  // including the RSC prefetches Next fires for links entering the viewport.
  //
  // This is not a weakening: `getSession` would be, because it only decodes the cookie and
  // trusts it. `getClaims` checks the signature and the expiry, and refreshes the session
  // first if the token is about to lapse. What it does not do is ask whether the account was
  // deleted or banned in the last few minutes — which does not matter here, because the
  // guard below is a redirect and not a security boundary. The API verifies the token itself
  // on every call and is the only thing standing between a request and somebody's data.
  //
  // One caveat for whoever reads this next: the round trip only actually goes away if the
  // Supabase project signs its JWTs with asymmetric keys. On a project still using the
  // legacy shared secret, `getClaims` has no key to verify against and falls back to asking
  // the server, exactly as `getUser` did. Same behaviour, no gain. Switching a project to
  // asymmetric signing keys is a dashboard action.
  const { data: claims } = await supabase.auth.getClaims();
  const user = claims?.claims.sub ? { id: claims.claims.sub } : null;

  if (!user && isProtected(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    // The query string rides along: /campus/join?token=... must survive sign-in.
    redirectUrl.search = `?next=${encodeURIComponent(pathname + request.nextUrl.search)}`;
    return NextResponse.redirect(redirectUrl);
  }

  if (user && SIGNED_OUT_ONLY.includes(pathname)) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/dashboard";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}
