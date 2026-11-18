"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldHint, FieldLabel, Input, Textarea } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlay";
import { Table, TableScroll } from "@/components/ui/table";
import {
  createAdminPackage,
  deleteAdminPackage,
  fetchAdminPackages,
  fetchCampusBilling,
  invoiceAdminPackage,
  payAdminPackage,
  updateAdminPackage,
  voidAdminPackage,
} from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { AdminPackageView, CollegeBillingRow, PackageRequest } from "@untiered/shared";

import { NotFoundState } from "./admin-colleges";
import {
  formatDay,
  formatInr,
  PACKAGE_STATUS_LABEL,
  PACKAGE_STATUS_TONE,
  paiseToRupees,
  perStudentText,
  rupeesToPaise,
} from "./package-format";
import { errorText, useLoad } from "./use-load";

const NEVER = new Promise<never>(() => {});

const formatUsd = (value: number) => `$${value.toFixed(2)}`;

type Action = { kind: "create" } | { kind: "edit" | "invoice" | "paid" | "void" | "delete"; pkg: AdminPackageView };

/** Platform admin, on the college detail page: what the college bought, and its payments (contract Module 14). */
export function AdminPackagesSection({ orgId }: { orgId: string }) {
  const accessToken = useAccessToken();
  const id = useId();
  const load = useCallback(
    (signal: AbortSignal): Promise<AdminPackageView[]> => (accessToken ? fetchAdminPackages(orgId, { accessToken, signal }) : NEVER),
    [accessToken, orgId],
  );
  const { data, error, loading, setData } = useLoad(load);
  const [action, setAction] = useState<Action | null>(null);

  const replace = (next: AdminPackageView) =>
    setData((current) => {
      const rows = current ?? [];
      return rows.some((row) => row.id === next.id) ? rows.map((row) => (row.id === next.id ? next : row)) : [next, ...rows];
    });
  const remove = (packageId: string) => setData((current) => (current ?? []).filter((row) => row.id !== packageId));

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id={`${id}-h`} className="text-heading text-ink">
            Packages and payments
          </h2>
          <p className="mt-1 max-w-prose text-caption text-ink-muted">
            Once a package is invoiced or paid, the college&apos;s interviews come from its packages instead of the allowance above,
            earliest end date first. Interviews can be started until the end date plus the grace period; then they lapse.
          </p>
        </div>
        <Button onClick={() => setAction({ kind: "create" })}>Record a package</Button>
      </div>
      {error ? (
        <Alert tone="error" className="mt-4">
          {error.message}
        </Alert>
      ) : null}
      {loading && !data ? <Skeleton className="mt-4 h-24 w-full" /> : null}
      {data && data.length === 0 ? (
        <div className="mt-4">
          <EmptyState title="No packages yet" description="Record what the college has bought, then mark it invoiced and paid." />
        </div>
      ) : null}
      {data && data.length > 0 ? (
        <TableScroll className="mt-4">
          <Table>
            <caption className="sr-only">Packages, newest term first</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Term</th>
                <th scope="col" className="px-4 py-3">Interviews</th>
                <th scope="col" className="px-4 py-3">Per student</th>
                <th scope="col" className="px-4 py-3">Amount</th>
                <th scope="col" className="px-4 py-3">Status</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.map((pkg) => (
                <tr key={pkg.id} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {formatDay(pkg.startsOn)} to {formatDay(pkg.endsOn)}
                    <span className="block font-normal text-caption text-ink-muted">
                      Usable until {formatDay(pkg.lastUsableOn)}
                      {pkg.inWindow ? " · active now" : ""}
                    </span>
                  </th>
                  <td className="px-4 py-3">
                    {pkg.interviewsUsed} of {pkg.interviews} used
                    <span className="block text-caption text-ink-muted">{pkg.interviewsRemaining} remaining</span>
                  </td>
                  <td className="px-4 py-3">{perStudentText(pkg.perStudentLimit)}</td>
                  <td className="px-4 py-3">
                    {formatInr(pkg.amountPaise)}
                    {pkg.invoiceNumber ? <span className="block text-caption text-ink-muted">Invoice {pkg.invoiceNumber}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <Badge tone={PACKAGE_STATUS_TONE[pkg.status]}>{PACKAGE_STATUS_LABEL[pkg.status]}</Badge>
                    {pkg.invoicedOn ? <span className="block text-caption text-ink-muted">Invoiced {formatDay(pkg.invoicedOn)}</span> : null}
                    {pkg.paidOn ? <span className="block text-caption text-ink-muted">Paid {formatDay(pkg.paidOn)}</span> : null}
                    {pkg.paymentReference ? <span className="block text-caption text-ink-muted">Ref. {pkg.paymentReference}</span> : null}
                  </td>
                  <td className="px-4 py-3">
                    <PackageActions pkg={pkg} onAction={setAction} />
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
      {action && accessToken ? (
        <ActionDialog
          orgId={orgId}
          accessToken={accessToken}
          action={action}
          onClose={() => setAction(null)}
          onSaved={(next) => {
            if (next) replace(next);
            else if (action.kind === "delete") remove(action.pkg.id);
            setAction(null);
          }}
        />
      ) : null}
    </section>
  );
}

function PackageActions({ pkg, onAction }: { pkg: AdminPackageView; onAction: (action: Action) => void }) {
  if (pkg.status === "void") return <span className="text-caption text-ink-muted">No actions</span>;
  const label = (verb: string) => `${verb}: ${formatDay(pkg.startsOn)} to ${formatDay(pkg.endsOn)} package`;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" aria-label={label("Edit")} onClick={() => onAction({ kind: "edit", pkg })}>
        Edit
      </Button>
      {pkg.status === "draft" ? (
        <Button size="sm" variant="secondary" aria-label={label("Mark invoiced")} onClick={() => onAction({ kind: "invoice", pkg })}>
          Mark invoiced
        </Button>
      ) : null}
      {pkg.status === "draft" || pkg.status === "invoiced" ? (
        <Button size="sm" variant="secondary" aria-label={label("Mark paid")} onClick={() => onAction({ kind: "paid", pkg })}>
          Mark paid
        </Button>
      ) : null}
      {pkg.status === "draft" ? (
        <Button size="sm" variant="ghost" aria-label={label("Delete")} onClick={() => onAction({ kind: "delete", pkg })}>
          Delete
        </Button>
      ) : pkg.interviewsUsed === 0 ? (
        <Button size="sm" variant="ghost" aria-label={label("Void")} onClick={() => onAction({ kind: "void", pkg })}>
          Void
        </Button>
      ) : null}
    </div>
  );
}

const TITLES: Record<Action["kind"], string> = {
  create: "Record a package",
  edit: "Edit package",
  invoice: "Mark invoiced",
  paid: "Mark paid",
  void: "Void this package?",
  delete: "Delete this draft?",
};

function ActionDialog({
  orgId,
  accessToken,
  action,
  onClose,
  onSaved,
}: {
  orgId: string;
  accessToken: string;
  action: Action;
  onClose: () => void;
  onSaved: (next: AdminPackageView | null) => void;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(task: () => Promise<AdminPackageView | null>) {
    setPending(true);
    setError(null);
    try {
      onSaved(await task());
    } catch (cause) {
      setError(errorText(cause, "That could not be saved just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={TITLES[action.kind]}>
      {action.kind === "create" || action.kind === "edit" ? (
        <PackageForm
          initial={action.kind === "edit" ? action.pkg : null}
          pending={pending}
          error={error}
          onCancel={onClose}
          onSubmit={(body) =>
            void run(() =>
              action.kind === "edit"
                ? updateAdminPackage(accessToken, orgId, action.pkg.id, body)
                : createAdminPackage(accessToken, orgId, body),
            )
          }
        />
      ) : action.kind === "invoice" ? (
        <InvoiceForm
          pkg={action.pkg}
          pending={pending}
          error={error}
          onCancel={onClose}
          onSubmit={(body) => void run(() => invoiceAdminPackage(accessToken, orgId, action.pkg.id, body))}
        />
      ) : action.kind === "paid" ? (
        <PaidForm
          pending={pending}
          error={error}
          onCancel={onClose}
          onSubmit={(body) => void run(() => payAdminPackage(accessToken, orgId, action.pkg.id, body))}
        />
      ) : (
        <div className="flex flex-col gap-4">
          <p className="text-caption text-ink-muted">
            {action.kind === "void"
              ? "The college will no longer be able to use it, and it stays on record as void."
              : "The draft is removed. Nothing was issued to the college."}
          </p>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex gap-3">
            <Button
              variant="destructive"
              loading={pending}
              onClick={() =>
                void run(async () => {
                  if (action.kind === "void") return voidAdminPackage(accessToken, orgId, action.pkg.id);
                  await deleteAdminPackage(accessToken, orgId, action.pkg.id);
                  return null;
                })
              }
            >
              {action.kind === "void" ? "Yes, void it" : "Yes, delete it"}
            </Button>
            <Button variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      )}
    </Dialog>
  );
}

function FormButtons({ pending, onCancel, label }: { pending: boolean; onCancel: () => void; label: string }) {
  return (
    <div className="flex gap-3 sm:col-span-2">
      <Button type="submit" loading={pending}>
        {label}
      </Button>
      <Button type="button" variant="secondary" onClick={onCancel}>
        Cancel
      </Button>
    </div>
  );
}

function PackageForm({
  initial,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  initial: AdminPackageView | null;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: PackageRequest) => void;
}) {
  const id = useId();
  const [interviews, setInterviews] = useState(initial ? String(initial.interviews) : "");
  const [limit, setLimit] = useState(initial?.perStudentLimit ? String(initial.perStudentLimit) : "");
  const [startsOn, setStartsOn] = useState(initial?.startsOn ?? "");
  const [endsOn, setEndsOn] = useState(initial?.endsOn ?? "");
  const [grace, setGrace] = useState(initial ? String(initial.graceDays) : "14");
  const [amount, setAmount] = useState(initial ? paiseToRupees(initial.amountPaise) : "");
  const [invoice, setInvoice] = useState(initial?.invoiceNumber ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [problem, setProblem] = useState<string | null>(null);

  function submit(event: FormEvent) {
    event.preventDefault();
    const amountPaise = rupeesToPaise(amount);
    if (amountPaise === null) {
      setProblem("Enter the amount in rupees, such as 99000 or 99000.50.");
      return;
    }
    setProblem(null);
    onSubmit({
      interviews: Number.parseInt(interviews, 10),
      // 0 clears the limit on an edit; blank means none.
      perStudentLimit: limit.trim() === "" ? 0 : Number.parseInt(limit, 10),
      startsOn,
      endsOn,
      graceDays: Number.parseInt(grace, 10),
      amountPaise,
      invoiceNumber: invoice.trim(),
      notes: notes.trim(),
    });
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
      <div>
        <FieldLabel htmlFor={`${id}-interviews`}>Interviews in the pool</FieldLabel>
        <Input id={`${id}-interviews`} type="number" min={1} required value={interviews} onChange={(event) => setInterviews(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-limit`}>Interviews per student</FieldLabel>
        <Input
          id={`${id}-limit`}
          type="number"
          min={1}
          aria-describedby={`${id}-limit-hint`}
          value={limit}
          onChange={(event) => setLimit(event.target.value)}
        />
        <FieldHint id={`${id}-limit-hint`}>Leave blank for no limit.</FieldHint>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-starts`}>Term starts</FieldLabel>
        <Input id={`${id}-starts`} type="date" required value={startsOn} onChange={(event) => setStartsOn(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-ends`}>Term ends</FieldLabel>
        <Input id={`${id}-ends`} type="date" required min={startsOn || undefined} value={endsOn} onChange={(event) => setEndsOn(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-grace`}>Grace days after the end</FieldLabel>
        <Input id={`${id}-grace`} type="number" min={0} max={90} required value={grace} onChange={(event) => setGrace(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-amount`}>Amount (₹, tax inclusive)</FieldLabel>
        <Input id={`${id}-amount`} inputMode="decimal" required value={amount} onChange={(event) => setAmount(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-invoice`}>Invoice number</FieldLabel>
        <Input id={`${id}-invoice`} value={invoice} onChange={(event) => setInvoice(event.target.value)} />
      </div>
      <div className="sm:col-span-2">
        <FieldLabel htmlFor={`${id}-notes`}>Notes (only Untiered admins see these)</FieldLabel>
        <Textarea id={`${id}-notes`} rows={3} value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>
      {problem || error ? (
        <Alert tone="error" className="sm:col-span-2">
          {problem ?? error}
        </Alert>
      ) : null}
      <FormButtons pending={pending} onCancel={onCancel} label={initial ? "Save package" : "Record package"} />
    </form>
  );
}

function InvoiceForm({
  pkg,
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  pkg: AdminPackageView;
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: { invoiceNumber?: string; invoicedOn?: string }) => void;
}) {
  const id = useId();
  const [number, setNumber] = useState(pkg.invoiceNumber ?? "");
  const [on, setOn] = useState("");
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ invoiceNumber: number.trim() || undefined, invoicedOn: on || undefined });
      }}
    >
      <div>
        <FieldLabel htmlFor={`${id}-number`}>Invoice number</FieldLabel>
        <Input id={`${id}-number`} required value={number} onChange={(event) => setNumber(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-on`}>Invoiced on</FieldLabel>
        <Input id={`${id}-on`} type="date" aria-describedby={`${id}-on-hint`} value={on} onChange={(event) => setOn(event.target.value)} />
        <FieldHint id={`${id}-on-hint`}>Leave blank for today.</FieldHint>
      </div>
      {error ? (
        <Alert tone="error" className="sm:col-span-2">
          {error}
        </Alert>
      ) : null}
      <FormButtons pending={pending} onCancel={onCancel} label="Mark invoiced" />
    </form>
  );
}

function PaidForm({
  pending,
  error,
  onCancel,
  onSubmit,
}: {
  pending: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: (body: { paidOn?: string; paymentReference?: string }) => void;
}) {
  const id = useId();
  const [on, setOn] = useState("");
  const [reference, setReference] = useState("");
  return (
    <form
      className="grid gap-4 sm:grid-cols-2"
      onSubmit={(event) => {
        event.preventDefault();
        onSubmit({ paidOn: on || undefined, paymentReference: reference.trim() || undefined });
      }}
    >
      <div>
        <FieldLabel htmlFor={`${id}-on`}>Paid on</FieldLabel>
        <Input id={`${id}-on`} type="date" aria-describedby={`${id}-on-hint`} value={on} onChange={(event) => setOn(event.target.value)} />
        <FieldHint id={`${id}-on-hint`}>Leave blank for today.</FieldHint>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-ref`}>Payment reference</FieldLabel>
        <Input
          id={`${id}-ref`}
          aria-describedby={`${id}-ref-hint`}
          value={reference}
          onChange={(event) => setReference(event.target.value)}
        />
        <FieldHint id={`${id}-ref-hint`}>The bank transfer or cheque number.</FieldHint>
      </div>
      {error ? (
        <Alert tone="error" className="sm:col-span-2">
          {error}
        </Alert>
      ) : null}
      <FormButtons pending={pending} onCancel={onCancel} label="Mark paid" />
    </form>
  );
}

// -- the billing page --------------------------------------------------------------------

function daysLeftText(daysLeft: number, lastUsableOn: string): string {
  if (daysLeft > 1) return `${daysLeft} days left`;
  if (daysLeft === 1) return "1 day left";
  if (daysLeft === 0) return "Ends today";
  return `In grace until ${formatDay(lastUsableOn)}`;
}

/** Platform admin: every college's current package, payments, cost and next reminder. */
export function AdminBilling() {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<CollegeBillingRow[]> => (accessToken ? fetchCampusBilling({ accessToken, signal }) : NEVER),
    [accessToken],
  );
  const { data, error, loading } = useLoad(load);

  if (error?.status === 404) return <NotFoundState />;

  return (
    <div className="flex flex-col gap-6">
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : data && data.length === 0 ? (
        <EmptyState title="No colleges yet" description="Billing appears once a college has been created." />
      ) : data ? (
        <TableScroll>
          <Table>
            <caption className="sr-only">Packages, payments and estimated AI cost per college</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">College</th>
                <th scope="col" className="px-4 py-3">Current package</th>
                <th scope="col" className="px-4 py-3">Interviews</th>
                <th scope="col" className="px-4 py-3">Per student</th>
                <th scope="col" className="px-4 py-3">Payment</th>
                <th scope="col" className="px-4 py-3">Outstanding</th>
                <th scope="col" className="px-4 py-3">Total paid</th>
                <th scope="col" className="px-4 py-3">AI cost in window</th>
                <th scope="col" className="px-4 py-3">Next reminder</th>
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.orgId} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    <Link href={`/admin/campus/${row.orgId}` as Route} className="text-accent underline-offset-2 hover:underline">
                      {row.orgName}
                    </Link>
                    {row.orgStatus === "suspended" ? <span className="block font-normal text-caption text-ink-muted">Suspended</span> : null}
                  </th>
                  {row.current ? (
                    <>
                      <td className="px-4 py-3">
                        {formatDay(row.current.startsOn)} to {formatDay(row.current.endsOn)}
                        <span className="block text-caption text-ink-muted">{daysLeftText(row.current.daysLeft, row.current.lastUsableOn)}</span>
                      </td>
                      <td className="px-4 py-3">
                        {row.current.interviewsUsed} used, {row.current.interviewsRemaining} remaining
                      </td>
                      <td className="px-4 py-3">{perStudentText(row.current.perStudentLimit)}</td>
                      <td className="px-4 py-3">
                        <Badge tone={PACKAGE_STATUS_TONE[row.current.status]}>{PACKAGE_STATUS_LABEL[row.current.status]}</Badge>
                      </td>
                    </>
                  ) : (
                    <td className="px-4 py-3 text-ink-muted" colSpan={4}>
                      {row.fundedByPackages ? "No active package" : "No packages: interview allowance applies"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {row.outstandingInvoices === 0 ? (
                      "None"
                    ) : (
                      <>
                        {formatInr(row.outstandingPaise)}
                        <span className="block text-caption text-ink-muted">
                          {row.outstandingInvoices === 1 ? "1 invoice" : `${row.outstandingInvoices} invoices`}
                        </span>
                      </>
                    )}
                  </td>
                  <td className="px-4 py-3">{formatInr(row.totalPaidPaise)}</td>
                  <td className="px-4 py-3">{row.aiCostUsd === null ? "-" : formatUsd(row.aiCostUsd)}</td>
                  <td className="px-4 py-3">{row.nextReminderOn ? formatDay(row.nextReminderOn) : "None due"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
      <p className="text-caption text-ink-muted">
        Amounts in rupees, as invoiced. AI cost is estimated from recorded model usage inside the current package&apos;s window,
        in US dollars; it excludes hosting and email costs. Reminders go to the college&apos;s admins and placement officers 30 and
        7 days before a package ends, unless a later package has been invoiced.
      </p>
    </div>
  );
}
