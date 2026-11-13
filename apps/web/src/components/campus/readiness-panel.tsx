"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { downloadStudentsCsv, fetchReadinessRows, type ReadinessFilter } from "@/lib/api";
import type { ReadinessCompletionFilter, ReadinessSort, StudentReadinessRow } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { saveBlob } from "./download";
import { BAND_LABEL, BAND_ORDER, COMPONENT_KEYS, COMPONENT_LABEL, formatDate, scoreText } from "./readiness-model";
import { ScopeFilters, useStructure, type Scope } from "./scope-filters";
import { BandPill } from "./student-readiness-view";
import { errorText, useLoad } from "./use-load";

const COMPLETION_LABEL: Record<ReadinessCompletionFilter, string> = {
  all_done: "Everything done",
  has_overdue: "Has overdue work",
  not_started: "Not started",
};

const SORTABLE: { sort: ReadinessSort; label: string; firstOrder: "asc" | "desc" }[] = [
  { sort: "name", label: "Student", firstOrder: "asc" },
  { sort: "overall", label: "Overall", firstOrder: "desc" },
  { sort: "last_active", label: "Last active", firstOrder: "desc" },
  { sort: "overdue", label: "Overdue", firstOrder: "desc" },
];

export function useReadinessFilter() {
  const [scope, setScope] = useState<Scope>({ departmentId: "", batchId: "" });
  const [band, setBand] = useState("");
  const [completion, setCompletion] = useState<ReadinessCompletionFilter | "">("");
  return { scope, setScope, band, setBand, completion, setCompletion };
}

