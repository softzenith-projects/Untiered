"use client";

import { useCallback } from "react";

import { Alert, Skeleton } from "@/components/ui/feedback";
import { fetchDepartments } from "@/lib/api";

import { useCampusOrg } from "./campus-context";
import { PlacementDashboard } from "./placement-dashboard";
import { useLoad } from "./use-load";

/** The staff portal's home: a setup hint while the college is empty, then the overview. */
export function CampusHome() {
  const { orgId, accessToken, role } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal) => ({ departments: (await fetchDepartments(orgId, { accessToken, signal })).length }),
    [orgId, accessToken],
  );
  const { data, error, loading } = useLoad(load);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading || !data) return <Skeleton className="h-32 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      {role === "faculty" ? (
        <p className="text-caption text-ink-muted">Counts cover the departments and batches in your scope.</p>
      ) : data.departments === 0 ? (
        <Alert tone="info">Start by adding the departments and batches under Departments and batches.</Alert>
      ) : null}
      <PlacementDashboard />
    </div>
  );
}
