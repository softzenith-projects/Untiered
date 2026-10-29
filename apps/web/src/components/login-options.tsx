"use client";

import { useState } from "react";

import { EmailPasswordAuth } from "@/components/email-password-auth";
import { SignInWithGoogle } from "@/components/sign-in-with-google";

/**
 * Both ways in share one email opt-in. While the email form is creating an account its
 * checkbox sits above "Create account" and also covers Google; otherwise it sits above
 * the Google button. Either way the page shows it once.
 */
export function LoginOptions({ next }: { next: string }) {
  const [emailOptIn, setEmailOptIn] = useState(false);
  const [signingUp, setSigningUp] = useState(false);

  return (
    <>
      <EmailPasswordAuth
        next={next}
        emailOptIn={emailOptIn}
        onEmailOptInChange={setEmailOptIn}
        onModeChange={(mode) => setSigningUp(mode === "sign-up")}
      />

      <div className="flex items-center gap-3 text-micro font-semibold uppercase tracking-wider text-ink-subtle" aria-hidden="true">
        <span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" />
      </div>
      <SignInWithGoogle next={next} emailOptIn={emailOptIn} onEmailOptInChange={setEmailOptIn} showEmailOptIn={!signingUp} />
    </>
  );
}
