"use client";

import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { fetchDashboard, fetchReadinessRows, recordBatchReportViewed } from "@/lib/api";
import type { StudentReadinessRow } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { BandChart, SkillHeatmap, StatTiles } from "./dashboard-widgets";
import { BAND_LABEL, COMPONENT_KEYS, COMPONENT_LABEL, formatDate, scoreText } from "./readiness-model";
import { describeScope, useStructure } from "./scope-filters";
import { useLoad } from "./use-load";

const MAX_PAGES = 30;

/**
 * The printable batch report. The TPO saves it as a PDF from the browser's print dialog;
 * the print rules in globals.css strip the portal around it.
 */
export function BatchReport() {
  const { orgId, orgName, logoUrl, accessToken } = useCampusOrg();
  const params = useSearchParams();
  const batchId = params.get("batchId") ?? "";
  const departmentId = params.get("departmentId") ?? "";
  const { data: structure } = useStructure();
  const [generatedAt] = useState(() => new Date());

  // Opening the report is audited once, however many times React runs the effect.
  const audited = useRef(false);
  useEffect(() => {
    if (audited.current) return;
    audited.current = true;
    recordBatchReportViewed(accessToken, orgId, {
      ...(batchId ? { batchId } : {}),
      ...(departmentId ? { departmentId } : {}),
    }).catch(() => {});
  }, [accessToken, orgId, batchId, departmentId]);

  const load = useCallback(
    async (signal: AbortSignal) => {
      const options = { accessToken, signal };
      const filter = { ...(batchId ? { batchId } : {}), ...(departmentId ? { departmentId } : {}) };
      const dashboard = await fetchDashboard(orgId, options, filter);
      const rows: StudentReadinessRow[] = [];
      let cursor: string | undefined;
      for (let page = 0; page < MAX_PAGES; page += 1) {
        const result = await fetchReadinessRows(orgId, options, { ...filter, sort: "name", order: "asc", ...(cursor ? { cursor } : {}) });
        rows.push(...result.items);
        if (!result.nextCursor) break;
        cursor = result.nextCursor;
      }
      return { dashboard, rows };
    },
    [orgId, accessToken, batchId, departmentId],
  );
  const { data, error, loading } = useLoad(load);

  return (
    <div className="batch-report flex flex-col gap-8">
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-prose text-caption text-ink-muted">
          Use Print to open the print dialog, then choose Save as PDF as the destination.
        </p>
        <Button type="button" onClick={() => window.print()} disabled={!data}>
          Print / Save as PDF
        </Button>
      </div>
      <div className="flex items-center gap-4 border-b border-line pb-4">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logoUrl} alt="" className="size-14 rounded-lg border border-line object-contain" />
        ) : null}
        <div>
          <h2 className="text-display text-ink">{orgName}</h2>
          <p className="text-body text-ink">Placement readiness report</p>
          <p className="text-caption text-ink-muted">
            {describeScope(structure, { departmentId, batchId })} · Generated {formatDate(generatedAt.toISOString())}
          </p>
        </div>
      </div>
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-64 w-full" /> : null}
      {data ? (
        <>
          <section aria-label="Summary" className="print-section flex flex-col gap-5">
            <StatTiles view={data.dashboard} />
            <BandChart bands={data.dashboard.bands} />
          </section>
          <section aria-label="Skill gaps" className="print-section">
            <SkillHeatmap heatmap={data.dashboard.heatmap} />
          </section>
          <section aria-labelledby="batch-students" className="print-section flex flex-col gap-3">
            <h2 id="batch-students" className="text-heading text-ink">
              Students ({data.rows.length})
            </h2>
            <table className="w-full border-collapse text-left text-caption">
              <caption className="sr-only">Student readiness</caption>
              <thead>
                <tr className="border-b border-line-strong">
                  <th scope="col" className="py-1 pr-2">Student</th>
                  <th scope="col" className="py-1 pr-2">Overall</th>
                  <th scope="col" className="py-1 pr-2">Band</th>
                  {COMPONENT_KEYS.map((key) => (
                    <th key={key} scope="col" className="py-1 pr-2">
                      {COMPONENT_LABEL[key]}
                    </th>
                  ))}
                  <th scope="col" className="py-1 pr-2">Done</th>
                  <th scope="col" className="py-1 pr-2">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.rows.map((row) => (
                  <tr key={row.memberId} className="border-b border-line">
                    <th scope="row" className="py-1 pr-2 text-left font-normal">
                      {row.name ?? "Unnamed student"}
                      <span className="block text-ink-muted">
                        {[row.rollNumber, row.departmentCode, row.batchName].filter(Boolean).join(" · ")}
                      </span>
                    </th>
                    <td className="py-1 pr-2">{scoreText(row.overall)}</td>
                    <td className="py-1 pr-2">{BAND_LABEL[row.band]}</td>
                    {COMPONENT_KEYS.map((key) => (
                      <td key={key} className="py-1 pr-2">
                        {scoreText(row.components[key])}
                      </td>
                    ))}
                    <td className="py-1 pr-2">{row.assignmentsCompleted}</td>
                    <td className="py-1 pr-2">{row.assignmentsOverdue}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        </>
      ) : null}
    </div>
  );
}
