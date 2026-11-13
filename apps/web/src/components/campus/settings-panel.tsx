"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Input } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchAuditLog, fetchCampusOrg, updateCampusOrg } from "@/lib/api";
import type { AuditEntryView, OrgView } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { errorText, useLoad } from "./use-load";

export function SettingsPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback((signal: AbortSignal) => fetchCampusOrg(orgId, { accessToken, signal }), [orgId, accessToken]);
  const { data, error, loading } = useLoad(load);

  return (
    <div className="flex flex-col gap-8">
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-48 w-full" /> : null}
      {data ? <ContactForm org={data} /> : null}
      <AuditLog />
    </div>
  );
}

function ContactForm({ org }: { org: OrgView }) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [contactName, setContactName] = useState(org.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(org.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(org.contactPhone ?? "");
  const [city, setCity] = useState(org.city ?? "");
  const [state, setState] = useState(org.state ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      await updateCampusOrg(accessToken, orgId, {
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        city: city.trim(),
        state: state.trim(),
      });
      setSaved(true);
    } catch (cause) {
      setError(errorText(cause, "Your changes could not be saved just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        College details
      </h2>
      <p className="mt-1 text-caption text-ink-muted">
        {org.name}. The name and interview allowance are managed by Untiered.
      </p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${id}-cname`}>Contact name</FieldLabel>
          <Input id={`${id}-cname`} value={contactName} onChange={(event) => setContactName(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-cemail`}>Contact email</FieldLabel>
          <Input id={`${id}-cemail`} type="email" value={contactEmail} onChange={(event) => setContactEmail(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-cphone`}>Contact phone</FieldLabel>
          <Input id={`${id}-cphone`} type="tel" value={contactPhone} onChange={(event) => setContactPhone(event.target.value)} />
        </div>
        <div />
        <div>
          <FieldLabel htmlFor={`${id}-city`}>City</FieldLabel>
          <Input id={`${id}-city`} value={city} onChange={(event) => setCity(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-state`}>State</FieldLabel>
          <Input id={`${id}-state`} value={state} onChange={(event) => setState(event.target.value)} />
        </div>
        <div className="flex flex-col gap-3 sm:col-span-2">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {saved ? <Alert tone="success">Saved.</Alert> : null}
          <div>
            <Button type="submit" loading={pending}>
              Save details
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

const ACTOR_KIND: Record<AuditEntryView["actorKind"], string> = {
  member: "College member",
  platform_admin: "Untiered admin",
  system: "System",
};

function AuditLog() {
  const { orgId, accessToken } = useCampusOrg();
  const loadFirst = useCallback((signal: AbortSignal) => fetchAuditLog(orgId, { accessToken, signal }), [orgId, accessToken]);
  const first = useLoad(loadFirst);
  const [more, setMore] = useState<{ items: AuditEntryView[]; cursor: string | null } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [moreError, setMoreError] = useState<string | null>(null);

  const items = [...(first.data?.items ?? []), ...(more?.items ?? [])];
  const cursor = more ? more.cursor : (first.data?.nextCursor ?? null);
  const error = first.error?.message ?? moreError;

  async function loadMore() {
    if (!cursor) return;
    setLoadingMore(true);
    setMoreError(null);
    try {
      const page = await fetchAuditLog(orgId, { accessToken }, cursor);
      setMore((current) => ({ items: [...(current?.items ?? []), ...page.items], cursor: page.nextCursor }));
    } catch (cause) {
      setMoreError(errorText(cause, "More entries could not be loaded just now."));
    } finally {
      setLoadingMore(false);
    }
  }
  const loading = first.loading || loadingMore;
  return (
    <section aria-labelledby="audit-heading" className="flex flex-col gap-3">
      <h2 id="audit-heading" className="text-heading text-ink">
        Audit log
      </h2>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {items.length === 0 && !loading && !error ? (
        <EmptyState title="Nothing recorded yet" description="Changes to the college and who viewed what are recorded here." />
      ) : null}
      {items.length > 0 ? (
        <TableScroll>
          <Table>
            <caption className="sr-only">Audit log, newest first</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">When</th>
                <th scope="col" className="px-4 py-3">Who</th>
                <th scope="col" className="px-4 py-3">Action</th>
                <th scope="col" className="px-4 py-3">Target</th>
              </tr>
            </thead>
            <tbody>
              {items.map((entry) => (
                <tr key={entry.id} className="border-t border-line">
                  <td className="px-4 py-3">
                    <time dateTime={entry.occurredAt}>{new Date(entry.occurredAt).toLocaleString()}</time>
                  </td>
                  <td className="px-4 py-3">
                    {entry.actorName ?? "Deleted account"}
                    <span className="block text-ink-subtle">{ACTOR_KIND[entry.actorKind]}</span>
                  </td>
                  <td className="px-4 py-3 font-mono">{entry.action}</td>
                  <td className="px-4 py-3">{entry.targetType ?? "-"}</td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      ) : null}
      {loading ? <Skeleton className="h-10 w-full" /> : null}
      {cursor && !loading ? (
        <div>
          <Button variant="secondary" onClick={() => void loadMore()}>
            Load more
          </Button>
        </div>
      ) : null}
    </section>
  );
}
