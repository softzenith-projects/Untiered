import type { Route } from "next";
import Link from "next/link";
import type { ReactNode } from "react";

import type { BatchOverviewRow, DashboardPipeline, DashboardTrend, DashboardView } from "@untiered/shared";

import { campusHref } from "./campus-context";
import { COMPONENT_KEYS, COMPONENT_LABEL, TOPIC_LABEL } from "./readiness-model";

// The TPO overview (contract "Module 7b"). Every figure here comes from the server; a null
// is "not enough data" and is never drawn as 0. Colour is never the only channel: every bar,
// dot and chip also carries its number and its label.

// -- pure helpers, tested on their own ----------------------------------------------------

/** "+3" / "−2" / "No change" for counts; null when either period has no value. */
export function countChange(current: number | null | undefined, previous: number | null | undefined): string | null {
  if (current === null || current === undefined || previous === null || previous === undefined) return null;
  const delta = current - previous;
  if (delta === 0) return "No change";
  return delta > 0 ? `+${delta}` : `−${Math.abs(delta)}`;
}

/** "+4 pts" / "−3 pts" for scores; null when either period has no score. */
export function pointsChange(current: number | null | undefined, previous: number | null | undefined): string | null {
  const change = countChange(current, previous);
  if (change === null || change === "No change") return change;
  const size = Math.abs((current ?? 0) - (previous ?? 0));
  return `${change} ${size === 1 ? "pt" : "pts"}`;
}

export function percent(numerator: number, denominator: number): number {
  return Math.round((numerator / denominator) * 100);
}

export type ScoreTone = "positive" | "highlight" | "danger";

/** Green from 70, amber from 50, red below: the readiness bands' own lines. */
export function scoreTone(score: number): ScoreTone {
  if (score >= 70) return "positive";
  if (score >= 50) return "highlight";
  return "danger";
}

const TONE_FILL: Record<ScoreTone, string> = {
  positive: "var(--positive)",
  highlight: "var(--highlight)",
  danger: "var(--danger)",
};

const TONE_TEXT: Record<ScoreTone, string> = {
  positive: "text-positive",
  highlight: "text-warning",
  danger: "text-danger",
};

export type StageKey = keyof DashboardPipeline;

export const STAGES: { key: StageKey; label: string; fill: string }[] = [
  { key: "invited", label: "Invited", fill: "var(--neutral-400)" },
  { key: "joined", label: "Joined", fill: "var(--info)" },
  { key: "active", label: "Active", fill: "var(--accent-2)" },
  { key: "assigned", label: "Assigned", fill: "var(--highlight)" },
  { key: "attempted", label: "Attempted", fill: "var(--warning)" },
  { key: "completed", label: "Completed", fill: "var(--positive)" },
  { key: "interviewReady", label: "Interview-ready", fill: "var(--accent-strong)" },
];

const STAGE_LABEL = Object.fromEntries(STAGES.map((stage) => [stage.key, stage.label])) as Record<StageKey, string>;

const FLOW: [StageKey, StageKey][] = [
  ["invited", "joined"],
  ["joined", "active"],
  ["assigned", "attempted"],
  ["attempted", "completed"],
  ["completed", "interviewReady"],
];

export interface ConversionRow {
  from: StageKey;
  to: StageKey;
  label: string;
  numerator: number;
  denominator: number;
  percent: number;
}

/**
 * Stage-to-stage conversion. A row whose first stage is empty has nothing to convert and is
 * left out, as is one whose second stage is larger (students who joined without an invite):
 * that is not a conversion, and a figure over 100% would say something untrue.
 */
export function conversionRows(pipeline: DashboardPipeline): ConversionRow[] {
  return FLOW.flatMap(([from, to]) => {
    const denominator = pipeline[from];
    const numerator = pipeline[to];
    if (denominator <= 0 || numerator > denominator) return [];
    return [{ from, to, label: `${STAGE_LABEL[from]} → ${STAGE_LABEL[to]}`, numerator, denominator, percent: percent(numerator, denominator) }];
  });
}

export interface StackSegment {
  label: string;
  count: number;
  fill: string;
}

/**
 * Where the joined students have got to, as disjoint parts that add up to `joined`. The
 * server keeps completed within attempted within assigned, so the parts never overlap.
 */
