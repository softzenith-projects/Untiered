"use client";

import type { Route } from "next";
import Link from "next/link";
import type { EvidenceItem, StudentReadiness } from "@untiered/shared";

import { Badge } from "@/components/ui/badge";

import {
  BAND_LABEL,
  BAND_TONE,
  COMPONENT_KEYS,
  COMPONENT_LABEL,
  NO_COURSE_TEXT,
  componentLabel,
  formatDate,
  practiceLinks,
  topicLabel,
} from "./readiness-model";

export function BandPill({ band }: { band: StudentReadiness["band"] }) {
  return <Badge tone={BAND_TONE[band]}>{BAND_LABEL[band]}</Badge>;
}

/**
 * One student's readiness: the same on the staff drill-down and on the student's own page.
 * `reportHref` returns where an interview item's report opens, or null for no link.
 */
export function StudentReadinessView({
  readiness,
  reportHref,
}: {
  readiness: StudentReadiness;
  reportHref?: (item: EvidenceItem) => Route | null;
}) {
  const { components, weights } = readiness;
  return (
    <div className="flex flex-col gap-8">
      <section aria-labelledby="readiness-overall" className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 id="readiness-overall" className="text-heading text-ink">
            {readiness.name ?? "Student"}
          </h2>
          <p className="text-caption text-ink-muted">
            {[readiness.rollNumber, readiness.departmentCode, readiness.batchName].filter(Boolean).join(" · ")}
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-caption text-ink-muted">Overall readiness</p>
            <p className="text-display text-ink">{readiness.overall === null ? "Not attempted" : `${Math.round(readiness.overall)} / 100`}</p>
          </div>
          <BandPill band={readiness.band} />
        </div>
      </section>

      <section aria-labelledby="readiness-components" className="flex flex-col gap-3">
        <h2 id="readiness-components" className="text-heading text-ink">
          Components
        </h2>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COMPONENT_KEYS.map((key) => {
            const score = components[key];
            return (
              <li key={key} className="card p-4">
                <p className="text-caption text-ink-muted">
                  {COMPONENT_LABEL[key]} · weight {weights[key]}%
                </p>
                <p className="text-heading text-ink">{score === null ? "Not attempted" : Math.round(score)}</p>
                {score !== null ? (
                  <div className="mt-2 h-2 rounded-full bg-surface-sunken" aria-hidden>
                    <div className="h-2 rounded-full bg-accent" style={{ width: `${Math.max(0, Math.min(100, score))}%` }} />
                  </div>
                ) : null}
              </li>
            );
          })}
        </ul>
        {readiness.band === "not_enough_evidence" ? (
          <p className="text-caption text-ink-muted">A band is given once at least two pieces of assigned work are completed.</p>
        ) : null}
      </section>

      <section aria-labelledby="readiness-history" className="flex flex-col gap-3">
        <h2 id="readiness-history" className="text-heading text-ink">
          Score history
        </h2>
        {readiness.evidence.length === 0 ? (
          <p className="text-caption text-ink-muted">No completed assignments yet, so there is no score to show.</p>
        ) : (
          <>
            <ScoreSparkline evidence={readiness.evidence} />
            <ul className="flex flex-col gap-2">
              {readiness.evidence.map((item) => {
                const href = item.kind === "interview" && item.sessionId && reportHref ? reportHref(item) : null;
                return (
                  <li key={`${item.assignmentId}-${item.completedAt}`} className="card flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <p className="text-body font-semibold text-ink">{item.assignmentTitle}</p>
                      <p className="text-caption text-ink-muted">
                        {componentLabel(item.component)} · {topicLabel(item.topic)} · {formatDate(item.completedAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <span className="text-heading text-ink">{item.score}</span>
                      {href ? (
                        <Link href={href} className="text-caption font-semibold text-accent underline">
                          View report<span className="sr-only">: {item.assignmentTitle}</span>
                        </Link>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      <section aria-labelledby="readiness-suggested" className="flex flex-col gap-3">
        <h2 id="readiness-suggested" className="text-heading text-ink">
          Suggested topics
        </h2>
        {readiness.suggestedTopics.length === 0 ? (
          <p className="text-caption text-ink-muted">Nothing is scoring below 70 right now.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {readiness.suggestedTopics.map((suggestion) => {
              const links = practiceLinks(suggestion.component, suggestion.topic);
              return (
                <li key={`${suggestion.component}-${suggestion.topic ?? "all"}`} className="card flex flex-col gap-1 p-4">
                  <p className="text-body font-semibold text-ink">
                    {suggestion.topic ? topicLabel(suggestion.topic) : componentLabel(suggestion.component)}
                  </p>
                  <p className="text-caption text-ink-muted">{suggestion.reason}</p>
                  {links.length > 0 ? (
                    <p className="flex flex-wrap gap-x-4 text-caption">
                      {links.map((link) => (
                        <Link key={link.href} href={link.href as Route} className="font-semibold text-accent underline">
                          {link.label}
                        </Link>
                      ))}
                    </p>
                  ) : (
                    <p className="text-caption text-ink-subtle">{NO_COURSE_TEXT}</p>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}

const W = 320;
const H = 90;
const PAD = 12;

/** Evidence scores over time, oldest to newest, with every point also in a hidden table. */
export function ScoreSparkline({ evidence }: { evidence: EvidenceItem[] }) {
  const ordered = [...evidence].sort((a, b) => a.completedAt.localeCompare(b.completedAt));
  const x = (index: number) => (ordered.length === 1 ? W / 2 : PAD + (index * (W - 2 * PAD)) / (ordered.length - 1));
  const y = (score: number) => H - PAD - (Math.max(0, Math.min(100, score)) / 100) * (H - 2 * PAD);
  const points = ordered.map((item, index) => `${x(index)},${y(item.score)}`).join(" ");
  return (
    <figure className="card p-4">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        role="img"
        aria-label={`Evidence scores over time, ${ordered.length} points, from ${ordered[0]?.score ?? 0} to ${ordered[ordered.length - 1]?.score ?? 0}`}
        className="h-24 w-full"
      >
        <line x1={PAD} x2={W - PAD} y1={y(70)} y2={y(70)} stroke="var(--line-strong)" strokeDasharray="4 4" />
        {ordered.length > 1 ? <polyline points={points} fill="none" stroke="var(--accent)" strokeWidth="2" /> : null}
        {ordered.map((item, index) => (
          <circle key={`${item.assignmentId}-${index}`} cx={x(index)} cy={y(item.score)} r="3.5" fill="var(--accent)" stroke="var(--surface-raised)" strokeWidth="1.5" />
        ))}
      </svg>
      <figcaption className="text-caption text-ink-muted">Oldest to newest. The dashed line marks 70.</figcaption>
      <table className="sr-only">
        <caption>Evidence scores over time</caption>
        <thead>
          <tr>
            <th scope="col">Date</th>
            <th scope="col">Assignment</th>
            <th scope="col">Score</th>
          </tr>
        </thead>
        <tbody>
          {ordered.map((item, index) => (
            <tr key={`${item.assignmentId}-${index}`}>
              <td>{formatDate(item.completedAt)}</td>
              <td>{item.assignmentTitle}</td>
              <td>{item.score}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
