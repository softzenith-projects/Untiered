"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback } from "react";

import { buttonStyles } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { fetchMyReadiness } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

import { StudentReadinessView } from "./student-readiness-view";
import { useLoad } from "./use-load";

/** The signed-in student's own readiness. They see what their college sees, minus anything staff-only. */
export function MyReadiness() {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal) => (accessToken ? fetchMyReadiness({ accessToken, signal }) : new Promise<never>(() => {})),
    [accessToken],
  );
  const { data, error, loading } = useLoad(load);

  if (accessToken === null) return <Alert tone="warning">Sign in to see your readiness.</Alert>;
  if (error?.status === 404) {
    return (
      <EmptyState
        title="You are not in a college on Untiered"
        description="Readiness comes from the work your college assigns you. Join your college from the invitation your placement office sent you."
        action={
          <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
            Back to your dashboard
          </Link>
        }
      />
    );
  }
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading || !data) return <Skeleton className="h-64 w-full" />;
  return (
    <div className="flex flex-col gap-4">
      <p className="text-caption text-ink-muted">
        This counts only the work your college has assigned you. Your own practice is not part of it.
      </p>
      <StudentReadinessView readiness={data} reportHref={(item) => (item.sessionId ? (`/report/${item.sessionId}` as Route) : null)} />
    </div>
  );
}