export function joinedSegments(pipeline: DashboardPipeline): StackSegment[] {
  const { joined, assigned, attempted, completed } = pipeline;
  return [
    { label: "Not assigned yet", count: Math.max(0, joined - assigned), fill: "var(--neutral-400)" },
    { label: "Assigned, not attempted", count: Math.max(0, assigned - attempted), fill: "var(--highlight)" },
    { label: "Attempted, not completed", count: Math.max(0, attempted - completed), fill: "var(--warning)" },
    { label: "Completed an assignment", count: completed, fill: "var(--positive)" },
  ];
}

export function readinessHref(orgId: string, batchId: string): Route {
  return `/campus/readiness?org=${encodeURIComponent(orgId)}&batchId=${encodeURIComponent(batchId)}` as Route;
}

// -- KPI cards --------------------------------------------------------------------------------

function Icon({ children }: { children: ReactNode }) {
  return (
    <span aria-hidden="true" className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-wash text-accent-strong">
      <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </span>
  );
}

const ICONS = {
  people: (
    <>
      <circle cx="9" cy="8" r="3.5" />
      <path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" />
      <path d="M16 4.8a3.5 3.5 0 0 1 0 6.4M18.5 14.8c1.6.8 2.6 2.5 3 5.2" />
    </>
  ),
  pulse: <path d="M3 12h4l2.5-6 4 12 2.5-6H21" />,
  check: (
    <>
      <rect x="3.5" y="3.5" width="17" height="17" rx="4" />
      <path d="m8 12.5 2.8 2.8L16.5 9" />
    </>
  ),
  star: <path d="m12 3.5 2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.8l-5.2 2.8 1-5.8-4.3-4.1 5.9-.9z" />,
  gauge: (
    <>
      <path d="M4 17a8 8 0 1 1 16 0" />
      <path d="m12 17 4-5" />
    </>
  ),
};

/** Tiny bars, one per week. Decorative: the same figures are in the card's accessible text. */
function Sparkline({ weekly }: { weekly: DashboardTrend["weekly"] }) {
  const max = Math.max(1, ...weekly.map((week) => week.completed));
  const width = weekly.length * 8;
  return (
    <svg aria-hidden="true" viewBox={`0 0 ${width} 24`} className="h-6 w-16 shrink-0" preserveAspectRatio="none">
      {weekly.map((week, index) => {
        const height = week.completed === 0 ? 1.5 : Math.max(3, (week.completed / max) * 24);
        return <rect key={week.weekStart} x={index * 8 + 1} y={24 - height} width={6} height={height} rx={1.5} fill="var(--accent)" />;
      })}
    </svg>
  );
}

export function KpiCard({
  icon,
  label,
  value,
  detail,
  srDetail,
  change,
  changeLabel,
  sparkline,
}: {
  icon: keyof typeof ICONS;
  label: string;
  value: string | null;
  detail: string;
  srDetail?: string;
  change?: string | null;
  changeLabel?: string;
  sparkline?: DashboardTrend["weekly"];
}) {
  return (
    <li className="card flex flex-col gap-4 p-5">
      <div className="flex items-start justify-between gap-3">
        <Icon>{ICONS[icon]}</Icon>
        {change ? (
          <span className="pill pill-accent normal-case" title={changeLabel}>
            {change}
            {changeLabel ? <span className="sr-only"> {changeLabel}</span> : null}
          </span>
        ) : null}
      </div>
      <div className="flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-caption font-semibold text-ink">{label}</h3>
          {value === null ? (
            <p className="mt-1 text-body font-semibold text-ink-muted">Not enough data yet</p>
          ) : (
            <p className="mt-1 text-display text-ink">{value}</p>
          )}
          <p className="text-caption text-ink-muted">
            {detail}
            {srDetail ? <span className="sr-only">. {srDetail}</span> : null}
          </p>
        </div>
        {sparkline && sparkline.length > 0 ? <Sparkline weekly={sparkline} /> : null}
      </div>
    </li>
  );
}

