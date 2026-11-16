"use client";

import type { IntegritySummary } from "@untiered/shared";
import { useCallback, useEffect, useState } from "react";

import { fetchIntegrity } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

/*
 * Integrity signals (campus module 5) beside a report: the counts for a round a college
 * assigned, shown identically to the student and to their college. They are counts, never a
 * verdict, and they never move a score — the section says so in as many words, and it uses
 * the same neutral surface as any other fact on the page, not a warning colour.
 */

export type IntegrityLoader = (options: { accessToken: string; signal: AbortSignal }) => Promise<IntegritySummary>;

export const INTEGRITY_DISCLAIMER = "These are counts, not conclusions. They never change a score.";

/** The section itself. Nothing at all for a round that was not assigned. */
export function IntegritySummaryPanel({ summary }: { summary: IntegritySummary }) {
  if (!summary.recorded) return null;
  const rows: [string, number][] = [
    ["Tab switches", summary.tabHidden],
    ["Window focus changes", summary.windowBlur],
    ["Pastes", summary.pastes],
    ["Characters pasted", summary.pastedChars],
    ["Answers begun within 1 second and 20 seconds or longer", summary.fastAnswers],
    ["Answers with a pause of 20 seconds or longer", summary.longPauses],
  ];
  return (
    <section
      aria-labelledby="integrity-signals"
      className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"
    >
      <h2 id="integrity-signals" className="text-heading text-ink">
        Integrity signals
      </h2>
      <p className="pt-1 text-caption text-ink-muted">{INTEGRITY_DISCLAIMER}</p>
      <dl className="grid gap-x-6 gap-y-2 pt-4 sm:grid-cols-[1fr_auto]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-caption text-ink-muted">{term}</dt>
            <dd className="font-mono text-caption font-semibold text-ink tabular-nums">{value.toLocaleString("en-IN")}</dd>
          </div>
        ))}
      </dl>
      {summary.notes.length > 0 ? (
        <ul className="mt-4 flex list-disc flex-col gap-1 pl-5 text-caption text-ink-muted">
          {summary.notes.map((note) => (
            <li key={note}>{note}</li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * Loads a summary and shows it. Quietly shows nothing while loading, on failure, and for a
 * round that was not assigned: this is a supplement to the report, and an error banner for it
 * would read as if something were wrong with the student's round.
 */
export function IntegritySection({ load }: { load: IntegrityLoader }) {
  const accessToken = useAccessToken();
  const [summary, setSummary] = useState<IntegritySummary | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    load({ accessToken, signal: controller.signal })
      .then((loaded) => {
        if (!controller.signal.aborted) setSummary(loaded);
      })
      .catch(() => {
        // Nothing to show; the report above is unaffected.
      });
    return () => controller.abort();
  }, [accessToken, load]);

  return summary ? <IntegritySummaryPanel summary={summary} /> : null;
}

/** The student's own round: what their college sees, exactly. */
export function OwnIntegritySection({ sessionId }: { sessionId: string }) {
  const load = useCallback<IntegrityLoader>((options) => fetchIntegrity(sessionId, options), [sessionId]);
  return <IntegritySection load={load} />;
}
