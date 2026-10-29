import { PASSWORD_RULE } from "@/lib/password-rule";

export type AuthFlow = "sign-up" | "sign-in" | "forgot" | "reset";

export const EXISTING_ACCOUNT_MESSAGE =
  "An account already exists for this email. Sign in instead, or use Continue with Google if that is how you joined.";

interface AuthFailure {
  code?: unknown;
  name?: unknown;
  status?: unknown;
  reasons?: unknown;
}

function failureOf(error: unknown): AuthFailure {
  return typeof error === "object" && error !== null ? (error as AuthFailure) : {};
}

/** Supabase's answer when the email is taken and confirmations are off. */
export function isExistingAccount(error: unknown): boolean {
  const { code } = failureOf(error);
  return code === "user_already_exists" || code === "email_exists";
}

/**
 * What to tell the candidate when Supabase Auth refuses a request, by its error code.
 * Every message says what happened and what to do next; none reveals whether an
 * email is registered on the sign-in or reset-request paths.
 */
export function authErrorMessage(error: unknown, flow: AuthFlow): string {
  const { code, name, status, reasons } = failureOf(error);

  // No answer from Supabase at all: offline, blocked, or a timeout.
  if (name === "AuthRetryableFetchError" || status === 0 || (error instanceof TypeError && !code)) {
    return "We could not reach the server. Check your connection and try again.";
  }

  switch (code) {
    case "same_password":
      return "Your new password must be different from your current one.";
    case "weak_password":
      return Array.isArray(reasons) && reasons.includes("pwned")
        ? "This password has appeared in a known data breach. Choose a different one."
        : PASSWORD_RULE;
    case "user_already_exists":
    case "email_exists":
      return EXISTING_ACCOUNT_MESSAGE;
    case "email_address_invalid":
    case "validation_failed":
      return "Enter a valid email address.";
    case "invalid_credentials":
      return "That email and password do not match. Check them, or use Forgot password to set a new one.";
    case "email_not_confirmed":
      return "Your email is not confirmed yet. Open the link we sent you, or choose Create account again to get a new one.";
    case "user_banned":
      return "This account has been suspended. Contact support if you think this is a mistake.";
    case "captcha_failed":
      return "The security check expired. Complete it again and retry.";
    case "over_email_send_rate_limit":
      return "We have sent several emails to this address recently. Wait a few minutes before asking for another.";
    case "over_request_rate_limit":
      return "Too many attempts in a short time. Wait a few minutes and try again.";
    case "signup_disabled":
    case "email_provider_disabled":
      return "Creating an account with email is unavailable right now. Use Continue with Google instead.";
    case "session_not_found":
    case "session_expired":
    case "reauthentication_needed":
    case "otp_expired":
      return "Your reset link has expired. Request a new one from the sign-in page.";
  }
  if (name === "AuthSessionMissingError") {
    return "Your reset link has expired. Request a new one from the sign-in page.";
  }

  // An unexplained failure on a flow that sends an email is almost always the email.
  switch (flow) {
    case "sign-up":
      return "We could not send your confirmation email right now. Try again in a few minutes, or use Continue with Google.";
    case "forgot":
      return "We could not send a reset link right now. Try again in a few minutes.";
    case "reset":
      return "We could not update your password. Try again, or request a new reset link.";
    case "sign-in":
      return "We could not sign you in right now. Try again in a few minutes.";
  }
}