export function KpiRow({ view }: { view: DashboardView }) {
  const pipeline = view.pipeline;
  const trend = view.trend;
  const weeklyText = trend ? trend.weekly.map((week) => week.completed).join(", ") : "";
  return (
    <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5" aria-label="Key figures">
      <KpiCard
        icon="people"
        label="Joined students"
        value={String(view.joined)}
        // Students can join without an invite, so invited can be below joined (contract Module 7b):
        // "61 of 5 invited" would be false, so the comparison is shown only when it reads true.
        detail={pipeline && pipeline.invited >= view.joined ? `of ${pipeline.invited} invited` : "students who have joined"}
      />
      <KpiCard
        icon="pulse"
        label="Active in 14 days"
        value={String(view.active)}
        detail={view.joined > 0 ? `${percent(view.active, view.joined)}% of joined students` : "No students have joined yet"}
      />
      {trend ? (
        <KpiCard
          icon="check"
          label="Assignments completed"
          value={String(trend.completedLast30)}
          detail="in the last 30 days"
          srDetail={weeklyText ? `Completions per week for the last 8 weeks, oldest first: ${weeklyText}` : undefined}
          change={countChange(trend.completedLast30, trend.completedPrev30)}
          changeLabel="compared with the previous 30 days"
          sparkline={trend.weekly}
        />
      ) : null}
      {trend ? (
        <KpiCard
          icon="gauge"
          label="Average score"
          value={trend.averageScoreLast30 === null ? null : String(trend.averageScoreLast30)}
          detail={
            trend.averageScoreLast30 === null
              ? "Needs 3 completed items in the last 30 days"
              : "out of 100, work completed in the last 30 days"
          }
          change={pointsChange(trend.averageScoreLast30, trend.averageScorePrev30)}
          changeLabel="compared with the previous 30 days"
        />
      ) : null}
      {pipeline ? (
        <KpiCard
          icon="star"
          label="Interview-ready or strong"
          value={String(pipeline.interviewReady)}
          detail={view.joined > 0 ? `${percent(pipeline.interviewReady, view.joined)}% of joined students` : "No students have joined yet"}
        />
      ) : null}
    </ul>
  );
}

// -- practice pipeline ------------------------------------------------------------------------

