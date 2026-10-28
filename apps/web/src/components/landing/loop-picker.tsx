"use client";

import { useState } from "react";

import { SegmentedTabs } from "@/components/landing/segmented-tabs";

type LoopId = "service" | "product" | "europe" | "indian" | "gcc";

type Loop = { id: LoopId; tab: string; examples: string; rounds: readonly string[]; note?: string };

/**
 * The archetypes and the rounds they typically run.
 *
 * Owner's correction (28 October 2026): Big Four hiring for technical roles runs like
 * service-based IT — there is no case discussion — so the two share a tab. And employers
 * abroad run the same technical rounds as anywhere else, with competency and values
 * rounds on top. The lists are typical, not exhaustive, and the panel says so.
 */
export const LOOPS: readonly [Loop, ...Loop[]] = [
  {
    id: "service",
    tab: "Service IT & Big Four",
    examples: "TCS · Infosys · Wipro · Cognizant · Deloitte · EY · PwC · KPMG · Accenture",
    rounds: ["Technical interview", "Project walkthrough", "Techno-managerial", "HR fit"],
    note: "Big Four hiring for technical roles follows this pattern too.",
  },
  { id: "product", tab: "Global product", examples: "Google · Amazon · Microsoft · Atlassian", rounds: ["Coding", "System design", "Behavioural", "Bar raiser"] },
  {
    id: "europe",
    tab: "Europe & abroad",
    examples: "Booking · Adyen · SAP · Zalando",
    rounds: ["Technical rounds", "Competency round", "Values fit", "HR and relocation"],
    note: "The technical rounds are the same as anywhere else. Competency and values rounds come on top.",
  },
  { id: "indian", tab: "Indian product", examples: "Zoho · Razorpay · Zerodha · Swiggy", rounds: ["Practical coding", "Product sense", "Founder round"] },
  { id: "gcc", tab: "GCC", examples: "Global banks, retail and pharma captives", rounds: ["Technical rounds", "Domain depth", "Stakeholder management"] },
];

/**
 * "Each archetype runs its own structure" made clickable: pick a loop, see the rounds it
 * typically runs in order. Replaces a six-card grid that said the same thing in paragraphs.
 */
export function LoopPicker() {
  const [loopId, setLoopId] = useState<LoopId>("service");
  const loop = LOOPS.find((l) => l.id === loopId) ?? LOOPS[0];

  return (
    <div className="flex flex-col gap-6">
      <SegmentedTabs
        label="Interview loop"
        idPrefix="loop-picker"
        options={LOOPS.map((l) => ({ id: l.id, label: l.tab }))}
        value={loopId}
        onChange={setLoopId}
      />

      <div id="loop-picker-panel" role="tabpanel" aria-labelledby={`loop-picker-tab-${loopId}`} className="card p-5 sm:p-7">
        <p className="font-mono text-caption text-ink-subtle">{loop.examples}</p>
        <ol key={loop.id} className="mt-5 grid gap-3 sm:auto-cols-fr sm:grid-flow-col">
          {loop.rounds.map((round, index) => (
            <li
              key={round}
              className="rise-in relative flex items-center gap-3 rounded-xl border border-line bg-surface p-4 sm:flex-col sm:items-start"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-accent-wash font-mono text-caption font-bold text-accent">
                {index + 1}
              </span>
              <span className="text-heading font-bold text-ink">{round}</span>
            </li>
          ))}
        </ol>
        <p className="mt-5 text-caption text-ink-muted">
          {loop.note ? `${loop.note} ` : ""}
          These are the usual rounds, not a fixed list: a real loop can add an online test or extra technical rounds, or skip one.
        </p>
      </div>
    </div>
  );
}
