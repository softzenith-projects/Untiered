"use client";

import { useState } from "react";

import { SegmentedTabs } from "@/components/landing/segmented-tabs";

type LoopId = "service" | "consulting" | "product" | "europe" | "indian" | "gcc";

type Loop = { id: LoopId; tab: string; examples: string; rounds: readonly string[] };

/** The archetypes and their round structures, as the landing page has always named them. */
export const LOOPS: readonly [Loop, ...Loop[]] = [
  { id: "service", tab: "Service IT", examples: "TCS · Infosys · Wipro · Cognizant", rounds: ["Project walkthrough", "Techno-managerial", "HR fit"] },
  { id: "consulting", tab: "Big Four", examples: "Deloitte · EY · PwC · KPMG · Accenture", rounds: ["Case discussion", "Client scenario", "Manager round"] },
  { id: "product", tab: "Global product", examples: "Google · Amazon · Microsoft · Atlassian", rounds: ["Coding", "System design", "Behavioural", "Bar raiser"] },
  { id: "europe", tab: "Europe", examples: "Booking · Adyen · SAP · Zalando", rounds: ["Competency rounds", "Values fit", "Relocation and visa"] },
  { id: "indian", tab: "Indian product", examples: "Zoho · Razorpay · Zerodha · Swiggy", rounds: ["Practical coding", "Product sense", "Founder round"] },
  { id: "gcc", tab: "GCC", examples: "Global banks, retail and pharma captives", rounds: ["Domain depth", "Stakeholder management", "Compliance"] },
];

/**
 * "Each archetype runs its own structure" made clickable: pick a loop, see the rounds it
 * runs in order. Replaces a six-card grid that said the same thing in paragraphs.
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
      </div>
    </div>
  );
}
