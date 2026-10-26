"use client";

import { useSearchParams } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { unsubscribeEmail } from "@/lib/api";

export function UnsubscribeForm() {
  const token = useSearchParams().get("token");
  const [status, setStatus] = useState<"ready" | "busy" | "done" | "error">("ready");
  const valid = token && /^[0-9a-f-]{36}$/i.test(token);

  async function unsubscribe() {
    if (!token || !valid || status === "busy") return;
    setStatus("busy");
    try {
      await unsubscribeEmail(token);
      setStatus("done");
    } catch {
      setStatus("error");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-xl flex-col justify-center gap-5 px-6 py-16">
      <h1 className="text-title font-bold text-ink">Email preferences</h1>
      <p className="text-body text-ink-muted">Stop daily questions, platform news, and practice reminders to this address.</p>
      {status === "done" ? <p role="status">You are unsubscribed.</p> : valid ? (
        <div><Button type="button" onClick={unsubscribe} disabled={status === "busy"}>{status === "busy" ? "Unsubscribing…" : "Unsubscribe from all"}</Button></div>
      ) : <p role="alert">This unsubscribe link is incomplete.</p>}
      {status === "error" ? <p role="alert">We could not unsubscribe you right now. Please try again.</p> : null}
    </main>
  );
}
