import { NextResponse, type NextRequest } from "next/server";

import { safeNext } from "@/lib/safe-next";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Completes the PKCE exchange for Google or an email link, then sends the candidate on.
 * The session lands in cookies here; the API still verifies the token independently.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));

  if (searchParams.get("error")) {
    // Supabase reports provider failures and expired email links on the query string.
    // A used or superseded sign-up confirmation arrives as otp_expired; calling that a
    // failed sign-in sent candidates looking for a problem with Google.
    const linkExpired = next === "/auth/update-password" || searchParams.get("error_code") === "otp_expired";
    return NextResponse.redirect(`${origin}/login?error=${linkExpired ? "link_expired" : "oauth"}`);
  }

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=${next === "/auth/update-password" ? "link_expired" : "exchange_failed"}`);
  }

  return NextResponse.redirect(`${origin}${next}`);
}
