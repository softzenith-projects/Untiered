"use client";

import { useCallback } from "react";

import { Alert, Skeleton } from "@/components/ui/feedback";
import { fetchBatches, fetchCampusOrg, fetchDepartments } from "@/lib/api";

import { useCampusOrg } from "./campus-context";
import { PlacementDashboard } from "./placement-dashboard";
import { useLoad } from "./use-load";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="card p-5">
      <dt className="text-caption text-ink-muted">{label}</dt>
      <dd className="mt-1 text-display text-ink">{value}</dd>
    </div>
  );
}

/** The staff portal overview: what the college has set up so far. */
export function CampusHome() {
  const { orgId, accessToken, role } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const options = { accessToken, signal };
      const [org, departments, batches] = await Promise.all([
        fetchCampusOrg(orgId, options),
        fetchDepartments(orgId, options),
        fetchBatches(orgId, options),
      ]);
      return {
        org,
        departments: departments.length,
        batches: batches.length,
        students: batches.reduce((sum, batch) => sum + batch.studentCount, 0),
      };
    },
    [orgId, accessToken],
  );
  const { data, error, loading } = useLoad(load);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading || !data) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat label="Departments" value={data.departments} />
        <Stat label="Batches" value={data.batches} />
        <Stat label="Students" value={data.students} />
      </dl>
      {role === "faculty" ? (
        <p className="text-caption text-ink-muted">Counts cover the departments and batches in your scope.</p>
      ) : data.departments === 0 ? (
        <Alert tone="info">Start by adding the departments and batches under Departments and batches.</Alert>
      ) : null}
      <PlacementDashboard />
    </div>
  );
}
