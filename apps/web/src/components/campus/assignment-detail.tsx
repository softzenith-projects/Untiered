"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Checkbox, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import {
  archiveAssignment,
  fetchAssignment,
  fetchAssignmentProgress,
  fetchBatches,
  publishAssignment,
  updateAssignment,
} from "@/lib/api";
import type { AssignmentView, CompletionStatus, RecipientProgress } from "@untiered/shared";

import { ASSIGNMENT_STATUS_LABEL, assignmentSummary } from "./assignments-panel";
import { StatTile, StatTiles } from "./stat-tile";
import { AssignmentFormView } from "./assignment-form";
import {
  COMPONENT_LABEL,
  formatDue,
  fromLocalInput,
  relativeTime,
  STATUS_LABEL,
  STATUS_TONE,
  toInput,
  toLocalInput,
} from "./assignment-model";
import { campusHref, useCampusOrg } from "./campus-context";
import { NotFoundState } from "./admin-colleges";
import { errorText, useLoad } from "./use-load";

type SortKey = "name" | "status" | "lastActivity";

const STATUS_ORDER: Record<CompletionStatus, number> = { overdue: 0, not_started: 1, in_progress: 2, completed: 3 };

export function sortProgress(rows: RecipientProgress[], key: SortKey, direction: "asc" | "desc"): RecipientProgress[] {
  const sign = direction === "asc" ? 1 : -1;
  const compare = (a: RecipientProgress, b: RecipientProgress) => {
    if (key === "name") return (a.name ?? a.email).localeCompare(b.name ?? b.email);
    if (key === "status") return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    // Never-active students sort as the oldest.
    return (a.lastActivityAt ? Date.parse(a.lastActivityAt) : 0) - (b.lastActivityAt ? Date.parse(b.lastActivityAt) : 0);
  };
  return [...rows].sort((a, b) => sign * compare(a, b));
}

export function AssignmentDetail({ id }: { id: string }) {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback((signal: AbortSignal) => fetchAssignment(orgId, id, { accessToken, signal }), [orgId, id, accessToken]);
  const { data, error, loading, setData, reload } = useLoad(load);
  const [editing, setEditing] = useState(false);
  const [confirm, setConfirm] = useState<"publish" | "archive" | null>(null);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);

  if (error) return error.status === 404 ? <NotFoundState /> : <Alert tone="error">{error.message}</Alert>;
  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  async function transition(kind: "publish" | "archive") {
    setConfirm(null);
    setMessage(null);
    try {
      const updated = await (kind === "publish" ? publishAssignment : archiveAssignment)(accessToken, orgId, id);
      setData(updated);
      setMessage({ tone: "success", text: kind === "publish" ? "Published. Students can see it now." : "Archived." });
    } catch (cause) {
      setMessage({ tone: "error", text: errorText(cause) });
      reload();
    }
  }

  const view = data;
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href={campusHref("/campus/assignments", orgId)} className="text-caption font-semibold text-accent underline">
          All assignments
        </Link>
        <div className="flex flex-wrap gap-2">
          {view.status !== "archived" && !editing ? (
            <Button variant="secondary" size="sm" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {view.status === "draft" ? (
            <Button size="sm" onClick={() => setConfirm("publish")}>
              Publish
            </Button>
          ) : null}
          {view.status !== "archived" ? (
            <Button variant="destructive" size="sm" onClick={() => setConfirm("archive")}>
              Archive
            </Button>
          ) : null}
        </div>
      </div>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {confirm ? (
        <Alert tone="warning" aria-label={`Confirm ${confirm}`}>
          <p className="font-semibold">
            {confirm === "publish"
              ? `Publish "${view.title}"? Students in the chosen batches and the chosen students will see it, and most details can no longer be changed.`
              : `Archive "${view.title}"? It disappears from students' dashboards.`}
          </p>
          <div className="mt-3 flex gap-3">
            <Button variant={confirm === "archive" ? "destructive" : "primary"} size="sm" onClick={() => transition(confirm)}>
              {confirm === "publish" ? "Yes, publish" : "Yes, archive"}
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}

      {editing ? (
        view.status === "draft" ? (
          <AssignmentFormView
            initial={view}
            saveLabel="Save changes"
            onSave={async (form) => {
              const updated = await updateAssignment(accessToken, orgId, id, toInput(form));
              setData(updated);
              setEditing(false);
              setMessage({ tone: "success", text: "Saved." });
            }}
          />
        ) : (
          <PublishedEdit
            view={view}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setData(updated);
              setEditing(false);
              setMessage({ tone: "success", text: "Saved." });
            }}
          />
        )
      ) : (
        <Summary view={view} />
      )}

      {view.status !== "draft" ? <CompletionTiles counts={view.counts} dueAt={view.dueAt} /> : null}
      {view.status !== "draft" ? <ProgressTable assignment={view} /> : null}
    </div>
  );
}

