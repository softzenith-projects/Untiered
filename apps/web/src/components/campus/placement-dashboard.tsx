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
import { BatchesCard, KpiRow, PipelineCard, SkillReadinessCard } from "./tpo-overview";
import { useLoad } from "./use-load";

export function batchReportHref(orgId: string, scope: Scope) {
  const params = new URLSearchParams({ org: orgId });
  if (scope.batchId) params.set("batchId", scope.batchId);
  if (scope.departmentId) params.set("departmentId", scope.departmentId);
  return `/campus/reports/batch?${params.toString()}` as Route;
}

/**
 * The college overview: the TPO's dashboard of how the students in scope are practising and
 * how ready they are (contract "Module 7" and "Module 7b"). Every figure is the server's; one
 * it cannot compute is left out or says "Not enough data", never 0.
 */
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
        <div>
          <h2 id="placement-heading" className="text-heading text-ink">
            College overview
          </h2>
          <p className="text-caption text-ink-muted">Trends cover the last 30 days, compared with the 30 before.</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="pill pill-info normal-case">Last 30 days</span>
          <Link href={campusHref("/campus/readiness", orgId)} className={buttonStyles({ variant: "secondary" })}>
            Student readiness
          </Link>
          <Link href={batchReportHref(orgId, scope)} className={buttonStyles({ variant: "primary" })}>
            Export report
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
          {data.pipeline ? <KpiRow view={data} /> : <StatTiles view={data} />}
          {data.pipeline ? (
            <div className="grid gap-5 lg:grid-cols-2">
              <PipelineCard pipeline={data.pipeline} />
              <SkillReadinessCard view={data} />
            </div>
          ) : null}
          {data.batches ? <BatchesCard batches={data.batches} orgId={orgId} /> : null}
          <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <BandChart bands={data.bands} />
            <SkillHeatmap heatmap={data.heatmap} />
          </div>
        </div>
      ) : null}
    </section>
  );
}
