"use client";

import { useState } from "react";

/**
 * Sample scores, shaped like the real report: every score carries the sentence it was
 * scored on. The operational-depth row is the real one from the session the hero demo
 * replays; the rest illustrate the format and the card says so.
 */
export const COMPETENCIES = [
  {
    name: "Operational depth",
    score: 2,
    quote: "If it failed we just retried it. It was mostly fine.",
    note: "No idempotency, no backoff, no mention of what “failed” meant.",
  },
  {
    name: "Problem framing",
    score: 4,
    quote: "First I'd want to know how many writes per second the ledger takes at peak.",
    note: "Asked for the number that decides the design before proposing one.",
  },
  {
    name: "Trade-offs",
    score: 3,
    quote: "A queue would be cleaner, but we didn't have time to set one up.",
    note: "Named the alternative; did not say what it would have cost or saved.",
  },
  {
    name: "Communication",
    score: 3,
    quote: "So basically, yeah, it was a worker, and it kind of just ran.",
    note: "Filler-heavy opening; the structure arrived on the second attempt.",
  },
] as const;

export function ReportPreview() {
  const [selected, setSelected] = useState(0);
  const active = COMPETENCIES[selected] ?? COMPETENCIES[0];

  return (
    <div className="card overflow-hidden shadow-[var(--shadow-md)]">
      <div className="flex items-center justify-between border-b border-line px-5 py-3">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Sample report</span>
        <span className="text-micro text-ink-subtle">Click a score</span>
      </div>

      <div className="grid md:grid-cols-[1fr_1fr]">
        <ul className="flex flex-col gap-1 p-3">
          {COMPETENCIES.map((c, index) => {
            const on = index === selected;
            return (
              <li key={c.name}>
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => setSelected(index)}
                  className={`flex w-full flex-col gap-2 rounded-xl px-3 py-3 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${on ? "bg-accent-wash" : "hover:bg-surface-sunken"}`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span className="text-caption font-semibold text-ink">{c.name}</span>
                    <span className="font-mono text-caption font-bold text-ink">
                      {c.score}<span className="text-ink-subtle">/5</span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <span key={n} className={`h-1.5 flex-1 rounded-full ${n <= c.score ? (c.score <= 2 ? "bg-highlight" : "bg-accent") : "bg-line"}`} />
                    ))}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>

        <div aria-live="polite" className="flex flex-col justify-center gap-4 border-t border-line bg-surface p-6 md:border-t-0 md:border-l">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Scored on what you said</span>
          <blockquote key={active.name} className="rise-in border-l-4 border-accent pl-4 text-heading font-semibold text-ink">
            &ldquo;{active.quote}&rdquo;
          </blockquote>
          <p className="text-caption text-ink-muted">{active.note}</p>
        </div>
      </div>

      <p className="border-t border-line px-5 py-2.5 text-micro text-ink-subtle">
        Operational depth is from a real session. The other rows show the format.
      </p>
    </div>
  );
}
