import { describe, expect, it } from "vitest";

import { authErrorMessage, isExistingAccount, type AuthFlow } from "./auth-errors";

/** The shape supabase-js gives an AuthApiError: a message, an HTTP status, and a code. */
function supabaseError(code: string, status = 400, extra: Record<string, unknown> = {}) {
  return Object.assign(new Error(code), { name: "AuthApiError", code, status, ...extra });
}

describe("authErrorMessage", () => {
  it.each<[string, Error, AuthFlow, RegExp]>([
    ["reset to the current password", supabaseError("same_password", 422), "reset", /different from your current one/i],
    ["password without a digit", supabaseError("weak_password", 422, { reasons: ["characters"] }), "sign-up", /letter and a number/i],
    ["breached password", supabaseError("weak_password", 422, { reasons: ["pwned"] }), "reset", /known data breach/i],
    ["email already registered", supabaseError("user_already_exists", 422), "sign-up", /already exists/i],
    ["malformed email", supabaseError("email_address_invalid"), "sign-up", /valid email address/i],
    ["wrong password", supabaseError("invalid_credentials"), "sign-in", /do not match/i],
    ["unconfirmed email", supabaseError("email_not_confirmed"), "sign-in", /not confirmed yet/i],
    ["stale security check", supabaseError("captcha_failed"), "sign-up", /security check expired/i],
    ["too many emails", supabaseError("over_email_send_rate_limit", 429), "forgot", /wait a few minutes/i],
    ["too many requests", supabaseError("over_request_rate_limit", 429), "sign-in", /too many attempts/i],
    ["email sign-up switched off", supabaseError("signup_disabled", 422), "sign-up", /continue with google/i],
    ["expired reset session", supabaseError("session_not_found", 403), "reset", /reset link has expired/i],
    ["no reset session at all", Object.assign(new Error("Auth session missing!"), { name: "AuthSessionMissingError" }), "reset", /reset link has expired/i],
    ["mail server failure on sign-up", supabaseError("unexpected_failure", 500), "sign-up", /could not send your confirmation email/i],
    ["mail server failure on reset request", supabaseError("unexpected_failure", 500), "forgot", /could not send a reset link/i],
    ["offline", Object.assign(new Error("Failed to fetch"), { name: "AuthRetryableFetchError", status: 0 }), "sign-in", /could not reach the server/i],
  ])("explains a %s", (_, error, flow, message) => {
    expect(authErrorMessage(error, flow)).toMatch(message);
  });

  it("does not hint that an email is unregistered when signing in", () => {
    expect(authErrorMessage(supabaseError("invalid_credentials"), "sign-in")).not.toMatch(/no account|not registered|not found/i);
  });
});

describe("isExistingAccount", () => {
  it("recognises both codes Supabase uses for a taken email", () => {
    expect(isExistingAccount(supabaseError("user_already_exists", 422))).toBe(true);
    expect(isExistingAccount(supabaseError("email_exists", 422))).toBe(true);
    expect(isExistingAccount(supabaseError("weak_password", 422))).toBe(false);
    expect(isExistingAccount(null)).toBe(false);
  });
});