/** Every student in scope with their readiness. Sorting and paging are the server's. */
export function ReadinessPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const { data: structure } = useStructure();
  const { scope, setScope, band, setBand, completion, setCompletion } = useReadinessFilter();
  const [sort, setSort] = useState<ReadinessSort>("name");
  const [order, setOrder] = useState<"asc" | "desc">("asc");
  const [more, setMore] = useState<{ key: string; items: StudentReadinessRow[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);

  const { batchId, departmentId } = scope;
  const query = useMemo<ReadinessFilter>(
    () => ({
      ...(batchId ? { batchId } : {}),
      ...(departmentId ? { departmentId } : {}),
      ...(band ? { band } : {}),
      ...(completion ? { completion } : {}),
      sort,
      order,
    }),
    [batchId, departmentId, band, completion, sort, order],
  );
  const queryKey = JSON.stringify(query);
  const loadFirst = useCallback(
    (signal: AbortSignal) => fetchReadinessRows(orgId, { accessToken, signal }, query),
    [orgId, accessToken, query],
  );
  const first = useLoad(loadFirst);

  // Pages loaded with "Load more" belong to the query they were loaded for.
  const extra = more && more.key === queryKey ? more : null;
  const rows = [...(first.data?.items ?? []), ...(extra?.items ?? [])];
  const nextCursor = extra ? extra.cursor : (first.data?.nextCursor ?? null);
  const loading = first.loading;
  const error = first.error?.message ?? moreError;

  async function loadMore() {
    if (!nextCursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchReadinessRows(orgId, { accessToken }, { ...query, cursor: nextCursor });
      setMore({ key: queryKey, items: [...(extra?.items ?? []), ...page.items], cursor: page.nextCursor });
    } catch (cause) {
      setMoreError(errorText(cause, "More students could not be loaded just now."));
    } finally {
      setLoadingMore(false);
    }
  }

  async function exportCsv() {
    setExporting(true);
    setExportError(null);
    try {
      const blob = await downloadStudentsCsv(orgId, accessToken, query);
      saveBlob(blob, "students-readiness.csv");
    } catch (cause) {
      setExportError(errorText(cause, "The export did not work. Try again in a moment."));
    } finally {
      setExporting(false);
    }
  }

  function toggleSort(next: (typeof SORTABLE)[number]) {
    if (sort === next.sort) setOrder(order === "asc" ? "desc" : "asc");
    else {
      setSort(next.sort);
      setOrder(next.firstOrder);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-end gap-3">
        {structure ? <ScopeFilters structure={structure} scope={scope} onChange={setScope} /> : null}
        <div>
          <FieldLabel htmlFor={`${id}-band`}>Band</FieldLabel>
          <Select id={`${id}-band`} value={band} onChange={(event) => setBand(event.target.value)}>
            <option value="">All bands</option>
            {BAND_ORDER.map((value) => (
              <option key={value} value={value}>
                {BAND_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-completion`}>Assignments</FieldLabel>
          <Select
            id={`${id}-completion`}
            value={completion}
            onChange={(event) => setCompletion(event.target.value as ReadinessCompletionFilter | "")}
          >
            <option value="">Any</option>
            {(Object.keys(COMPLETION_LABEL) as ReadinessCompletionFilter[]).map((value) => (
              <option key={value} value={value}>
                {COMPLETION_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <Button type="button" variant="secondary" onClick={exportCsv} disabled={exporting} className="ml-auto">
          {exporting ? "Preparing..." : "Export CSV"}
        </Button>
      </div>
      {exportError ? <Alert tone="error">{exportError}</Alert> : null}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading && rows.length === 0 ? <Skeleton className="h-48 w-full" /> : null}
      {!loading && !error && rows.length === 0 ? (
        <EmptyState title="No students match" description="Change the filters, or invite students from the Students page." />
      ) : null}
      {rows.length > 0 ? (
        <TableScroll>
          <Table aria-busy={loading}>
            <caption className="sr-only">Student readiness</caption>
            <thead className="bg-surface-sunken">
              <tr>
                {SORTABLE.map((column) => (
                  <th
                    key={column.sort}
                    scope="col"
                    aria-sort={sort === column.sort ? (order === "asc" ? "ascending" : "descending") : "none"}
                    className="px-3 py-2 font-semibold text-ink"
                  >
                    <button
                      type="button"
                      onClick={() => toggleSort(column)}
                      className="font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                    >
                      {column.label}
                      <span aria-hidden>{sort === column.sort ? (order === "asc" ? " ▲" : " ▼") : ""}</span>
                    </button>
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Band
                </th>
                {COMPONENT_KEYS.map((component) => (
                  <th key={component} scope="col" className="px-3 py-2 font-semibold text-ink">
                    {COMPONENT_LABEL[component]}
                  </th>
                ))}
                <th scope="col" className="px-3 py-2 font-semibold text-ink">
                  Done
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.memberId} className="border-t border-line">
                  <th scope="row" className="px-3 py-2 text-left font-normal">
                    <Link
                      href={campusHref(`/campus/readiness/${row.memberId}`, orgId) as Route}
                      className="font-semibold text-accent underline"
                    >
                      {row.name ?? "Unnamed student"}
                    </Link>
                    <span className="block text-ink-muted">
                      {[row.rollNumber, row.departmentCode, row.batchName].filter(Boolean).join(" · ")}
                    </span>
                  </th>
                  <td className="px-3 py-2 text-ink">{scoreText(row.overall)}</td>
                  <td className="px-3 py-2 text-ink-muted">{formatDate(row.lastActiveAt)}</td>
                  <td className="px-3 py-2 text-ink">{row.assignmentsOverdue}</td>
                  <td className="px-3 py-2">
                    <BandPill band={row.band} />
                  </td>
                  {COMPONENT_KEYS.map((component) => (
                    <td key={component} className="px-3 py-2 text-ink">
                      {row.components[component] === null ? <span className="text-ink-subtle">Not attempted</span> : Math.round(row.components[component])}
                    </td>
                  ))}
                  <td className="px-3 py-2 text-ink">{row.assignmentsCompleted}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
      {nextCursor ? (
        <Button type="button" variant="secondary" onClick={loadMore} disabled={loadingMore} className="self-start">
          {loadingMore ? "Loading..." : "Load more"}
        </Button>
      ) : null}
    </div>
  );
}
