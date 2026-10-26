"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

interface SignInWithGoogleProps {
  /** Path to land on after the exchange completes. */
  next: string;
}

export function SignInWithGoogle({ next }: SignInWithGoogleProps) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [emailOptIn, setEmailOptIn] = useState(false);

  async function signIn() {
    setPending(true);
    setError(null);

    const supabase = createSupabaseBrowserClient();
    const callback = new URL("/auth/callback", window.location.origin);
    callback.searchParams.set("next", next);
    if (emailOptIn) {
      window.sessionStorage.setItem("untiered:email-opt-in-pending", "1");
    } else {
      window.sessionStorage.removeItem("untiered:email-opt-in-pending");
    }

    const { error: signInError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callback.toString() },
    });

    if (signInError) {
      window.sessionStorage.removeItem("untiered:email-opt-in-pending");
      setPending(false);
      setError("Google sign-in could not be started. Please try again.");
    }
    // On success the browser navigates to Google, so there is nothing to reset.
  }

  return (
    <div className="flex flex-col gap-3">
      <label className="flex items-start gap-3 rounded-xl border border-line bg-surface-raised p-3 text-caption text-ink-muted">
        <input type="checkbox" checked={emailOptIn} onChange={(event) => setEmailOptIn(event.target.checked)} disabled={pending} className="mt-1 size-4 accent-accent" />
        <span>Email me the daily question, occasional platform news, and reminders if I stop visiting. I can change this anytime.</span>
      </label>
      <Button className="w-full" onClick={signIn} disabled={pending} aria-busy={pending}>
        {pending ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
      {error ? (
        <p role="alert" className="text-caption text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
