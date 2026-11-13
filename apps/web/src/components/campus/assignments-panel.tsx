"use client";

import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchAssignments } from "@/lib/api";
import type { AssignmentStatus } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatDue, relativeTime, ROUND_LABEL } from "./assignment-model";
import { useLoad } from "./use-load";

export const ASSIGNMENT_STATUS_LABEL: Record<AssignmentStatus, string> = {
  draft: "Draft",
  published: "Published",
  archived: "Archived",
};
const STATUS_TONE = { draft: "info", published: "positive", archived: "navy" } as const;

export function assignmentSummary(a: { kind: string; roundType?: string; scenarioIds?: string[] }): string {
  if (a.kind === "arena_scenarios") return `Arena, ${a.scenarioIds?.length ?? 0} scenarios`;
  return `Interview, ${a.roundType ? ROUND_LABEL[a.roundType as keyof typeof ROUND_LABEL] ?? a.roundType : "round"}`;
}

export function AssignmentsPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const [status, setStatus] = useState<AssignmentStatus | "">("");
  const load = useCallback(
    (signal: AbortSignal) => fetchAssignments(orgId, { accessToken, signal }, status || undefined),
    [orgId, accessToken, status],
  );
  const { data, error, loading } = useLoad(load);

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
