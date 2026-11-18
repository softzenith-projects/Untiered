"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Table, TableScroll } from "@/components/ui/table";
import { archiveProgramme, fetchProgramme, fetchProgrammeProgress, fetchProgrammeWeeks } from "@/lib/api";
import type { ProgrammeView, ProgrammeWeekView } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatIst, formatPlainDate } from "./programme-model";
import { ProgrammeStatus } from "./programmes-panel";
import { ProgressBar } from "@/components/ui/progress";
import { errorText, useLoad } from "./use-load";

/**
 * Each week of the programme: its assignments, when it unlocks, and what share of its students
 * finished it. The numbers are the server's; a locked week has no share to show.
 */
export function WeeksSection({ weeks }: { weeks: ProgrammeWeekView[] }) {
  const openWeeks = weeks.filter((week) => week.opened).length;
  return (
    <section aria-labelledby="weeks-heading" className="card flex flex-col gap-3 p-5">
      <div>
        <h2 id="weeks-heading" className="text-heading text-ink">
          Weeks
        </h2>
        <p className="text-caption text-ink-muted">
          {weeks.length === 0
            ? "This programme has no weekly assignments."
            : `${openWeeks} of ${weeks.length} ${weeks.length === 1 ? "week is" : "weeks are"} open. A new week unlocks at 9:00 am IST.`}
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {weeks.map((week) => (
          <li key={week.week} className="flex flex-col gap-2 rounded-lg border border-line p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-body font-semibold text-ink">
                Week {week.week}
                <span className="block text-caption font-normal text-ink-muted">{week.assignments.map((a) => a.title).join(", ")}</span>
              </p>
              {week.opened ? <Badge tone="positive">Open</Badge> : <Badge tone="navy">Locked</Badge>}
            </div>
            {week.opened ? (
              week.completionRate === null ? (
                <p className="text-caption text-ink-muted">No students are set this week yet.</p>
              ) : (
                <>
                  <ProgressBar
                    value={week.completedStudents}
                    max={week.students}
                    label={`Week ${week.week}: ${week.completedStudents} of ${week.students} students completed`}
                  />
                  <p className="text-caption text-ink-muted">
                    <span className="font-semibold text-ink">{Math.round(week.completionRate * 100)}%</span> of students completed this week (
                    {week.completedStudents} of {week.students})
                  </p>
                </>
              )
            ) : (
              <p className="text-caption text-ink-muted">Unlocks {formatIst(week.opensAt)}</p>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/** What a student who completes every week is awarded. A preview only: no name, no date, no id. */
export function CertificatePreview({ view, orgName, logoUrl }: { view: ProgrammeView; orgName: string; logoUrl: string | null }) {
  return (
    <section aria-labelledby="certificate-preview-heading" className="card flex flex-col gap-3 p-5">
      <h2 id="certificate-preview-heading" className="text-heading text-ink">
        Certificate
      </h2>
      <div className="flex flex-col items-center gap-2 rounded-lg border-4 border-double border-accent p-5 text-center">
        <p className="text-caption font-semibold uppercase tracking-widest text-accent">Certificate of completion</p>
        <p className="text-body font-semibold text-ink">{view.title}</p>
        <p className="text-caption text-ink-muted">
          Awarded to a student who completes all {view.weeks} {view.weeks === 1 ? "week" : "weeks"}
        </p>
        <p className="flex items-center gap-2 text-caption font-semibold text-ink">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt="" className="size-6 rounded object-contain" />
          ) : null}
          Untiered <span className="font-normal text-ink-muted">×</span> {orgName}
        </p>
      </div>
      <p className="text-caption text-ink-muted">Preview. Students print or save their own as a PDF from their campus page, with their name, date and ID.</p>
    </section>
  );
}

/** One programme and every student's progress through it. */
export function ProgrammeDetail({ programmeId }: { programmeId: string }) {
  const { orgId, orgName, logoUrl, accessToken, role } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const options = { accessToken, signal };
      const [view, progress, weeks] = await Promise.all([
        fetchProgramme(orgId, programmeId, options),
        fetchProgrammeProgress(orgId, programmeId, options),
        fetchProgrammeWeeks(orgId, programmeId, options),
      ]);
      return { view, progress, weeks };
    },
    [orgId, programmeId, accessToken],
  );
  const { data, error, loading, setData } = useLoad(load);
  const [confirming, setConfirming] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const canArchive = role === "college_admin" || role === "tpo";

  async function archive() {
    setArchiving(true);
    setArchiveError(null);
    try {
      const view = await archiveProgramme(accessToken, orgId, programmeId);
      setData((current) => (current ? { ...current, view } : current));
      setConfirming(false);
    } catch (cause) {
      setArchiveError(errorText(cause));
    } finally {
      setArchiving(false);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <Link href={campusHref("/campus/programmes", orgId)} className="w-fit text-caption font-semibold text-accent hover:underline">
        <span aria-hidden>←</span> All programmes
      </Link>
      {error ? <Alert tone="error">{error.status === 404 ? "This programme could not be found in your college." : error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-48 w-full" /> : null}
      {data ? (
        <>
          <section aria-labelledby="programme-heading" className="card flex flex-col gap-3 p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 id="programme-heading" className="text-heading text-ink">
                {data.view.title}
              </h2>
              <ProgrammeStatus view={data.view} />
            </div>
            <p className="text-caption text-ink-muted">
              Starts {formatPlainDate(data.view.startsOn)} · {data.view.weeks} {data.view.weeks === 1 ? "week" : "weeks"} ·{" "}
              {data.view.assignmentIds.length} assignments · {data.view.targetBatches.map((b) => b.name).join(", ")}
            </p>
            {canArchive && data.view.status === "active" ? (
              <div className="flex flex-wrap items-center gap-3">
                {!confirming ? (
                  <Button type="button" variant="secondary" size="sm" onClick={() => setConfirming(true)}>
                    Archive programme
                  </Button>
                ) : (
                  <>
                    <span className="text-caption text-ink">
                      Archive it? Weeks that have not opened yet are archived too; open weeks stay.
                    </span>
                    <Button type="button" variant="destructive" size="sm" onClick={archive} loading={archiving}>
                      Yes, archive
                    </Button>
                    <Button type="button" variant="quiet" size="sm" onClick={() => setConfirming(false)}>
                      Keep it
                    </Button>
                  </>
                )}
              </div>
            ) : null}
            {archiveError ? <Alert tone="error">{archiveError}</Alert> : null}
          </section>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
            <WeeksSection weeks={data.weeks} />
            <CertificatePreview view={data.view} orgName={orgName} logoUrl={logoUrl} />
          </div>

          <section aria-labelledby="progress-heading" className="flex flex-col gap-3">
            <h2 id="progress-heading" className="text-heading text-ink">
              Progress
            </h2>
            {data.progress.length === 0 ? (
              <EmptyState title="No students yet" description="Students appear here once they join one of the programme's batches." />
            ) : (
              <TableScroll>
                <Table>
                  <caption className="sr-only">Progress through {data.view.title}</caption>
                  <thead className="bg-surface-sunken">
                    <tr>
                      <th scope="col" className="px-3 py-2 font-semibold text-ink">Student</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-ink">Modules completed</th>
                      <th scope="col" className="px-3 py-2 font-semibold text-ink">Certificate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.progress.map((row) => (
                      <tr key={row.memberId} className="border-t border-line">
                        <th scope="row" className="px-3 py-2 text-left font-normal">
                          <Link href={campusHref(`/campus/readiness/${row.memberId}`, orgId) as Route} className="font-semibold text-accent underline">
                            {row.name ?? "Unnamed student"}
                          </Link>
                        </th>
                        <td className="px-3 py-2 text-ink">
                          {row.completedModules} of {row.totalModules}
                        </td>
                        <td className="px-3 py-2">
                          {row.certificateIssued ? <Badge tone="positive">Earned</Badge> : <span className="text-ink-muted">Not yet</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Table>
              </TableScroll>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
