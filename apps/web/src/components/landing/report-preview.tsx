"use client";

import { useState } from "react";

import { bandFor, CompetencyBars, overallScore, scoreToneForPercent } from "@/components/report-charts";
import { PaceGauge, RingMeter, SkillRadar } from "@/components/report-visuals";
import { SAMPLE_REPORT } from "@/content/sample-report";

/**
 * The report, drawn live from its own components (owner, 4 November 2026).
 *
 * Not screenshots: a screenshot scaled into this card blurs, and drifts from the real page
 * the moment the report changes. These are the same chart components the report renders,
 * fed a demo round, so they stay sharp at any size and always match the product. The
 * round is invented and the card says so.
 */
export const GLIMPSES = [
  { id: "summary", label: "Summary" },
  { id: "glance", label: "At a glance" },
  { id: "evidence", label: "Evidence" },
] as const;

type GlimpseId = (typeof GLIMPSES)[number]["id"];

export function ReportPreview() {
  const [selected, setSelected] = useState<GlimpseId>("summary");

  return (
    <div className="card overflow-hidden shadow-[var(--shadow-md)]">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-5 py-3">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Sample report</span>
        <div role="group" aria-label="Report section" className="flex gap-1 rounded-full bg-surface-sunken p-1">
          {GLIMPSES.map((glimpse) => (
            <button
              key={glimpse.id}
              type="button"
              aria-pressed={glimpse.id === selected}
              onClick={() => setSelected(glimpse.id)}
              className={`min-h-9 rounded-full px-3 text-micro font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                glimpse.id === selected ? "bg-surface-raised text-ink shadow-[var(--shadow-sm)]" : "text-ink-muted hover:text-ink"
              }`}
            >
              {glimpse.label}
            </button>
          ))}
        </div>
      </div>

      {/*
        * One fixed height for every tab, so switching does not make the page jump. What
        * runs past the bottom fades out, the way the real page would scroll on.
        */}
      <div className="relative h-[32rem] overflow-hidden bg-surface-sunken p-4 sm:p-5">
        <div key={selected} className="rise-in flex flex-col gap-4">
          {selected === "summary" ? <SummaryGlimpse /> : selected === "glance" ? <GlanceGlimpse /> : <EvidenceGlimpse />}
        </div>
        <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-16 bg-gradient-to-t from-surface-sunken to-transparent" />
      </div>

      <p className="border-t border-line px-5 py-2.5 text-micro text-ink-subtle">
        A demo round, drawn by the report itself. No real candidate&rsquo;s answers.
      </p>
    </div>
  );
}

function SummaryGlimpse() {
  const score = overallScore(SAMPLE_REPORT.competencies) ?? 0;
  const band = bandFor(score);
  const tone = scoreToneForPercent(score);
  return (
    <>
      <header className="hero-band relative flex items-center justify-between gap-5 overflow-hidden p-5">
        <div className="flex min-w-0 flex-col gap-2">
          <p className="eyebrow text-accent-on-navy">{SAMPLE_REPORT.roundLabel} · Sample</p>
          <p className="text-heading font-bold text-balance text-on-navy">{SAMPLE_REPORT.headline}</p>
          <p className="text-caption text-on-navy-muted">{SAMPLE_REPORT.context}</p>
        </div>
        <div
          role="img"
          aria-label={`Overall score ${score} percent, ${band.name}`}
          className="grid size-24 shrink-0 place-items-center rounded-full p-1.5"
          style={{ background: `conic-gradient(var(--${tone}) ${score}%, rgba(255,255,255,0.16) 0)` }}
        >
          <div className="grid size-full place-items-center rounded-full bg-navy-raised text-center">
            <span>
              <strong className="block text-heading text-on-navy">{score}%</strong>
              <span className="block text-micro text-accent-on-navy">{band.name}</span>
            </span>
          </div>
        </div>
      </header>
      <section className="flex flex-col gap-4 rounded-xl border border-line bg-surface-raised p-5">
        <p className="eyebrow text-accent">How you did</p>
        <CompetencyBars competencies={SAMPLE_REPORT.competencies} />
      </section>
      <section className="flex flex-col gap-1.5 rounded-xl border border-line bg-surface-raised p-5">
        <p className="eyebrow text-accent">Next best action</p>
        <p className="text-body font-semibold text-ink">{SAMPLE_REPORT.nextAction.focus}</p>
        <p className="text-caption text-ink-muted">{SAMPLE_REPORT.nextAction.drill}</p>
      </section>
    </>
  );
}

function GlanceGlimpse() {
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <SkillRadar competencies={SAMPLE_REPORT.competencies} />
        <div className="flex flex-col gap-4">
          <RingMeter
            title="Answered without help"
            value={SAMPLE_REPORT.unaidedAnswers}
            total={SAMPLE_REPORT.answers}
            caption={`${SAMPLE_REPORT.unaidedAnswers} of ${SAMPLE_REPORT.answers} answers needed no nudge`}
          />
          <PaceGauge wordsPerMinute={SAMPLE_REPORT.wordsPerMinute} />
        </div>
      </div>
    </>
  );
}

/** The point of the section: each score, and the sentence it was scored on. */
function EvidenceGlimpse() {
  return (
    <>
      {SAMPLE_REPORT.competencies.slice(0, 3).map((item) => (
        <article key={item.competency} className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised p-5">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-body font-semibold text-ink">{item.competency}</h3>
            <span className="font-mono text-caption font-bold text-ink">
              {item.score}
              <span className="text-ink-subtle">/{item.maxScore}</span>
            </span>
          </div>
          <blockquote className="rounded-lg border-l-4 border-accent bg-accent-wash px-4 py-2.5 text-body text-ink italic">
            &ldquo;{item.evidenceQuote}&rdquo;
          </blockquote>
          <p className="text-caption text-ink-muted">{item.rationale}</p>
        </article>
      ))}
    </>
  );
}
