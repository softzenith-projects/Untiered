"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchAttention } from "@/lib/api";
import type { AttentionReason } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatDate, scoreText } from "./readiness-model";
import { BandPill } from "./student-readiness-view";
import { useLoad } from "./use-load";

/** Each reason in words, as a pill: the words carry the meaning, the colour only repeats it. */
export const REASON_LABEL: Record<AttentionReason, string> = {
  low_score: "Low score",
  inactive: "Inactive for 14 days",
  overdue: "Overdue work",
};

const REASON_TONE: Record<AttentionReason, "danger" | "navy" | "highlight"> = {
  low_score: "danger",
  inactive: "navy",
  overdue: "highlight",
};

const REASON_HINT: Record<AttentionReason, string> = {
  low_score: "Readiness band is Needs structured prep.",
  inactive: "No practice, round or Arena review in the last 14 days.",
  overdue: "At least one assignment is past its deadline.",
};

const REASONS = Object.keys(REASON_LABEL) as AttentionReason[];

/**
 * Students needing attention (campus spec §8): the readiness computation's students with a
 * low score, no recent activity, or overdue work. The list and its order are the server's;
 * a faculty member sees only their own batches.
 */
export function AttentionPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [reason, setReason] = useState<AttentionReason | "">("");
  const load = useCallback(
    (signal: AbortSignal) => fetchAttention(orgId, { accessToken, signal }, reason || undefined),
    [orgId, accessToken, reason],
  );
  const { data, error, loading } = useLoad(load);
  const rows = data ?? [];

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <FieldLabel htmlFor={`${id}-reason`}>Reason</FieldLabel>
          <Select
            id={`${id}-reason`}
            value={reason}
            onChange={(event) => setReason(event.target.value as AttentionReason | "")}
            aria-describedby={`${id}-reason-hint`}
          >
            <option value="">Any reason</option>
            {REASONS.map((value) => (
              <option key={value} value={value}>
                {REASON_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <p id={`${id}-reason-hint`} className="max-w-xl text-caption text-ink-muted">
          {reason ? REASON_HINT[reason] : "Students with a low score, no activity in 14 days, or overdue work. Most reasons first."}
        </p>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-48 w-full" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState
          title={reason ? `No students with "${REASON_LABEL[reason]}"` : "Nobody needs attention right now"}
          description="Students appear here when their readiness is low, they have been inactive for 14 days, or work is overdue."
        />
      ) : null}
      {rows.length > 0 ? (
        <TableScroll>
          <Table aria-busy={loading}>
            <caption className="sr-only">Students needing attention</caption>
            <thead className="bg-surface-sunken">
              <tr>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Student
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Why
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Overall
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Band
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Overdue
                </th>
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Last active
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.memberId} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <Link
                      href={campusHref(`/campus/readiness/${row.memberId}`, orgId) as Route}
                      className="font-semibold text-accent underline"
                    >
                      {row.name ?? "Unnamed student"}
                    </Link>
                    <span className="block text-ink-muted">{[row.rollNumber, row.batchName].filter(Boolean).join(" · ")}</span>
                  </th>
                  <td className="px-3 py-2">
                    <ul className="flex flex-wrap gap-1" aria-label="Reasons">
                      {row.reasons.map((value) => (
                        <li key={value}>
                          <Badge tone={REASON_TONE[value]}>{REASON_LABEL[value]}</Badge>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className="px-3 py-2 text-ink">{scoreText(row.overall)}</td>
                  <td className="px-3 py-2">
                    <BandPill band={row.band} />
                  </td>
                  <td className="px-3 py-2 text-ink">{row.overdue}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(row.lastActiveAt)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
    </div>
  );
}