export function PipelineCard({ pipeline }: { pipeline: DashboardPipeline }) {
  const segments = joinedSegments(pipeline);
  const rows = conversionRows(pipeline);
  return (
    <section aria-labelledby="pipeline-heading" className="card flex flex-col gap-5 p-5">
      <div>
        <h3 id="pipeline-heading" className="text-heading text-ink">
          Practice pipeline
        </h3>
        <p className="text-caption text-ink-muted">How far the students in this view have got.</p>
      </div>

      {pipeline.joined > 0 ? (
        <figure className="flex flex-col gap-2">
          <figcaption className="text-caption font-semibold text-ink">Where the {pipeline.joined} joined students are</figcaption>
          <div className="flex h-3 overflow-hidden rounded-full bg-surface-sunken" aria-hidden="true">
            {segments
              .filter((segment) => segment.count > 0)
              .map((segment) => (
                <span key={segment.label} style={{ width: `${(segment.count / pipeline.joined) * 100}%`, background: segment.fill }} />
              ))}
          </div>
          <ul className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-ink-muted">
            {segments.map((segment) => (
              <li key={segment.label} className="flex items-center gap-1.5">
                <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: segment.fill }} />
                {segment.label}: <span className="font-semibold text-ink">{segment.count}</span>
              </li>
            ))}
          </ul>
        </figure>
      ) : null}

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {STAGES.map((stage) => (
          <div key={stage.key} className="rounded-lg border border-line p-3">
            <dt className="flex items-center gap-1.5 text-caption text-ink-muted">
              <span aria-hidden="true" className="size-2.5 rounded-full" style={{ background: stage.fill }} />
              {stage.label}
            </dt>
            <dd className="mt-1 text-heading font-bold text-ink">{pipeline[stage.key]}</dd>
          </div>
        ))}
      </dl>

      <div className="flex flex-col gap-3">
        <h4 className="text-caption font-semibold text-ink">Conversion flow</h4>
        {rows.length === 0 ? (
          <p className="text-caption text-ink-muted">Nothing to compare yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {rows.map((row) => (
              <li key={row.label} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-caption">
                <span className="text-ink">{row.label}</span>
                <span className="text-right font-semibold text-ink">
                  {row.percent}%<span className="font-normal text-ink-muted"> ({row.numerator} of {row.denominator})</span>
                </span>
                <span className="col-span-2 h-1.5 rounded-full bg-surface-sunken" aria-hidden="true">
                  <span className="block h-1.5 rounded-full bg-accent" style={{ width: `${row.percent}%` }} />
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

// -- readiness by skill ---------------------------------------------------------------------------

export function SkillReadinessCard({ view }: { view: DashboardView }) {
  const averages = view.componentAverages;
  const gaps = view.topGaps ?? [];
  const ready = view.pipeline?.interviewReady ?? 0;
  return (
    <section aria-labelledby="skill-heading" className="card flex flex-col gap-5 p-5">
      <div>
        <h3 id="skill-heading" className="text-heading text-ink">
          Readiness by skill
        </h3>
        <p className="text-caption text-ink-muted">Averages of the students&rsquo; component scores, out of 100.</p>
      </div>

      <div>
        {view.joined > 0 && view.pipeline ? (
          <>
            <p className="text-display text-ink">{percent(ready, view.joined)}%</p>
            <p className="text-caption text-ink-muted">
              of joined students are interview-ready ({ready} of {view.joined}, band Strong or Interview ready)
            </p>
          </>
        ) : (
          <>
            <p className="text-body font-semibold text-ink-muted">Not enough data yet</p>
            <p className="text-caption text-ink-muted">No students have joined in this view.</p>
          </>
        )}
      </div>

      {averages ? (
        <ul className="flex flex-col gap-3">
          {COMPONENT_KEYS.map((key) => {
            const entry = averages[key];
            if (!entry) return null;
            const tone = entry.average === null ? null : scoreTone(entry.average);
            return (
              <li key={key} className="flex flex-col gap-1 text-caption">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-ink">{COMPONENT_LABEL[key]}</span>
                  {entry.average === null || tone === null ? (
                    <span className="text-ink-subtle">Not enough data</span>
                  ) : (
                    <span className={`font-semibold ${TONE_TEXT[tone]}`}>
                      {entry.average}
                      <span className="font-normal text-ink-muted"> · {entry.students} students</span>
                    </span>
                  )}
                </div>
                {entry.average !== null && tone !== null ? (
                  <span className="h-2 rounded-full bg-surface-sunken" aria-hidden="true">
                    <span className="block h-2 rounded-full" style={{ width: `${Math.max(2, entry.average)}%`, background: TONE_FILL[tone] }} />
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}

      {gaps.length > 0 ? (
        <div className="rounded-xl border border-highlight/40 bg-warning-wash p-4">
          <h4 className="text-caption font-semibold text-ink">Weakest topics</h4>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Weakest topics">
            {gaps.map((gap) => (
              <li key={gap.topic} className="pill pill-highlight normal-case">
                {TOPIC_LABEL[gap.topic]} · {gap.average}
                <span className="sr-only"> average across {gap.students} students</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

// -- batches ---------------------------------------------------------------------------------------

export function BatchesCard({ batches, orgId }: { batches: BatchOverviewRow[]; orgId: string }) {
  return (
    <section aria-labelledby="batches-heading" className="card flex flex-col gap-4 p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h3 id="batches-heading" className="text-heading text-ink">
            Batches
          </h3>
          <p className="text-caption text-ink-muted">Open a batch to see every student in it.</p>
        </div>
        <Link href={campusHref("/campus/readiness", orgId)} className="text-caption font-semibold text-accent underline">
          All students
        </Link>
      </div>
      {batches.length === 0 ? (
        <p className="text-caption text-ink-muted">No batches in this view yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-line">
          <table className="w-full border-collapse text-left text-caption">
            <caption className="sr-only">Batches with joined students, completion, average overall score and interview-ready students</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="p-3 font-semibold">Batch</th>
                <th scope="col" className="p-3 text-right font-semibold">Joined</th>
                <th scope="col" className="p-3 text-right font-semibold">Completion</th>
                <th scope="col" className="p-3 text-right font-semibold">Average overall</th>
                <th scope="col" className="p-3 text-right font-semibold">Interview-ready</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.batchId} className="border-t border-line">
                  <th scope="row" className="p-3 font-semibold">
                    <Link href={readinessHref(orgId, batch.batchId)} className="text-accent underline">
                      {batch.name}
                    </Link>
                    <span className="block font-normal text-ink-muted">{batch.departmentCode}</span>
                  </th>
                  <td className="p-3 text-right text-ink">{batch.joined}</td>
                  <td className="p-3 text-right text-ink">
                    {batch.completionRate === null ? (
                      <span className="text-ink-subtle">Nothing due yet</span>
                    ) : (
                      `${Math.round(batch.completionRate * 100)}%`
                    )}
                  </td>
                  <td className="p-3 text-right text-ink">
                    {batch.averageOverall === null ? <span className="text-ink-subtle">Not enough data</span> : batch.averageOverall}
                  </td>
                  <td className="p-3 text-right text-ink">{batch.interviewReady}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
