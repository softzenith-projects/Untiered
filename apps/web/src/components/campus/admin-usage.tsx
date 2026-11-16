"use client";

import { useCallback, useId, useState } from "react";

import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Input } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchCampusUsage } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { OrgUsageRow } from "@untiered/shared";

import { NotFoundState } from "./admin-colleges";
import { useLoad } from "./use-load";

export const USAGE_NOTE = "Estimated from recorded model usage; excludes hosting and email costs.";

const NEVER = new Promise<never>(() => {});

/** Local calendar month, as YYYY-MM-DD. */
export function currentMonthRange(now: Date = new Date()): { from: string; to: string } {
  const pad = (value: number) => String(value).padStart(2, "0");
  const first = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
  const last = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  return { from: first, to: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(last)}` };
}

export function formatUsd(value: number): string {
  return `$${value.toFixed(2)}`;
}

/** Platform admin: allowance, interviews and estimated AI cost for every college. */
export function AdminUsage() {
  const accessToken = useAccessToken();
  const id = useId();
  const [range, setRange] = useState(() => currentMonthRange());
  const load = useCallback(
    (signal: AbortSignal): Promise<OrgUsageRow[]> => (accessToken ? fetchCampusUsage(range, { accessToken, signal }) : NEVER),
    [accessToken, range],
  );
  const { data, error, loading } = useLoad(load);

  if (error?.status === 404) return <NotFoundState />;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-end gap-4">
        <div>
          <FieldLabel htmlFor={`${id}-from`}>From</FieldLabel>
          <Input id={`${id}-from`} type="date" value={range.from} max={range.to} onChange={(event) => setRange({ ...range, from: event.target.value })} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-to`}>To</FieldLabel>
          <Input id={`${id}-to`} type="date" value={range.to} min={range.from} onChange={(event) => setRange({ ...range, to: event.target.value })} />
        </div>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : data && data.length === 0 ? (
        <EmptyState title="No colleges yet" description="Usage appears once a college has been created." />
      ) : data ? (
        <TableScroll>
          <Table>
            <caption className="sr-only">Interview usage and estimated AI cost per college</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">College</th>
                <th scope="col" className="px-4 py-3">Allowance</th>
                <th scope="col" className="px-4 py-3">Used</th>
                <th scope="col" className="px-4 py-3">This month</th>
                <th scope="col" className="px-4 py-3">AI cost</th>
                <th scope="col" className="px-4 py-3">Cost per interview</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.orgId} className="border-t border-line">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">{row.orgName}</th>
                  <td className="px-4 py-3">{row.interviewAllowance}</td>
                  <td className="px-4 py-3">{row.interviewsUsed}</td>
                  <td className="px-4 py-3">{row.interviewsThisMonth}</td>
                  <td className="px-4 py-3">{formatUsd(row.aiCostUsd)}</td>
                  <td className="px-4 py-3">{row.aiCostPerInterviewUsd === null ? "No interviews" : formatUsd(row.aiCostPerInterviewUsd)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
      <p className="text-caption text-ink-muted">{USAGE_NOTE}</p>
    </div>
  );
}
