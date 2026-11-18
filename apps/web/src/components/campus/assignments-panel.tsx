"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchAssignments, fetchCampusOrg } from "@/lib/api";
import type { AssignmentStatus, AssignmentView } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatDue, relativeTime, ROUND_LABEL } from "./assignment-model";
import { StatTile, StatTiles } from "./stat-tile";
import { useLoad } from "./use-load";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
const STATUS_TONE = { draft: "info", published: "positive", archived: "navy" } as const;

export function assignmentSummary(a: {
  kind: string;
  roundType?: string;
  scenarioIds?: string[];
  mcq?: { questionCount: number } | null;
}): string {
  if (a.kind === "arena_scenarios") return `Arena, ${a.scenarioIds?.length ?? 0} scenarios`;
  if (a.kind === "mcq_test") return `MCQ test, ${a.mcq?.questionCount ?? 0} questions`;
  return `Interview, ${a.roundType ? ROUND_LABEL[a.roundType as keyof typeof ROUND_LABEL] ?? a.roundType : "round"}`;
}

/** What the header tiles count: published and draft assignments, and student tasks that are overdue. */
export function assignmentTotals(list: Pick<AssignmentView, "status" | "counts">[]): {
  published: number;
  draft: number;
  overdueTasks: number;
} {
  return {
    published: list.filter((a) => a.status === "published").length,
    draft: list.filter((a) => a.status === "draft").length,
    overdueTasks: list.reduce((sum, a) => sum + (a.status === "published" ? a.counts.overdue : 0), 0),
  };
}

export function AssignmentsPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const load = useCallback(
    (signal: AbortSignal) => fetchAssignments(orgId, { accessToken, signal }, status || undefined),
    [orgId, accessToken, status],
  );
  const { data, error, loading } = useLoad(load);
  // The allowance is the college's own figure, readable by every staff role (contract module 1).
  const loadOrg = useCallback((signal: AbortSignal) => fetchCampusOrg(orgId, { accessToken, signal }), [orgId, accessToken]);
  const { data: org } = useLoad(loadOrg);
  const totals = data ? assignmentTotals(data) : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <FieldLabel htmlFor="assignment-status">Status</FieldLabel>
          <Select id="assignment-status" value={status} onChange={(e) => setStatus(e.target.value as AssignmentStatus | "")}>
            <option value="">All</option>
            <option value="draft">Draft</option>
            <option value="published">Published</option>
            <option value="archived">Archived</option>
          </Select>
        </div>
        <Link href={campusHref("/campus/assignments/new", orgId)} className={buttonStyles({})}>
          New assignment
        </Link>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {totals ? (
        <StatTiles label="Assignment totals" columns={3}>
          {org ? (
            <StatTile
              label="College interviews used"
              value={org.interviewsUsed}
              detail={`of ${org.interviewAllowance} in the allowance. Assigned interviews never use a student's own free rounds or credits.`}
            />
          ) : null}
          <StatTile label="Published assignments" value={totals.published} detail={`${totals.draft} draft`} />
          <StatTile
            label="Overdue student tasks"
            value={totals.overdueTasks}
            detail="Across published assignments. Shown on the needs-attention list."
          />
        </StatTiles>
      ) : null}
      {loading && !data ? <Skeleton className="h-40 w-full" /> : null}
      {data && data.length === 0 ? (
        <EmptyState title="No assignments yet" description="Assign an AI interview or a set of Arena scenarios to a batch or to chosen students." />
      ) : null}
      {data && data.length > 0 ? (
        <TableScroll>
          <Table>
            <caption className="sr-only">Assignments</caption>
            <thead className="bg-surface-sunken">
              <tr>
                <th scope="col" className="p-3">Assignment</th>
                <th scope="col" className="p-3">Status</th>
                <th scope="col" className="p-3">Due</th>
                <th scope="col" className="p-3">Not started</th>
                <th scope="col" className="p-3">In progress</th>
                <th scope="col" className="p-3">Completed</th>
                <th scope="col" className="p-3">Overdue</th>
              </tr>
            </thead>
            <tbody>
              {data.map((a) => (
                <tr key={a.id} className="border-t border-line">
                  <td className="p-3">
                    <Link href={campusHref(`/campus/assignments/${a.id}`, orgId)} className="font-semibold text-accent underline">
                      {a.title}
                    </Link>
                    <span className="block text-ink-muted">{assignmentSummary(a)}</span>
                  </td>
                  <td className="p-3">
                    <Badge tone={STATUS_TONE[a.status]}>{ASSIGNMENT_STATUS_LABEL[a.status]}</Badge>
                  </td>
                  <td className="p-3">
                    {formatDue(a.dueAt)}
                    <span className="block text-ink-muted">{relativeTime(a.dueAt)}</span>
                  </td>
                  <td className="p-3">{a.counts.notStarted}</td>
                  <td className="p-3">{a.counts.inProgress}</td>
                  <td className="p-3">{a.counts.completed}</td>
                  <td className="p-3">{a.counts.overdue}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
    </div>
  );
}
