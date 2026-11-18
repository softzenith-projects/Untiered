"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback } from "react";

import { IntegritySection } from "@/components/integrity-summary";
import { ReportView } from "@/components/report-view";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Badge } from "@/components/ui/badge";
import { fetchStaffStudentIntegrity, fetchStaffStudentReport, fetchStudentIntegrityTotals, fetchStudentReadiness } from "@/lib/api";
import type { StaffStudentDetail, StudentIntegrityTotals } from "@untiered/shared";

import { REASON_LABEL } from "./attention-panel";
import { formatDue, STATUS_LABEL, STATUS_TONE } from "./assignment-model";
import { campusHref, useCampusOrg } from "./campus-context";
import { formatDate, lastActiveText } from "./readiness-model";
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
      {data?.staff ? <NeedsAttentionCallout staff={data.staff} /> : null}
      {data ? (
        <StudentReadinessView
          readiness={data}
          reportHref={(item) =>
            item.kind === "interview" && item.sessionId
              ? campusHref(`/campus/readiness/${memberId}/reports/${item.sessionId}`, orgId)
              : item.mcqAttemptId
                ? campusHref(`/campus/readiness/${memberId}/tests/${item.mcqAttemptId}`, orgId)
                : null
          }
        />
      ) : null}
      {data?.staff ? <AssignedWorkSection staff={data.staff} memberId={memberId} /> : null}
      {data ? <IntegrityTotalsSection memberId={memberId} /> : null}
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

/** Why this student is on the needs-attention list, in the list's own words, and when they last practised. */
export function NeedsAttentionCallout({ staff }: { staff: StaffStudentDetail }) {
  return (
    <div className="flex flex-col gap-3">
      {staff.attention.length > 0 ? (
        <Alert tone="error" aria-label="Needs attention">
          <p className="font-semibold">Needs attention</p>
          <ul className="mt-2 flex flex-wrap gap-2" aria-label="Reasons">
            {staff.attention.map((reason) => (
              <li key={reason}>
                <Badge tone="danger">{REASON_LABEL[reason]}</Badge>
              </li>
            ))}
          </ul>
        </Alert>
      ) : null}
      <p className="text-caption text-ink-muted">
        Last active: <span className="font-semibold text-ink">{lastActiveText(staff.lastActiveAt)}</span>. Shown within what the student agreed
        to share: the work the college assigned, and their last-active date. Their own practice stays private.
      </p>
    </div>
  );
}

/** Every assignment the student is set, with where it stands and the report once there is one. */
export function AssignedWorkSection({ staff, memberId }: { staff: StaffStudentDetail; memberId: string }) {
  const { orgId } = useCampusOrg();
  return (
    <section aria-labelledby="assigned-work-heading" className="flex flex-col gap-3">
      <h2 id="assigned-work-heading" className="text-heading text-ink">
        Assigned work
      </h2>
      {staff.assignedWork.length === 0 ? (
        <p className="text-caption text-ink-muted">Nothing assigned yet.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {staff.assignedWork.map((work) => (
            <li key={work.assignmentId} className="card flex flex-wrap items-center justify-between gap-3 p-4">
              <div>
                <p className="text-body font-semibold text-ink">{work.title}</p>
                <p className="text-caption text-ink-muted">Due {formatDue(work.dueAt)}</p>
              </div>
              <div className="flex items-center gap-4">
                <Badge tone={STATUS_TONE[work.status]}>{STATUS_LABEL[work.status]}</Badge>
                {work.status === "completed" && work.kind === "interview" && work.sessionId ? (
                  <Link
                    href={campusHref(`/campus/readiness/${memberId}/reports/${work.sessionId}`, orgId)}
                    className="text-caption font-semibold text-accent underline"
                  >
                    Report<span className="sr-only">: {work.title}</span>
                  </Link>
                ) : null}
                {work.kind === "mcq_test" && work.mcqAttemptId ? (
                  <Link
                    href={campusHref(`/campus/readiness/${memberId}/tests/${work.mcqAttemptId}`, orgId)}
                    className="text-caption font-semibold text-accent underline"
                  >
                    View answers<span className="sr-only">: {work.title}</span>
                  </Link>
                ) : null}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Integrity counts on this student's assigned rounds. Counts, never a verdict. A failed or
 * refused read leaves the section out rather than showing a zero that nobody measured.
 */
export function IntegrityTotalsSection({ memberId }: { memberId: string }) {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback(
    (signal: AbortSignal): Promise<StudentIntegrityTotals> => fetchStudentIntegrityTotals(orgId, memberId, { accessToken, signal }),
    [orgId, memberId, accessToken],
  );
  const { data } = useLoad(load);
  if (!data) return null;
  return (
    <section aria-labelledby="integrity-totals-heading" className="flex flex-col gap-2">
      <h2 id="integrity-totals-heading" className="text-heading text-ink">
        Integrity signals on assigned rounds
      </h2>
      <p className="text-caption text-ink-muted">
        Counts, never a verdict. The student sees the same counts on each of their reports.
      </p>
      {data.rounds === 0 ? (
        <p className="text-caption text-ink-muted">No assigned round has been started yet, so nothing was counted.</p>
      ) : (
        <ul className="flex flex-wrap gap-2" aria-label="Integrity counts">
          <li>
            <Badge tone="info">Window switches: {data.windowSwitches}</Badge>
          </li>
          <li>
            <Badge tone="info">Pastes: {data.pastes}</Badge>
          </li>
          <li>
            <Badge tone="info">Unusually fast answers: {data.fastAnswers}</Badge>
          </li>
        </ul>
      )}
    </section>
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
  const loadIntegrity = useCallback(
    ({ accessToken, signal }: { accessToken: string; signal: AbortSignal }) =>
      fetchStaffStudentIntegrity(orgId, memberId, sessionId, { accessToken, signal }),
    [orgId, memberId, sessionId],
  );
  return (
    <div className="flex flex-col gap-4">
      <BackLink href={campusHref(`/campus/readiness/${memberId}`, orgId)}>Back to the student</BackLink>
      <Alert tone="info">
        Viewed as {orgName} staff. This report is read-only. Opening a student&rsquo;s report is written to the college&rsquo;s audit log.
      </Alert>
      <ReportView sessionId={sessionId} detailed loadReport={loadReport} />
      <IntegritySection load={loadIntegrity} />
    </div>
  );
}
