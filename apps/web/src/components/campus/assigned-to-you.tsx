"use client";

import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { ProgressBar } from "@/components/ui/progress";
import { fetchMyAssignments, fetchMyProgrammes } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { AssignedItem, MyProgrammeView } from "@untiered/shared";

import { BLOCKED_REASON_TEXT, formatDue, relativeTime, ROUND_LABEL, STATUS_LABEL, STATUS_TONE } from "./assignment-model";

/**
 * "Assigned to you": what a student's college has set. Renders nothing at all unless the
 * student has at least one assignment, and a failed read is silent, because the dashboard
 * must stay exactly as it was for everyone this does not concern. The caller mounts it
 * only when the campus switch is on.
 */
export function AssignedToYou() {
  const accessToken = useAccessToken();
  const [items, setItems] = useState<AssignedItem[]>([]);
  const [programmes, setProgrammes] = useState<MyProgrammeView[]>([]);

  useEffect(() => {
    if (!accessToken) return;
    const controller = new AbortController();
    fetchMyAssignments({ accessToken, signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted) setItems(list);
      })
      .catch(() => {});
    // Independent of the assignments: a failure here leaves the rest of the section as it was.
    fetchMyProgrammes({ accessToken, signal: controller.signal })
      .then((list) => {
        if (!controller.signal.aborted) setProgrammes(list);
      })
      .catch(() => {});
    return () => controller.abort();
  }, [accessToken]);

  if (items.length === 0 && programmes.length === 0) return null;

  return (
    <section aria-labelledby="assigned-to-you" className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="assigned-to-you" className="text-heading text-ink">
          Assigned to you
        </h2>
        <Link href="/campus/me" className="text-caption font-semibold text-accent underline">
          See your readiness
        </Link>
      </div>
      {programmes.length > 0 ? <ProgrammesBlock programmes={programmes} /> : null}
      {items.length > 0 ? (
        <ul className="grid gap-4 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <AssignedCard item={item} />
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/** The student's programmes: how far through each they are, and the certificate once earned. */
export function ProgrammesBlock({ programmes }: { programmes: MyProgrammeView[] }) {
  return (
    <div className="flex flex-col gap-3">
      <h3 className="text-body font-semibold text-ink">Programmes</h3>
      <ul className="grid gap-4 md:grid-cols-2">
        {programmes.map((programme) => (
          <li key={programme.id}>
            <article className="card flex h-full flex-col gap-3 p-5">
              <div className="flex items-start justify-between gap-3">
                <h4 className="text-body font-semibold text-ink">{programme.title}</h4>
                {programme.certificateId ? <Badge tone="positive">Completed</Badge> : null}
              </div>
              <p className="text-caption text-ink-muted">
                {programme.completedModules} of {programme.totalModules} modules completed · {programme.weeks}{" "}
                {programme.weeks === 1 ? "week" : "weeks"}, one module unlocking each week
              </p>
              <ProgressBar
                value={programme.completedModules}
                max={programme.totalModules}
                label={`${programme.title}: ${programme.completedModules} of ${programme.totalModules} modules completed`}
              />
              {programme.certificateId ? (
                <Link
                  href={`/campus/me/certificates/${encodeURIComponent(programme.id)}` as Route}
                  className="action-secondary self-start"
                >
                  View certificate<span className="sr-only"> for {programme.title}</span>
                </Link>
              ) : null}
            </article>
          </li>
        ))}
      </ul>
    </div>
  );
}

function AssignedCard({ item }: { item: AssignedItem }) {
  const interview = item.kind === "interview";
  const what = interview
    ? `${item.roundType ? ROUND_LABEL[item.roundType] : "Interview"}${item.durationMinutes ? `, ${item.durationMinutes} minutes` : ""}`
    : `${item.scenarios.length} Arena ${item.scenarios.length === 1 ? "scenario" : "scenarios"}`;
  return (
    <article className="card flex h-full flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-body font-semibold text-ink">{item.title}</h3>
          <p className="text-caption text-ink-muted">
            {item.orgName} · {what}
          </p>
        </div>
        <Badge tone={STATUS_TONE[item.status]}>{STATUS_LABEL[item.status]}</Badge>
      </div>
      {item.instructions ? <p className="text-caption text-ink-muted">{item.instructions}</p> : null}
      <p className="text-caption text-ink-muted">
        Due {formatDue(item.dueAt)} ({relativeTime(item.dueAt)})
        {interview ? ` · ${item.attemptsUsed} of ${item.attemptLimit} attempts used` : null}
      </p>
      {interview ? (
        item.canStart ? (
          <Link href={`/interview/new?assignment=${encodeURIComponent(item.id)}` as Route} className="action-primary self-start">
            Start <span className="sr-only">{item.title}</span>
            <span aria-hidden> →</span>
          </Link>
        ) : (
          <p className="text-caption font-medium text-ink">
            {(item.blockedReason && BLOCKED_REASON_TEXT[item.blockedReason]) || "This interview cannot be started right now."}
          </p>
        )
      ) : (
        <ul className="flex flex-col gap-1">
          {item.scenarios.map((scenario) => (
            <li key={scenario.id} className="flex items-center justify-between gap-3 text-caption">
              <span className="text-ink">{scenario.title}</span>
              {scenario.completed ? (
                <span className="text-ink-muted">Done</span>
              ) : (
                <Link href={`/arena/${encodeURIComponent(scenario.courseSlug)}` as Route} className="font-semibold text-accent underline">
                  Open in the Arena<span className="sr-only">: {scenario.title}</span>
                </Link>
              )}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
}
