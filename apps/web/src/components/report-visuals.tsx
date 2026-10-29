"use client";

import type { ReportCompetency, ReportSpokenEnglish, SessionReport } from "@untiered/shared";
import { useState } from "react";

import { ORDINARY_MARK } from "@/components/report-charts";

/**
 * The report at a glance, drawn: the shape of the candidate's skills, how much of the round
 * they carried alone, how much of it could be assessed, and how they spoke.
 *
 * Every figure here is one the report already carries — competency scores, the counted
 * assistance, the measured speech timings. Nothing is estimated in the browser, and a chart
 * whose figures are absent is left out rather than drawn at zero: an empty gauge would be a
 * claim about the candidate, not about the report.
 *
 * Hover or focus on a point to read its exact value; the same values are written out in the
 * sections below, so nothing here is reachable only through the pointer.
 */
export function ReportVisuals({ report }: { report: SessionReport }) {
  const scored = (report.competencies ?? []).filter((item) => item.maxScore > 0);
  const assistance = report.assistance;
  const assessable = report.assessableTurns ?? report.answeredTurns;
  const spoken = report.spokenEnglish ?? null;
  const pace = spoken?.languageAssessed && spoken.wordsPerMinute !== null ? spoken.wordsPerMinute : null;
  const timedAnswers = (spoken?.answers ?? []).filter((answer) => answer.words > 0);

  const tiles = [
    assistance && assistance.totalAnswers > 0 ? (
      <RingMeter
        key="unaided"
        title="Answered without help"
        value={assistance.unaidedAnswers}
        total={assistance.totalAnswers}
        caption={`${assistance.unaidedAnswers} of ${assistance.totalAnswers} answers needed no nudge from the interviewer`}
      />
    ) : null,
    report.answeredTurns > 0 ? (
      <RingMeter
        key="assessable"
        title="Answers deep enough to score"
        value={Math.min(assessable, report.answeredTurns)}
        total={report.answeredTurns}
        caption={`${assessable} of ${report.answeredTurns} answers gave the marker enough to judge a competency`}
      />
    ) : null,
    pace !== null ? <PaceGauge key="pace" wordsPerMinute={pace} /> : null,
  ].filter(Boolean);

  if (scored.length < 3 && tiles.length === 0) return null;

  return (
    <section aria-labelledby="report-visuals" className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
      <div>
        <p className="eyebrow text-accent">At a glance</p>
        <h2 id="report-visuals" className="mt-2 text-title text-ink">
          Your interview, in pictures
        </h2>
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        {scored.length >= 3 ? <SkillRadar competencies={scored} /> : null}
        {tiles.length > 0 ? (
          <div className={`grid gap-4 sm:grid-cols-2 ${scored.length >= 3 ? "lg:grid-cols-1" : "lg:col-span-2 lg:grid-cols-3"}`}>
            {tiles}
          </div>
        ) : null}
      </div>

      {spoken && timedAnswers.length >= 2 ? <WordsPerAnswer answers={timedAnswers} /> : null}
    </section>
  );
}

const CARD = "relative flex flex-col gap-3 rounded-xl border border-line bg-surface p-5";
const CARD_TITLE = "font-mono text-micro tracking-widest text-ink-subtle uppercase";

