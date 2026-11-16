"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Table, TableScroll } from "@/components/ui/table";
import { archiveProgramme, fetchProgramme, fetchProgrammeProgress } from "@/lib/api";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatPlainDate } from "./programme-model";
import { ProgrammeStatus } from "./programmes-panel";
import { errorText, useLoad } from "./use-load";

/** One programme and every student's progress through it. */
export function ProgrammeDetail({ programmeId }: { programmeId: string }) {
  const { orgId, accessToken, role } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal) => {
      const options = { accessToken, signal };
      const [view, progress] = await Promise.all([
        fetchProgramme(orgId, programmeId, options),
        fetchProgrammeProgress(orgId, programmeId, options),
      ]);
      return { view, progress };
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
