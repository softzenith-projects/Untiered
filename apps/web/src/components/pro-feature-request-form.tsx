"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox, FieldHint, FieldLabel, Textarea } from "@/components/ui/field";
import { ApiRequestError, submitProFeatureRequest, type ProFeatureKey } from "@/lib/api";
import { PRO_FEATURES } from "@/lib/pro-features";
import { useAccessToken } from "@/lib/use-access-token";

const NOTE_LIMIT = 1000;

/** Asks what Pro should include. Sending it changes nothing about the caller's plan. */
export function ProFeatureRequestForm() {
  const accessToken = useAccessToken();
  const [chosen, setChosen] = useState<ProFeatureKey[]>([]);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const trimmed = note.trim();
  const canSend = Boolean(accessToken) && !busy && (chosen.length > 0 || trimmed.length > 0);

  function toggle(key: ProFeatureKey, on: boolean) {
    setChosen((current) => (on ? [...current, key] : current.filter((item) => item !== key)));
  }

  async function send(event: React.FormEvent) {
    event.preventDefault();
    if (!accessToken || !canSend) return;
    setBusy(true);
    setMessage(null);
    try {
      await submitProFeatureRequest(accessToken, { features: chosen, note: trimmed || null });
      setSent(true);
    } catch (error) {
      setMessage(
        error instanceof ApiRequestError && error.status === 429
          ? error.message
          : "Could not send your request. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <section id="pro-request" aria-labelledby="pro-request-heading" className="card scroll-mt-24 p-6 sm:p-8">
      <h2 id="pro-request-heading" className="text-title text-ink">Tell us what Pro should include</h2>
      <p className="mt-2 text-body text-ink-muted">
        Pick what would help you most, or describe something else. We read every request.
      </p>
      {sent ? (
        <p role="status" className="mt-6 rounded-xl border border-positive/30 bg-positive-wash px-5 py-4 text-caption font-medium text-ink">
          Thanks, your request has been recorded.
        </p>
      ) : (
        <form onSubmit={send} className="mt-6 flex flex-col gap-5">
          <fieldset className="flex flex-col gap-3">
            <legend className="mb-1 text-caption font-semibold text-ink">Features</legend>
            {PRO_FEATURES.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-raised p-4 text-caption text-ink-muted">
                <Checkbox
                  checked={chosen.includes(key)}
                  onChange={(event) => toggle(key, event.target.checked)}
                  disabled={busy}
                  className="mt-0.5"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <div className="flex flex-col gap-2">
            <FieldLabel htmlFor="pro-request-note">Anything else? (optional)</FieldLabel>
            <Textarea
              id="pro-request-note"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              maxLength={NOTE_LIMIT}
              rows={4}
              disabled={busy}
              aria-describedby="pro-request-note-hint"
            />
            <FieldHint id="pro-request-note-hint">
              {note.length}/{NOTE_LIMIT} characters. Please leave out personal details.
            </FieldHint>
          </div>
          <div>
            <Button type="submit" disabled={!canSend}>
              {busy ? "Sending…" : "Send request"}
            </Button>
          </div>
          {message ? <p role="alert" className="text-caption text-danger">{message}</p> : null}
        </form>
      )}
    </section>
  );
}