/** Breaks a competency name into short lines for a radar label, never cutting a word. */
function labelLines(name: string, width = 20): string[] {
  const lines: string[] = [];
  let current = "";
  for (const word of name.split(/\s+/)) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > width && current) {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/**
 * Every competency as one spoke, so the candidate sees the shape of the round — which way
 * it leans — rather than a list. The ring at the ordinary mark is the reference: a point
 * on it did what the question asked, and a point outside it went further.
 */
export function SkillRadar({ competencies }: { competencies: ReportCompetency[] }) {
  const [active, setActive] = useState<number | null>(null);
  const size = 400;
  const centre = size / 2;
  const radius = 118;
  const count = competencies.length;

  const point = (index: number, fraction: number) => {
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return { x: centre + Math.cos(angle) * radius * fraction, y: centre + Math.sin(angle) * radius * fraction };
  };
  const ring = (fraction: number) =>
    competencies.map((_, index) => {
      const { x, y } = point(index, fraction);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(" ");

  const values = competencies.map((item) => Math.min(1, Math.max(0, item.score / item.maxScore)));
  const shape = values.map((value, index) => {
    const { x, y } = point(index, value);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const focused = active === null ? null : competencies[active];
  const focusedPoint = active === null ? null : point(active, values[active] ?? 0);

  return (
    <figure className={CARD}>
      <figcaption className="flex flex-col gap-1">
        <span className={CARD_TITLE}>Skill shape</span>
        <span className="text-caption text-ink-muted">
          Each spoke is one competency, scored against its own maximum. The darker ring is an ordinary answer.
        </span>
      </figcaption>

      <div className="relative mx-auto w-full max-w-md">
        <svg
          viewBox={`0 0 ${size} ${size}`}
          className="h-auto w-full overflow-visible"
          role="img"
          aria-label={`Skill shape: ${competencies.map((item) => `${item.competency} ${item.score} of ${item.maxScore}`).join(", ")}`}
        >
          {[0.2, 0.6, 0.8, 1].map((fraction) => (
            <polygon key={fraction} points={ring(fraction)} className="fill-none stroke-line" strokeWidth={1} />
          ))}
          <polygon points={ring(ORDINARY_MARK / 100)} className="fill-none stroke-ink-subtle" strokeWidth={1.5} />
          {competencies.map((item, index) => {
            const end = point(index, 1);
            return <line key={item.competency} x1={centre} y1={centre} x2={end.x} y2={end.y} className="stroke-line" strokeWidth={1} />;
          })}

          <polygon points={shape} className="fill-chart-1/15 stroke-chart-1" strokeWidth={2} strokeLinejoin="round" />

          {competencies.map((item, index) => {
            const label = point(index, 1.2);
            const anchor = Math.abs(label.x - centre) < 8 ? "middle" : label.x > centre ? "start" : "end";
            const lines = labelLines(item.competency);
            const shift = label.y < centre - 8 ? -(lines.length - 1) * 13 : label.y > centre + 8 ? 4 : -((lines.length - 1) * 13) / 2;
            const badge = point(index, 1.16);
            return (
              <g key={item.competency}>
                {/* Below `sm` the names would shrink past reading, so the spoke carries a number keyed to the list underneath. */}
                <text
                  x={label.x}
                  y={label.y + shift}
                  textAnchor={anchor}
                  className={`hidden text-micro sm:inline ${active === index ? "fill-ink font-semibold" : "fill-ink-muted"}`}
                >
                  {lines.map((line, lineIndex) => (
                    <tspan key={line} x={label.x} dy={lineIndex === 0 ? 0 : 13}>
                      {line}
                    </tspan>
                  ))}
                </text>
                <text
                  x={badge.x}
                  y={badge.y}
                  textAnchor="middle"
                  dominantBaseline="central"
                  className={`text-heading font-semibold sm:hidden ${active === index ? "fill-ink" : "fill-ink-muted"}`}
                >
                  {index + 1}
                </text>
              </g>
            );
          })}

          {competencies.map((item, index) => {
            const { x, y } = point(index, values[index] ?? 0);
            return (
              <g
                key={item.competency}
                tabIndex={0}
                role="button"
                aria-label={`${item.competency}: ${item.score} out of ${item.maxScore}`}
                onPointerEnter={() => setActive(index)}
                onPointerLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
                className="cursor-pointer outline-none"
              >
                <circle cx={x} cy={y} r={14} className="fill-transparent" />
                <circle
                  cx={x}
                  cy={y}
                  r={active === index ? 6.5 : 5}
                  className="fill-chart-1 stroke-surface"
                  strokeWidth={2}
                />
              </g>
            );
          })}
        </svg>

        {focused && focusedPoint ? (
          <div
            role="status"
            className="pointer-events-none absolute z-10 w-max max-w-52 -translate-x-1/2 -translate-y-[calc(100%+12px)] rounded-lg border border-line bg-surface-raised px-3 py-2 text-caption shadow-[var(--shadow-md)]"
            style={{ left: `${(focusedPoint.x / size) * 100}%`, top: `${(focusedPoint.y / size) * 100}%` }}
          >
            <p className="font-semibold text-ink">{focused.competency}</p>
            <p className="tabular-nums text-ink-muted">
              {focused.score} / {focused.maxScore} · {Math.round((focused.score / focused.maxScore) * 100)}%
            </p>
          </div>
        ) : null}
      </div>

      <ol className="grid gap-1.5 sm:hidden">
        {competencies.map((item, index) => (
          <li key={item.competency} className="flex items-baseline gap-2 text-caption">
            <span className="w-4 shrink-0 font-semibold text-ink-muted">{index + 1}</span>
            <span className="min-w-0 flex-1 text-ink">{item.competency}</span>
            <span className="shrink-0 font-mono tabular-nums text-ink-muted">
              {item.score}/{item.maxScore}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}

/**
 * A part of a whole, as a ring with the count in the middle. One value against its total,
 * so it is a meter rather than a pie: the unfilled track is "the rest", not a second series.
 */
export function RingMeter({ title, value, total, caption }: { title: string; value: number; total: number; caption: string }) {
  const percent = total > 0 ? Math.min(100, Math.max(0, (value / total) * 100)) : 0;
  const radius = 34;
  const circumference = 2 * Math.PI * radius;

  return (
    <figure className={`${CARD} flex-row items-center gap-4`}>
      <div
        role="meter"
        aria-label={title}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={value}
        aria-valuetext={caption}
        className="relative size-24 shrink-0"
      >
        <svg viewBox="0 0 88 88" className="size-full -rotate-90" aria-hidden="true">
          <circle cx={44} cy={44} r={radius} className="fill-none stroke-surface-sunken" strokeWidth={9} />
          <circle
            cx={44}
            cy={44}
            r={radius}
            className="fill-none stroke-chart-1 transition-[stroke-dashoffset] duration-700"
            strokeWidth={9}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={circumference * (1 - percent / 100)}
          />
        </svg>
        <span className="absolute inset-0 grid place-items-center text-center">
          <span>
            <strong className="block text-heading leading-none tabular-nums text-ink">{value}</strong>
            <span className="text-micro tabular-nums text-ink-subtle">of {total}</span>
          </span>
        </span>
      </div>
      <figcaption className="flex flex-col gap-1">
        <span className={CARD_TITLE}>{title}</span>
        <span className="text-caption text-ink-muted">{caption}</span>
      </figcaption>
    </figure>
  );
}

/**
 * The conversational range the server measures pace against. A copy of
 * `SpokenEnglish.PACE_RANGE_LOW/HIGH` in the API; the two move together, or the gauge
 * shades a range the report's own words do not use.
 */
export const PACE_RANGE = { low: 120, high: 160 } as const;
const PACE_SCALE = { min: 60, max: 220 } as const;

/**
 * Speaking pace on a dial, with the conversational range shaded. The range is a rough
 * guide rather than a target, so it is drawn as a reference band in the series hue, not
 * in a pass/fail colour.
 */
export function PaceGauge({ wordsPerMinute }: { wordsPerMinute: number }) {
  const span = PACE_SCALE.max - PACE_SCALE.min;
  const fraction = (value: number) => Math.min(1, Math.max(0, (value - PACE_SCALE.min) / span));
  const at = (value: number, r: number) => {
    const angle = Math.PI * (1 - fraction(value));
    return { x: 60 + Math.cos(angle) * r, y: 60 - Math.sin(angle) * r };
  };
  const arc = (from: number, to: number, r: number) => {
    const start = at(from, r);
    const end = at(to, r);
    return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
  };
  const needle = at(wordsPerMinute, 40);
  const where =
    wordsPerMinute < PACE_RANGE.low ? "below" : wordsPerMinute > PACE_RANGE.high ? "above" : "within";

  return (
    <figure className={`${CARD} flex-row items-center gap-4`}>
      <div
        role="meter"
        aria-label="Speaking pace"
        aria-valuemin={PACE_SCALE.min}
        aria-valuemax={PACE_SCALE.max}
        aria-valuenow={wordsPerMinute}
        aria-valuetext={`${wordsPerMinute} words per minute, ${where} the conversational range of ${PACE_RANGE.low} to ${PACE_RANGE.high}`}
        className="w-28 shrink-0"
      >
        <svg viewBox="0 0 120 68" className="h-auto w-full" aria-hidden="true">
          <path d={arc(PACE_SCALE.min, PACE_SCALE.max, 48)} className="fill-none stroke-surface-sunken" strokeWidth={10} />
          <path d={arc(PACE_RANGE.low, PACE_RANGE.high, 48)} className="fill-none stroke-chart-1/35" strokeWidth={10} />
          <line x1={60} y1={60} x2={needle.x} y2={needle.y} className="stroke-ink" strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={60} cy={60} r={4} className="fill-ink" />
        </svg>
        <p className="-mt-1 text-center">
          <strong className="text-heading tabular-nums text-ink">{wordsPerMinute}</strong>
          <span className="pl-1 text-micro text-ink-subtle">wpm</span>
        </p>
      </div>
      <figcaption className="flex flex-col gap-1">
        <span className={CARD_TITLE}>Speaking pace</span>
        <span className="text-caption text-ink-muted">
          {where === "within" ? "Within" : where === "below" ? "Below" : "Above"} the shaded conversational range of{" "}
          {PACE_RANGE.low}–{PACE_RANGE.high} words a minute.
        </span>
      </figcaption>
    </figure>
  );
}

/**
 * How long each answer ran, as one bar per question, so a candidate can see at once which
 * answers they cut short and which ran on. One series, one hue; the exact figures are in
 * the answer-by-answer table of the speaking section.
 */
export function WordsPerAnswer({ answers }: { answers: ReportSpokenEnglish["answers"] }) {
  const [active, setActive] = useState<number | null>(null);
  const most = Math.max(...answers.map((answer) => answer.words), 1);
  const height = 120;

  return (
    <figure className={CARD}>
      <figcaption className="flex flex-col gap-1">
        <span className={CARD_TITLE}>Length of each answer</span>
        <span className="text-caption text-ink-muted">Words spoken per question. Hover a bar for its pace.</span>
      </figcaption>
      <div className="flex items-end gap-2" style={{ height }} role="list" aria-label="Words per answer">
        {answers.map((answer, index) => {
          const share = answer.words / most;
          const shown = active === index;
          return (
            <div
              key={answer.turnIndex}
              role="listitem"
              tabIndex={0}
              aria-label={`Question ${answer.turnIndex + 1}: ${answer.words} words${answer.wordsPerMinute !== null ? `, ${answer.wordsPerMinute} words per minute` : ""}`}
              onPointerEnter={() => setActive(index)}
              onPointerLeave={() => setActive(null)}
              onFocus={() => setActive(index)}
              onBlur={() => setActive(null)}
              className="relative flex h-full min-w-0 flex-1 cursor-default flex-col justify-end rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              {shown ? (
                <div
                  role="status"
                  className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-2 w-max -translate-x-1/2 rounded-lg border border-line bg-surface-raised px-3 py-2 text-caption shadow-[var(--shadow-md)]"
                >
                  <p className="font-semibold text-ink">Question {answer.turnIndex + 1}</p>
                  <p className="tabular-nums text-ink-muted">
                    {answer.words} words
                    {answer.wordsPerMinute !== null ? ` · ${answer.wordsPerMinute} wpm` : ""}
                  </p>
                </div>
              ) : null}
              <div
                className={`mx-auto w-full max-w-10 rounded-t-[4px] transition-colors ${shown ? "bg-chart-1" : "bg-chart-1/75"}`}
                style={{ height: `${Math.max(2, share * 100)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div aria-hidden="true" className="flex gap-2 border-t border-line pt-1.5">
        {answers.map((answer) => (
          <span key={answer.turnIndex} className="min-w-0 flex-1 text-center font-mono text-micro text-ink-subtle">
            Q{answer.turnIndex + 1}
          </span>
        ))}
      </div>
    </figure>
  );
}
