"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";

import { BrandWordmark } from "@/components/brand-logo";
import { Button } from "@/components/ui/button";
import { authErrorMessage } from "@/lib/auth-errors";
import { PASSWORD_RULE, meetsPasswordRule } from "@/lib/password-rule";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function PasswordUpdateForm() {
  const [ready, setReady] = useState(false);
  const [validSession, setValidSession] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    let active = true;
    createSupabaseBrowserClient().auth.getUser().then(({ data }) => {
      if (active) {
        setValidSession(Boolean(data.user));
        setReady(true);
      }
    }).catch(() => {
      if (active) setReady(true);
    });
    return () => { active = false; };
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError(null);
    if (!meetsPasswordRule(password)) {
      setError(PASSWORD_RULE);
      return;
    }
    if (password !== confirmation) {
      setError("Passwords do not match.");
      return;
    }

    setPending(true);
    try {
      const { error: updateError } = await createSupabaseBrowserClient().auth.updateUser({ password });
      if (updateError) throw updateError;
      setPassword("");
      setConfirmation("");
      setSaved(true);
    } catch (updateError) {
      setError(authErrorMessage(updateError, "reset"));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-surface-tint px-6 py-12">
      <div className="w-full max-w-md rounded-surface border border-line bg-surface-raised p-7 shadow-[var(--shadow-lg)] sm:p-10">
        <Link href="/" className="mb-8 flex w-fit focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="Untiered home">
          <BrandWordmark />
        </Link>
        <h1 className="text-title font-bold text-ink">Set a new password</h1>
        {!ready ? (
          <p role="status" className="mt-4 text-body text-ink-muted">Checking your reset link…</p>
        ) : !validSession ? (
          <div className="mt-4 flex flex-col gap-4">
            <p role="alert" className="text-body text-ink-muted">This reset link is invalid or has expired. Request a new one from the sign-in page.</p>
            <Link href="/login" className="font-semibold text-accent hover:underline">Go to sign in</Link>
          </div>
        ) : saved ? (
          <div className="mt-4 flex flex-col gap-4">
            <p role="status" className="text-body text-ink-muted">Your password has been updated.</p>
            <Link href="/dashboard" className="font-semibold text-accent hover:underline">Continue to your dashboard</Link>
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 flex flex-col gap-4">
            <p className="text-caption text-ink-muted">{PASSWORD_RULE}</p>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="new-password" className="text-caption font-semibold text-ink">New password</label>
              <input id="new-password" type="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} disabled={pending} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30" />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="confirm-new-password" className="text-caption font-semibold text-ink">Confirm new password</label>
              <input id="confirm-new-password" type="password" autoComplete="new-password" required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={pending} className="min-h-11 rounded-xl border border-line bg-surface px-4 text-body text-ink outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/30" />
            </div>
            {error ? <p role="alert" className="text-caption text-danger">{error}</p> : null}
            <Button type="submit" disabled={pending} aria-busy={pending} className="w-full">
              {pending ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
