"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback } from "react";

import { ReportView } from "@/components/report-view";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { fetchStaffStudentReport, fetchStudentReadiness } from "@/lib/api";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatDate } from "./readiness-model";
import { StaffNotesPanel } from "./staff-notes";
import { StudentReadinessView } from "./student-readiness-view";
import { useLoad } from "./use-load";

function BackLink({ href, children }: { href: Route; children: string }) {
  return (
    <Link href={href} className="w-fit text-caption font-semibold text-accent hover:underline">
      <span aria-hidden>←</span> {children}
    </Link>
  );
}

/** One student's readiness as college staff see it. */
export function StaffStudentReadiness({ memberId }: { memberId: string }) {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback(
    (signal: AbortSignal) => fetchStudentReadiness(orgId, memberId, { accessToken, signal }),
    [orgId, memberId, accessToken],
  );
  const { data, error, loading } = useLoad(load);

  return (
    <div className="flex flex-col gap-6">
      <BackLink href={campusHref("/campus/readiness", orgId)}>All students</BackLink>
      {error ? (
        <Alert tone="error">{error.status === 404 ? "This student could not be found in your college." : error.message}</Alert>
      ) : null}
      {loading && !data ? <Skeleton className="h-64 w-full" /> : null}
      {data ? (
        <StudentReadinessView
          readiness={data}
          reportHref={(item) =>
            item.sessionId ? campusHref(`/campus/readiness/${memberId}/reports/${item.sessionId}`, orgId) : null
          }
        />
      ) : null}
      {data ? (
        <StaffNotesPanel
          memberId={memberId}
          sessions={data.evidence.flatMap((item) =>
            item.sessionId ? [{ id: item.sessionId, label: `${item.assignmentTitle}, ${formatDate(item.completedAt)}` }] : [],
          )}
        />
      ) : null}
    </div>
  );
}

/** A student's interview report, read from the staff endpoint with the existing report UI. */
export function StaffStudentReport({ memberId, sessionId }: { memberId: string; sessionId: string }) {
  const { orgId, orgName } = useCampusOrg();
  const loadReport = useCallback(
    ({ accessToken, signal }: { accessToken: string; signal: AbortSignal }) =>
      fetchStaffStudentReport(orgId, memberId, sessionId, { accessToken, signal }),
    [orgId, memberId, sessionId],
  );
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={campusHref(`/campus/readiness/${memberId}`, orgId)}>Back to the student</BackLink>
      <Alert tone="info">Viewed as {orgName} staff. This report is read-only.</Alert>
      <ReportView sessionId={sessionId} detailed loadReport={loadReport} />
    </div>
  );
}
