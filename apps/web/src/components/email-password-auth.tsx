"use client";

import { useState, type FormEvent } from "react";
import type { Route } from "next";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { FieldHint, FieldLabel, Input } from "@/components/ui/field";
import { Alert } from "@/components/ui/feedback";
import { TurnstileChallenge } from "@/components/turnstile-challenge";
import { PASSWORD_RULE, meetsPasswordRule } from "@/lib/password-rule";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export type Mode = "sign-in" | "sign-up" | "forgot";

interface EmailPasswordAuthProps {
  next: string;
  /** Shared with the Google button on the login page, so the page shows one checkbox, not two. */
  emailOptIn?: boolean;
  onEmailOptInChange?: (value: boolean) => void;
  onModeChange?: (mode: Mode) => void;
}

export function EmailPasswordAuth({ next, emailOptIn: sharedOptIn, onEmailOptInChange, onModeChange }: EmailPasswordAuthProps) {
  const turnstileSiteKey = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY?.trim();
  const turnstileRequired =
    process.env.NEXT_PUBLIC_REQUIRE_TURNSTILE === "true" || process.env.NODE_ENV === "production";
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("sign-in");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ownOptIn, setOwnOptIn] = useState(false);
  const emailOptIn = sharedOptIn ?? ownOptIn;
  const setEmailOptIn = onEmailOptInChange ?? setOwnOptIn;
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [captchaToken, setCaptchaToken] = useState<string | null>(null);
  const [challengeAttempt, setChallengeAttempt] = useState(0);
  const challengeRequiredForMode = Boolean(turnstileSiteKey) || (turnstileRequired && mode !== "sign-in");

  function changeMode(value: Mode) {
    setMode(value);
    onModeChange?.(value);
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setSuccess(null);
    setCaptchaToken(null);
    setChallengeAttempt((attempt) => attempt + 1);
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    setSuccess(null);

    if (mode === "sign-up" && !meetsPasswordRule(password)) {
      setError(PASSWORD_RULE);
      return;
    }
    if (mode === "sign-up" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (challengeRequiredForMode && (!turnstileSiteKey || !captchaToken)) {
      setError(
        turnstileSiteKey
          ? "Complete the security check before continuing."
          : "Security verification is unavailable. Please try again later.",
      );
      return;
    }

    setPending(true);
    const supabase = createSupabaseBrowserClient();
    try {
      if (mode === "forgot") {
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", "/auth/update-password");
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
          redirectTo: callback.toString(),
          ...(captchaToken ? { captchaToken } : {}),
        });
        if (resetError) throw resetError;
        setSuccess("If an account exists for this email, a password reset link is on its way.");
      } else if (mode === "sign-up") {
        window.sessionStorage.removeItem("untiered:email-opt-in-pending");
        const callback = new URL("/auth/callback", window.location.origin);
        callback.searchParams.set("next", next);
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            emailRedirectTo: callback.toString(),
            data: { email_marketing_opt_in: emailOptIn },
            ...(captchaToken ? { captchaToken } : {}),
          },
        });
        if (signUpError) throw signUpError;
        // With confirmations on, Supabase answers a sign-up for an already confirmed
        // email with a placeholder user that has no identities, and sends no email.
        // Saying "check your email" there leaves the candidate waiting for nothing.
        if (data.user && data.user.identities?.length === 0) {
          changeMode("sign-in");
          setError("An account already exists for this email. Sign in instead, or use Continue with Google if that is how you joined.");
          return;
        }
        if (data.session) {
          router.replace(next as Route);
          router.refresh();
        } else {
          setSuccess("Check your email for a confirmation link to finish creating your account.");
        }
      } else {
        window.sessionStorage.removeItem("untiered:email-opt-in-pending");
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
          ...(captchaToken ? { options: { captchaToken } } : {}),
        });
        if (signInError) throw signInError;
        router.replace(next as Route);
        router.refresh();
      }
    } catch {
      setError(
        mode === "forgot"
          ? "We could not send a reset link right now. Please try again."
          : mode === "sign-up"
            ? "We could not create your account. Check your details or try signing in."
            : "That email and password did not work. Please try again.",
      );
    } finally {
      setPending(false);
      if (turnstileSiteKey) {
        setCaptchaToken(null);
        setChallengeAttempt((attempt) => attempt + 1);
      }
    }
  }

  return (
    <div className="flex flex-col gap-5">
      {mode !== "forgot" ? (
        <div role="group" className="grid grid-cols-2 rounded-xl bg-surface-tint p-1" aria-label="Email account action">
          <button type="button" onClick={() => changeMode("sign-in")} aria-pressed={mode === "sign-in"} className={`min-h-11 rounded-lg text-caption font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${mode === "sign-in" ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
            Sign in
          </button>
          <button type="button" onClick={() => changeMode("sign-up")} aria-pressed={mode === "sign-up"} className={`min-h-11 rounded-lg text-caption font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${mode === "sign-up" ? "bg-surface-raised text-ink shadow-sm" : "text-ink-muted hover:text-ink"}`}>
            Create account
          </button>
        </div>
      ) : (
        <div>
          <h3 className="text-body font-semibold text-ink">Reset your password</h3>
          <p className="mt-1 text-caption text-ink-muted">We&apos;ll email you a link to choose a new one.</p>
        </div>
      )}

      <form onSubmit={submit} className="flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="auth-email">Email address</FieldLabel>
          <Input id="auth-email" type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} disabled={pending} />
        </div>
        {mode !== "forgot" ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="auth-password">Password</FieldLabel>
            <Input id="auth-password" type="password" autoComplete={mode === "sign-up" ? "new-password" : "current-password"} minLength={mode === "sign-up" ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} aria-describedby={mode === "sign-up" ? "auth-password-hint" : undefined} />
            {mode === "sign-up" ? <FieldHint id="auth-password-hint">{PASSWORD_RULE}</FieldHint> : null}
          </div>
        ) : null}
        {mode === "sign-up" ? (
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="auth-confirm-password">Confirm password</FieldLabel>
            <Input id="auth-confirm-password" type="password" autoComplete="new-password" required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} disabled={pending} />
          </div>
        ) : null}
        {mode === "sign-up" ? (
          <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-raised p-3 text-caption text-ink-muted">
            <input type="checkbox" checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)} disabled={pending} className="mt-1 size-4 accent-accent" />
            <span>Email me the daily question, occasional platform news, and reminders if I stop visiting. I can change this anytime.</span>
          </label>
        ) : null}
        {turnstileRequired && !turnstileSiteKey && mode !== "sign-in" ? (
          <Alert tone="error">Security verification is unavailable. Please try again later.</Alert>
        ) : null}
        {turnstileSiteKey ? <TurnstileChallenge key={challengeAttempt} siteKey={turnstileSiteKey} onToken={setCaptchaToken} /> : null}
        {error ? <Alert tone="error">{error}</Alert> : null}
        {success ? <Alert tone="success">{success}</Alert> : null}
        <Button type="submit" disabled={pending || (challengeRequiredForMode && (!turnstileSiteKey || !captchaToken))} aria-busy={pending} className="w-full">
          {pending ? "Please wait…" : mode === "sign-up" ? "Create account" : mode === "forgot" ? "Send reset link" : "Sign in with email"}
        </Button>
      </form>

      {mode === "sign-in" ? (
        <button type="button" onClick={() => changeMode("forgot")} className="self-center text-caption font-medium text-accent hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Forgot password?
        </button>
      ) : mode === "forgot" ? (
        <button type="button" onClick={() => changeMode("sign-in")} className="self-center text-caption font-medium text-accent hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
          Back to sign in
        </button>
      ) : null}
    </div>
  );
}
