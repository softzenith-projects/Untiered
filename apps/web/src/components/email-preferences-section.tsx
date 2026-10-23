"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import { fetchEmailPreferences, updateEmailPreferences, type EmailPreferenceChoices } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

const choices: { key: keyof EmailPreferenceChoices; title: string; detail: string }[] = [
  { key: "dailyQuestion", title: "Question of the Day", detail: "The complete daily question, each morning." },
  { key: "announcements", title: "News and learning notes", detail: "Occasional platform announcements and useful preparation notes." },
  { key: "reengagement", title: "Practice reminders", detail: "A reminder after 7 and 21 days away." },
];

export function EmailPreferencesSection() {
  const accessToken = useAccessToken();
  const [value, setValue] = useState<EmailPreferenceChoices | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    void fetchEmailPreferences({ accessToken, signal: controller.signal })
      .then((preferences) => {
        if (!controller.signal.aborted) setValue({
          dailyQuestion: preferences.dailyQuestion,
          announcements: preferences.announcements,
          reengagement: preferences.reengagement,
        });
      })
      .catch(() => {
        if (!controller.signal.aborted) setMessage("Email settings are unavailable. Please try again later.");
      });
    return () => controller.abort();
  }, [accessToken]);

  async function save() {
    if (!accessToken || !value || busy) return;
    setBusy(true);
    setMessage(null);
    try {
      const saved = await updateEmailPreferences(accessToken, value);
      setValue({ dailyQuestion: saved.dailyQuestion, announcements: saved.announcements, reengagement: saved.reengagement });
      setMessage("Email preferences saved.");
    } catch {
      setMessage("Could not save your email preferences. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="email-preferences-heading" className="border-t border-line pt-5">
      <h3 id="email-preferences-heading" className="text-heading font-semibold text-ink">Email preferences</h3>
      <p className="mt-1 text-caption text-ink-muted">Choose what reaches your inbox. Account and security emails are separate.</p>
      {value ? (
        <div className="mt-4 flex flex-col gap-3">
          {choices.map(({ key, title, detail }) => (
            <label key={key} className="flex cursor-pointer items-start gap-3 rounded-xl border border-line bg-surface-raised p-4">
              <input type="checkbox" checked={value[key]} onChange={(event) => setValue({ ...value, [key]: event.target.checked })} disabled={busy} className="mt-1 size-4 accent-accent" />
              <span><span className="block text-caption font-semibold text-ink">{title}</span><span className="block text-caption text-ink-muted">{detail}</span></span>
            </label>
          ))}
          <div><Button type="button" onClick={save} disabled={busy}>{busy ? "Saving…" : "Save email preferences"}</Button></div>
        </div>
      ) : null}
      {message ? <p role="status" className="mt-3 text-caption text-ink-muted">{message}</p> : null}
    </section>
  );
}