/** Completed, in progress, not started and overdue, as the server counted them. */
export function CompletionTiles({ counts, dueAt }: { counts: AssignmentView["counts"]; dueAt: string }) {
  return (
    <StatTiles label="Completion" columns={4}>
      <StatTile
        label="Completed"
        value={counts.completed}
        detail={counts.recipients > 0 ? `${Math.round((counts.completed / counts.recipients) * 100)}% of ${counts.recipients} students` : "No students yet"}
      />
      <StatTile label="In progress" value={counts.inProgress} detail="Started, not finished" />
      <StatTile label="Not started" value={counts.notStarted} detail="Students get a reminder email before the deadline" />
      <StatTile label="Overdue" value={counts.overdue} detail={`Past ${formatDue(dueAt)}`} />
    </StatTiles>
  );
}

function Summary({ view }: { view: AssignmentView }) {
  const rows: [string, string][] = [
    ["Type", assignmentSummary(view)],
    ...(view.kind === "interview"
      ? ([
          ["Length", view.durationMinutes ? `${view.durationMinutes} minutes` : "Not set"],
          ["Company and role", [view.companyName, view.roleTitle].filter(Boolean).join(", ") || "General practice"],
          ...(view.focusTopic ? [["Focus topic", view.focusTopic]] : []),
          ["Attempts per student", String(view.attemptLimit)],
          ["Interview cap", String(view.interviewCap ?? view.attemptLimit)],
        ] as [string, string][])
      : []),
    ...(view.kind === "mcq_test" && view.mcq
      ? ([
          ["Courses", view.mcq.courseSlugs.join(", ")],
          ["Questions per attempt", String(view.mcq.questionCount)],
          ["Time limit", view.mcq.timeLimitMinutes ? `${view.mcq.timeLimitMinutes} minutes` : "No limit"],
          ["Attempts per student", String(view.attemptLimit)],
        ] as [string, string][])
      : []),
    ["Deadline", `${formatDue(view.dueAt)} (${relativeTime(view.dueAt)})`],
    ["Late attempts", view.allowLate ? "Allowed" : "Not allowed"],
    ["Readiness component", view.component ? COMPONENT_LABEL[view.component] : "Not set"],
    ["Batches", view.targetBatches.map((b) => b.name).join(", ") || "None"],
    ["Individual students", view.targetStudents.map((s) => s.name ?? s.rollNumber ?? "Student").join(", ") || "None"],
  ];
  return (
    <section aria-labelledby="assignment-heading" className="card flex flex-col gap-4 p-6">
      <div className="flex flex-wrap items-center gap-3">
        <h2 id="assignment-heading" className="text-heading text-ink">
          {view.title}
        </h2>
        <Badge tone={view.status === "published" ? "positive" : view.status === "draft" ? "info" : "navy"}>
          {ASSIGNMENT_STATUS_LABEL[view.status]}
        </Badge>
      </div>
      {view.instructions ? <p className="whitespace-pre-line text-body text-ink-muted">{view.instructions}</p> : null}
      <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-[14rem_1fr]">
        {rows.map(([term, value]) => (
          <div key={term} className="contents">
            <dt className="text-caption font-semibold text-ink">{term}</dt>
            <dd className="text-body text-ink-muted">{value}</dd>
          </div>
        ))}
      </dl>
      {view.status !== "draft" ? (
        <p className="text-caption text-ink-muted">
          {view.counts.recipients} students: {view.counts.notStarted} not started, {view.counts.inProgress} in progress,{" "}
          {view.counts.completed} completed, {view.counts.overdue} overdue.
        </p>
      ) : null}
    </section>
  );
}

