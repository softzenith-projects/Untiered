"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldHint, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { convertAdminLead, deleteAdminLead, fetchAdminLead, fetchAdminLeads, updateAdminLead } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { CampusPage, ConvertLeadResult, LeadRole, LeadStatus, LeadView } from "@untiered/shared";

import { NotFoundState, slugify } from "./admin-colleges";
import { errorText, useLoad } from "./use-load";

const STATUS_LABEL: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  converted: "Converted",
  not_a_fit: "Not a fit",
};

const STATUS_TONE: Record<LeadStatus, "accent" | "info" | "positive" | "danger"> = {
  new: "accent",
  contacted: "info",
  converted: "positive",
  not_a_fit: "danger",
};

const ROLE_LABEL: Record<LeadRole, string> = {
  tpo: "Placement officer (TPO)",
  faculty: "Faculty",
  college_admin: "College administration",
  other: "Other",
};

const NEVER = new Promise<never>(() => {});

function received(iso: string): string {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * Platform admin: colleges that registered interest on /colleges (contract Module 13). A lead
 * is reviewed here, marked contacted or not a fit, and converted into a college, which also
 * sends its contact a college-admin invite.
 */
export function AdminLeads({ initialLeadId }: { initialLeadId?: string }) {
  const accessToken = useAccessToken();
  const id = useId();
  const [status, setStatus] = useState<LeadStatus | "">("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(initialLeadId ?? null);
  // "Convert" in a row opens that lead with its create-college form already showing. The nonce
  // makes a second click on the same row open the form again after it was cancelled.
  const [convertRequest, setConvertRequest] = useState<{ leadId: string; nonce: number } | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [rowPending, setRowPending] = useState<string | null>(null);
  // Pages after the first, tied to the first page they continue: a new filter starts over.
  const [more, setMore] = useState<{ base: CampusPage<LeadView> | null; items: LeadView[]; cursor: string | null }>({
    base: null,
    items: [],
    cursor: null,
  });
  const [moreError, setMoreError] = useState<string | null>(null);

  const load = useCallback(
    (signal: AbortSignal): Promise<CampusPage<LeadView>> =>
      accessToken
        ? fetchAdminLeads({ ...(status ? { status } : {}), ...(query ? { q: query } : {}) }, { accessToken, signal })
        : NEVER,
    [accessToken, query, status],
  );
  const { data, error, loading, setData } = useLoad(load);
  const current = more.base === data ? more : { base: data, items: [] as LeadView[], cursor: data?.nextCursor ?? null };
  const extra = current.items;
  const cursor = current.cursor;

  const items = [...(data?.items ?? []), ...extra];
  const listed = items.find((lead) => lead.id === selectedId) ?? null;

  // A lead opened by its link (the notification email) that the current filter does not list.
  const [direct, setDirect] = useState<LeadView | null>(null);
  const [directError, setDirectError] = useState<string | null>(null);
  useEffect(() => {
    if (!accessToken || !selectedId || listed || loading) return;
    const controller = new AbortController();
    fetchAdminLead(selectedId, { accessToken, signal: controller.signal })
      .then((lead) => setDirect(lead))
      .catch((cause: unknown) => {
        if (!controller.signal.aborted) setDirectError(errorText(cause, "That lead could not be loaded."));
      });
    return () => controller.abort();
  }, [accessToken, listed, loading, selectedId]);
  const selected = listed ?? (direct?.id === selectedId ? direct : null);

  function rewrite(change: (leads: LeadView[]) => LeadView[]) {
    if (!data) return;
    const nextData = { ...data, items: change(data.items) };
    setData(nextData);
    setMore({ base: nextData, items: change(extra), cursor });
  }

  function replace(next: LeadView) {
    rewrite((leads) => leads.map((lead) => (lead.id === next.id ? next : lead)));
    if (direct?.id === next.id) setDirect(next);
  }

  function remove(leadId: string) {
    rewrite((leads) => leads.filter((lead) => lead.id !== leadId));
    setSelectedId(null);
  }

  async function markContacted(lead: LeadView) {
    if (!accessToken) return;
    setRowPending(lead.id);
    setRowError(null);
    try {
      replace(await updateAdminLead(accessToken, lead.id, { status: "contacted" }));
    } catch (cause) {
      setRowError(errorText(cause, "The lead could not be marked as contacted just now."));
    } finally {
      setRowPending(null);
    }
  }

  async function loadMore() {
    if (!accessToken || !cursor) return;
    setMoreError(null);
    try {
      const page = await fetchAdminLeads(
        { ...(status ? { status } : {}), ...(query ? { q: query } : {}), cursor },
        { accessToken },
      );
      setMore({ base: data, items: [...extra, ...page.items], cursor: page.nextCursor });
    } catch (cause) {
      setMoreError(errorText(cause, "More leads could not be loaded."));
    }
  }

  if (error?.status === 404) return <NotFoundState />;

  return (
    <div className="flex flex-col gap-6">
      <form
        role="search"
        aria-label="Filter leads"
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(search.trim());
        }}
      >
        <div>
          <FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
          <Select id={`${id}-status`} value={status} onChange={(event) => setStatus(event.target.value as LeadStatus | "")}>
            <option value="">All</option>
            {(Object.keys(STATUS_LABEL) as LeadStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <div className="min-w-56 flex-1">
          <FieldLabel htmlFor={`${id}-q`}>Search</FieldLabel>
          <Input
            id={`${id}-q`}
            type="search"
            value={search}
            maxLength={100}
            placeholder="College, contact, email or city"
            onChange={(event) => setSearch(event.target.value)}
          />
        </div>
        <Button type="submit" variant="secondary">
          Search
        </Button>
      </form>

      {error ? <Alert tone="error">{error.message}</Alert> : null}

      <section aria-labelledby={`${id}-list`} className="flex flex-col gap-3">
        <h2 id={`${id}-list`} className="text-heading text-ink">
          Leads
        </h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : items.length === 0 ? (
          <EmptyState title="No leads" description="Colleges that register on /colleges appear here." />
        ) : (
          <TableScroll>
            <Table>
              <caption className="sr-only">College leads, newest first</caption>
              <thead className="bg-surface-sunken text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">College</th>
                  <th scope="col" className="px-4 py-3">Contact</th>
                  <th scope="col" className="px-4 py-3">Students</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Received</th>
                  <th scope="col" className="px-4 py-3">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((lead) => (
                  <tr key={lead.id} className="border-t border-line" aria-current={lead.id === selectedId ? "true" : undefined}>
                    <th scope="row" className="px-4 py-3 font-semibold text-ink">
                      <button
                        type="button"
                        className="text-left text-accent underline-offset-2 hover:underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                        onClick={() => setSelectedId(lead.id)}
                      >
                        {lead.collegeName}
                      </button>
                      <span className="block font-normal text-ink-subtle">
                        {lead.city}, {lead.state}
                      </span>
                    </th>
                    <td className="px-4 py-3">
                      {lead.contactName}
                      <span className="block text-ink-subtle">{ROLE_LABEL[lead.contactRole]}</span>
                    </td>
                    <td className="px-4 py-3">{lead.approxStudents?.toLocaleString("en-IN") ?? <span className="text-ink-subtle">Not given</span>}</td>
                    <td className="px-4 py-3">
                      <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
                    </td>
                    <td className="px-4 py-3">{received(lead.createdAt)}</td>
                    <td className="px-4 py-3">
                      {lead.status === "converted" ? (
                        <span className="text-ink-muted">College created</span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {lead.status === "new" ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="secondary"
                              disabled={rowPending === lead.id}
                              onClick={() => void markContacted(lead)}
                            >
                              Mark contacted <span className="sr-only">{lead.collegeName}</span>
                            </Button>
                          ) : null}
                          <Button
                            type="button"
                            size="sm"
                            onClick={() => {
                              setSelectedId(lead.id);
                              setConvertRequest({ leadId: lead.id, nonce: (convertRequest?.nonce ?? 0) + 1 });
                            }}
                          >
                            Convert <span className="sr-only">{lead.collegeName}</span>
                          </Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
        {cursor && !loading ? (
          <div>
            <Button type="button" variant="secondary" onClick={loadMore}>
              Load more
            </Button>
          </div>
        ) : null}
        {moreError ? <Alert tone="error">{moreError}</Alert> : null}
        {rowError ? <Alert tone="error">{rowError}</Alert> : null}
      </section>

      {selectedId && !selected && directError ? <Alert tone="error">{directError}</Alert> : null}
      {selected && accessToken ? (
        <LeadDetail
          key={`${selected.id}-${convertRequest?.leadId === selected.id ? convertRequest.nonce : 0}`}
          lead={selected}
          accessToken={accessToken}
          initialConverting={convertRequest?.leadId === selected.id}
          onChanged={replace}
          onDeleted={remove}
        />
      ) : null}
    </div>
  );
}

function LeadDetail({
  lead,
  accessToken,
  initialConverting = false,
  onChanged,
  onDeleted,
}: {
  lead: LeadView;
  accessToken: string;
  initialConverting?: boolean;
  onChanged: (lead: LeadView) => void;
  onDeleted: (leadId: string) => void;
}) {
  const id = useId();
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notes, setNotes] = useState(lead.notes ?? "");
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ tone: "success" | "error"; text: string } | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [converting, setConverting] = useState(initialConverting);
  const [converted, setConverted] = useState<ConvertLeadResult | null>(null);
  const isConverted = lead.status === "converted";

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    try {
      const next = await updateAdminLead(accessToken, lead.id, {
        ...(status !== lead.status && status !== "converted" ? { status } : {}),
        notes,
      });
      onChanged(next);
      setMessage({ tone: "success", text: "Saved." });
    } catch (cause) {
      setMessage({ tone: "error", text: errorText(cause, "The lead could not be saved just now.") });
    } finally {
      setPending(false);
    }
  }

  async function destroy() {
    setPending(true);
    setMessage(null);
    try {
      await deleteAdminLead(accessToken, lead.id);
      onDeleted(lead.id);
    } catch (cause) {
      setMessage({ tone: "error", text: errorText(cause, "The lead could not be deleted just now.") });
      setPending(false);
    }
  }

  const details: [string, string][] = [
    ["College", lead.collegeName],
    ["City", lead.city],
    ["State", lead.state],
    ["Contact", lead.contactName],
    ["Role", ROLE_LABEL[lead.contactRole]],
    ["Email", lead.email],
    ["Phone", lead.phone ?? "Not given"],
    ["Students, roughly", lead.approxStudents?.toLocaleString("en-IN") ?? "Not given"],
    ["Received", received(lead.createdAt)],
    ["Last updated", received(lead.updatedAt)],
  ];

  return (
    <section aria-labelledby={`${id}-h`} className="card flex flex-col gap-6 p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id={`${id}-h`} className="text-title text-ink">
          {lead.collegeName}
        </h2>
        <Badge tone={STATUS_TONE[lead.status]}>{STATUS_LABEL[lead.status]}</Badge>
      </div>

      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {details.map(([term, value]) => (
          <div key={term}>
            <dt className="text-caption font-semibold text-ink-muted">{term}</dt>
            <dd className="text-body text-ink break-words">{value}</dd>
          </div>
        ))}
        <div className="sm:col-span-2">
          <dt className="text-caption font-semibold text-ink-muted">Message</dt>
          <dd className="whitespace-pre-wrap text-body text-ink">{lead.message ?? "None"}</dd>
        </div>
      </dl>

      {isConverted && lead.orgId ? (
        <p className="text-body">
          <Link href={`/admin/campus/${lead.orgId}`} className="font-semibold text-accent underline-offset-2 hover:underline">
            Open the college
          </Link>
        </p>
      ) : null}

      <form onSubmit={save} className="flex flex-col gap-4">
        <div className="sm:max-w-64">
          <FieldLabel htmlFor={`${id}-status`}>Status</FieldLabel>
          <Select
            id={`${id}-status`}
            value={status}
            disabled={isConverted}
            aria-describedby={`${id}-status-hint`}
            onChange={(event) => setStatus(event.target.value as LeadStatus)}
          >
            {(["new", "contacted", "not_a_fit"] as LeadStatus[]).map((value) => (
              <option key={value} value={value}>
                {STATUS_LABEL[value]}
              </option>
            ))}
            {isConverted ? <option value="converted">{STATUS_LABEL.converted}</option> : null}
          </Select>
          <FieldHint id={`${id}-status-hint`}>
            {isConverted ? "Converted leads keep their status." : "A lead marked not a fit is deleted 180 days later."}
          </FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-notes`}>Private notes</FieldLabel>
          <Textarea id={`${id}-notes`} rows={4} maxLength={5000} value={notes} onChange={(event) => setNotes(event.target.value)} />
          <FieldHint>Only platform admins see these.</FieldHint>
        </div>
        {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
        <div className="flex flex-wrap gap-3">
          <Button type="submit" loading={pending}>
            Save changes
          </Button>
          {!isConverted ? (
            <Button type="button" variant="secondary" onClick={() => setConverting(true)} disabled={converting}>
              Convert to college
            </Button>
          ) : null}
          <Button type="button" variant="destructive" onClick={() => setConfirmDelete(true)} disabled={confirmDelete}>
            Delete lead
          </Button>
        </div>
      </form>

      {confirmDelete ? (
        <div role="alertdialog" aria-labelledby={`${id}-del`} className="flex flex-col gap-3 rounded-lg border border-danger/25 bg-danger-wash p-4">
          <p id={`${id}-del`} className="text-body text-ink">
            Delete this lead permanently? Its details cannot be recovered.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" variant="destructive" loading={pending} onClick={destroy}>
              Yes, delete it
            </Button>
            <Button type="button" variant="ghost" onClick={() => setConfirmDelete(false)}>
              Cancel
            </Button>
          </div>
        </div>
      ) : null}

      {converted ? (
        <Alert tone="success">
          {converted.org.name} was created, and a college admin invite is queued for {converted.invite.email}.{" "}
          <Link href={`/admin/campus/${converted.org.id}`} className="font-semibold underline">
            Open the college
          </Link>
        </Alert>
      ) : null}

      {converting && !isConverted ? (
        <ConvertForm
          lead={lead}
          accessToken={accessToken}
          onCancel={() => setConverting(false)}
          onConverted={(result) => {
            setConverted(result);
            setConverting(false);
            setStatus("converted");
            onChanged({ ...lead, status: "converted", orgId: result.org.id });
          }}
        />
      ) : null}
    </section>
  );
}

/** The create-college form, prefilled from the lead. */
function ConvertForm({
  lead,
  accessToken,
  onCancel,
  onConverted,
}: {
  lead: LeadView;
  accessToken: string;
  onCancel: () => void;
  onConverted: (result: ConvertLeadResult) => void;
}) {
  const id = useId();
  const [name, setName] = useState(lead.collegeName);
  const [slug, setSlug] = useState(slugify(lead.collegeName));
  const [slugEdited, setSlugEdited] = useState(false);
  const [city, setCity] = useState(lead.city);
  const [state, setState] = useState(lead.state);
  const [allowance, setAllowance] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const result = await convertAdminLead(accessToken, lead.id, {
        name: name.trim(),
        slug: slug.trim(),
        city: city.trim(),
        state: state.trim(),
        interviewAllowance: Number.parseInt(allowance, 10) || 0,
      });
      onConverted(result);
    } catch (cause) {
      setError(errorText(cause, "The college could not be created just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="rounded-xl border border-line bg-surface-sunken p-5">
      <h3 id={`${id}-h`} className="text-heading text-ink">
        Create a college from this lead
      </h3>
      <p className="mt-1 text-caption text-ink-muted">
        This creates the college and emails {lead.email} an invite to be its college admin.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${id}-name`}>College name</FieldLabel>
          <Input
            id={`${id}-name`}
            required
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              if (!slugEdited) setSlug(slugify(event.target.value));
            }}
          />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-slug`}>Slug</FieldLabel>
          <Input
            id={`${id}-slug`}
            required
            value={slug}
            aria-describedby={`${id}-slug-hint`}
            onChange={(event) => {
              setSlug(event.target.value);
              setSlugEdited(true);
            }}
          />
          <FieldHint id={`${id}-slug-hint`}>Suggested from the name. Unique across colleges.</FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-city`}>City</FieldLabel>
          <Input id={`${id}-city`} value={city} onChange={(event) => setCity(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-state`}>State</FieldLabel>
          <Input id={`${id}-state`} value={state} onChange={(event) => setState(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-allowance`}>Interview allowance</FieldLabel>
          <Input
            id={`${id}-allowance`}
            type="number"
            min={0}
            value={allowance}
            onChange={(event) => setAllowance(event.target.value)}
          />
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2">
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="submit" loading={pending}>
              Create college and send invite
            </Button>
            <Button type="button" variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
