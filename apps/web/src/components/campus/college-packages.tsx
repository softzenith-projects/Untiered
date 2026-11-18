"use client";

import { useCallback, useId } from "react";

import { Badge } from "@/components/ui/badge";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchCollegePackages } from "@/lib/api";
import type { CollegePackagesView } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { formatDay, formatInr, PACKAGE_STATUS_LABEL, PACKAGE_STATUS_TONE, perStudentText } from "./package-format";
import { useLoad } from "./use-load";

/**
 * The college's interview package (contract Module 14). Every staff role sees what is left of
 * the current one: interviews remaining, the per-student limit and the end date. Only a
 * college admin also gets the package list with what was billed; the API leaves it out for
 * everyone else.
 */
export function CollegePackagesPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const load = useCallback(
    (signal: AbortSignal): Promise<CollegePackagesView> => fetchCollegePackages(orgId, { accessToken, signal }),
    [orgId, accessToken],
  );
  const { data, error, loading } = useLoad(load);

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        Interview package
      </h2>
      {error ? (
        <Alert tone="error" className="mt-4">
          {error.message}
        </Alert>
      ) : null}
      {loading && !data ? <Skeleton className="mt-4 h-20 w-full" /> : null}
      {data ? <PackageBody view={data} /> : null}
    </section>
  );
}

function PackageBody({ view }: { view: CollegePackagesView }) {
  if (!view.fundedByPackages) {
    return (
      <p className="mt-2 max-w-prose text-caption text-ink-muted">
        Your college&apos;s interviews come from the interview allowance Untiered set up for it. Ask Untiered about a termly package.
      </p>
    );
  }
  return (
    <div className="mt-4 flex flex-col gap-6">
      {view.current ? (
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-caption text-ink-muted">Interviews remaining</dt>
            <dd className="text-heading text-ink">{view.current.interviewsRemaining}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Each student may take</dt>
            <dd className="text-heading text-ink">{perStudentText(view.current.perStudentLimit)}</dd>
          </div>
          <div>
            <dt className="text-caption text-ink-muted">Package ends</dt>
            <dd className="text-heading text-ink">{formatDay(view.current.endsOn)}</dd>
          </div>
        </dl>
      ) : (
        <Alert tone="warning">
          No package is active right now, so students cannot start college interviews. Ask Untiered to renew.
        </Alert>
      )}
      {view.packages && view.packages.length > 0 ? (
        <TableScroll>
          <Table>
            <caption className="sr-only">Your college&apos;s packages and invoices</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Term</th>
                <th scope="col" className="px-4 py-3">Interviews</th>
                <th scope="col" className="px-4 py-3">Per student</th>
                <th scope="col" className="px-4 py-3">Invoice</th>
                <th scope="col" className="px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {view.packages.map((pkg) => (
                <tr key={pkg.id} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {formatDay(pkg.startsOn)} to {formatDay(pkg.endsOn)}
                    <span className="block font-normal text-caption text-ink-muted">Usable until {formatDay(pkg.lastUsableOn)}</span>
                  </th>
                  <td className="px-4 py-3">
                    {pkg.interviewsUsed} of {pkg.interviews} used
                    <span className="block text-caption text-ink-muted">{pkg.interviewsRemaining} remaining</span>
                  </td>
                  <td className="px-4 py-3">{perStudentText(pkg.perStudentLimit)}</td>
                  <td className="px-4 py-3">
                    <Badge tone={PACKAGE_STATUS_TONE[pkg.status]}>{PACKAGE_STATUS_LABEL[pkg.status]}</Badge>
                    {pkg.invoiceNumber ? <span className="block text-caption text-ink-muted">{pkg.invoiceNumber}</span> : null}
                    {pkg.paidOn ? <span className="block text-caption text-ink-muted">Paid {formatDay(pkg.paidOn)}</span> : null}
                  </td>
                  <td className="px-4 py-3">{formatInr(pkg.amountPaise)}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
      <p className="text-caption text-ink-muted">
        Students can still start interviews for a short grace period after a package ends. Unused interviews then lapse and do not
        carry over to a renewal.
      </p>
    </div>
  );
}