/** A published assignment may change only its deadline, late setting and instructions. */
function PublishedEdit({
  view,
  onCancel,
  onSaved,
}: {
  view: AssignmentView;
  onCancel: () => void;
  onSaved: (updated: AssignmentView) => void;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [dueAt, setDueAt] = useState(toLocalInput(view.dueAt));
  const [allowLate, setAllowLate] = useState(view.allowLate);
  const [instructions, setInstructions] = useState(view.instructions ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function save() {
    if (!dueAt || Number.isNaN(new Date(dueAt).getTime())) {
      setError("Set a deadline.");
      return;
    }
    setPending(true);
    setError(null);
    try {
      onSaved(
        await updateAssignment(accessToken, orgId, view.id, {
          dueAt: fromLocalInput(dueAt),
          allowLate,
          instructions: instructions.trim() || null,
        }),
      );
    } catch (cause) {
      setError(errorText(cause));
      setPending(false);
    }
  }

  return (
    <section aria-label="Edit published assignment" className="card flex flex-col gap-4 p-6">
      <p className="text-caption text-ink-muted">A published assignment can only change its deadline, late setting and instructions.</p>
      <div>
        <FieldLabel htmlFor={`${id}-due`}>Deadline</FieldLabel>
        <Input id={`${id}-due`} type="datetime-local" value={dueAt} onChange={(e) => setDueAt(e.target.value)} />
      </div>
      <label className="flex items-center gap-3 text-body">
        <Checkbox checked={allowLate} onChange={(e) => setAllowLate(e.target.checked)} />
        Allow late attempts
      </label>
      <div>
        <FieldLabel htmlFor={`${id}-instructions`}>Instructions</FieldLabel>
        <Textarea id={`${id}-instructions`} rows={3} maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)} />
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      <div className="flex gap-3">
        <Button onClick={save} disabled={pending}>
          Save changes
        </Button>
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </section>
  );
}

