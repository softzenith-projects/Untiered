"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useState } from "react";

import { buttonStyles } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { fetchDashboard } from "@/lib/api";

import { campusHref, useCampusOrg } from "./campus-context";
import { BandChart, SkillHeatmap, StatTiles } from "./dashboard-widgets";
import { ScopeFilters, useStructure, type Scope } from "./scope-filters";
import { useLoad } from "./use-load";

export function batchReportHref(orgId: string, scope: Scope) {
  const params = new URLSearchParams({ org: orgId });
  if (scope.batchId) params.set("batchId", scope.batchId);
  if (scope.departmentId) params.set("departmentId", scope.departmentId);
  return `/campus/reports/batch?${params.toString()}` as Route;
}

/** The placement dashboard: how ready the college's students are, for the staff in scope. */
export function PlacementDashboard() {
  const { orgId, accessToken } = useCampusOrg();
  const [scope, setScope] = useState<Scope>({ departmentId: "", batchId: "" });
  const { data: structure } = useStructure();
  const load = useCallback(
    (signal: AbortSignal) =>
      fetchDashboard(
        orgId,
        { accessToken, signal },
        { ...(scope.batchId ? { batchId: scope.batchId } : {}), ...(scope.departmentId ? { departmentId: scope.departmentId } : {}) },
      ),
    [orgId, accessToken, scope.batchId, scope.departmentId],
  );
  const { data, error, loading } = useLoad(load);

  return (
    <section aria-labelledby="placement-heading" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h2 id="placement-heading" className="text-heading text-ink">
          Placement readiness
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <Link href={campusHref("/campus/readiness", orgId)} className={buttonStyles({ variant: "secondary" })}>
            Student readiness
          </Link>
          <Link href={batchReportHref(orgId, scope)} className={buttonStyles({ variant: "secondary" })}>
            Printable batch report
          </Link>
        </div>
      </div>
      {structure ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:max-w-xl">
          <ScopeFilters structure={structure} scope={scope} onChange={setScope} />
        </div>
      ) : null}
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-40 w-full" /> : null}
      {data ? (
        <div className="flex flex-col gap-5" aria-busy={loading}>
          <StatTiles view={data} />
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <BandChart bands={data.bands} />
            <SkillHeatmap heatmap={data.heatmap} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