function ProgressTable({ assignment }: { assignment: AssignmentView }) {
  const { orgId, accessToken } = useCampusOrg();
  const [batchId, setBatchId] = useState("");
  const [status, setStatus] = useState<CompletionStatus | "">("");
  const [sort, setSort] = useState<{ key: SortKey; direction: "asc" | "desc" }>({ key: "name", direction: "asc" });

  const loadBatches = useCallback((signal: AbortSignal) => fetchBatches(orgId, { accessToken, signal }), [orgId, accessToken]);
  const batches = useLoad(loadBatches);
  const load = useCallback(
    (signal: AbortSignal) =>
      fetchAssignmentProgress(orgId, assignment.id, { accessToken, signal }, {
        ...(batchId ? { batchId } : {}),
        ...(status ? { status } : {}),
      }),
    [orgId, assignment.id, accessToken, batchId, status],
  );
  const { data, error, loading } = useLoad(load);
  const rows = useMemo(() => (data ? sortProgress(data, sort.key, sort.direction) : []), [data, sort]);
  const targeted = assignment.targetBatches;
  const batchOptions = (batches.data ?? []).filter((b) => targeted.length === 0 || targeted.some((t) => t.id === b.id));
  const isInterview = assignment.kind === "interview";
  const isMcq = assignment.kind === "mcq_test";

  function header(key: SortKey, label: string) {
    const active = sort.key === key;
    return (
      <th scope="col" className="p-3" aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
        <button
          type="button"
          className="font-semibold underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          onClick={() => setSort({ key, direction: active && sort.direction === "asc" ? "desc" : "asc" })}
        >
          {label}
        </button>
      </th>
    );
  }

  return (
    <section aria-labelledby="progress-heading" className="flex flex-col gap-4">
      <h2 id="progress-heading" className="text-heading text-ink">
        Student progress
      </h2>
      <div className="flex flex-wrap gap-4">
        <div>
          <FieldLabel htmlFor="progress-batch">Batch</FieldLabel>
          <Select id="progress-batch" value={batchId} onChange={(e) => setBatchId(e.target.value)}>
            <option value="">All batches</option>
            {batchOptions.map((b) => (
              <option key={b.id} value={b.id}>
                {b.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor="progress-status">Status</FieldLabel>
          <Select id="progress-status" value={status} onChange={(e) => setStatus(e.target.value as CompletionStatus | "")}>
            <option value="">All statuses</option>
            {(Object.keys(STATUS_LABEL) as CompletionStatus[]).map((s) => (
              <option key={s} value={s}>
                {STATUS_LABEL[s]}
              </option>
            ))}
          </Select>
        </div>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-40 w-full" /> : null}
      {data && data.length === 0 ? <EmptyState title="No students match" description="Change the filters to see other students." /> : null}
      {data && data.length > 0 ? (
        <TableScroll>
          <Table>
            <caption className="sr-only">Progress of each student</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {header("name", "Student")}
                <th scope="col" className="p-3">Batch</th>
                {header("status", "Status")}
                {isInterview ? (
                  <th scope="col" className="p-3">Attempts</th>
                ) : isMcq ? (
                  <th scope="col" className="p-3">Best score</th>
                ) : (
                  <th scope="col" className="p-3">Scenario score</th>
                )}
                {header("lastActivity", "Last activity")}
                <th scope="col" className="p-3">
                  <span className="sr-only">Open</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.memberId} className="border-t border-line">
                  <td className="p-3">
                    <span className="font-semibold text-ink">{row.name ?? row.email}</span>
                    <span className="block text-ink-muted">{[row.rollNumber, row.name ? row.email : null].filter(Boolean).join(" · ")}</span>
                  </td>
                  <td className="p-3">{row.batchName}</td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[row.status]}>{STATUS_LABEL[row.status]}</Badge>
                  </td>
                  <td className="p-3">
                    {isInterview
                      ? `${row.attemptsUsed} of ${assignment.attemptLimit}`
                      : isMcq
                        ? row.mcqScore === null || row.mcqScore === undefined
                          ? `Not submitted (${row.attemptsUsed} of ${assignment.attemptLimit} attempts)`
                          : `${row.mcqScore} / 100 (${row.attemptsUsed} of ${assignment.attemptLimit} attempts)`
                        : row.scenarioScore === null
                        ? "Not scored"
                        : `${Math.round(row.scenarioScore * 100)}%`}
                  </td>
                  <td className="p-3">{row.lastActivityAt ? formatDue(row.lastActivityAt) : "No activity yet"}</td>
                  <td className="p-3">
                    {isInterview && row.status === "completed" && row.completedSessionId ? (
                      <Link
                        href={campusHref(`/campus/readiness/${row.memberId}/reports/${row.completedSessionId}`, orgId)}
                        className="font-semibold text-accent underline"
                      >
                        Report <span className="sr-only">for {row.name ?? row.email}</span>
                      </Link>
                    ) : (
                      <Link href={campusHref(`/campus/readiness/${row.memberId}`, orgId)} className="font-semibold text-accent underline">
                        Student<span className="sr-only">: {row.name ?? row.email}</span>
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
    </section>
  );
}
