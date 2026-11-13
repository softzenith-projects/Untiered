"use client";

import Link from "next/link";
import { useCallback, useId, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldHint, FieldLabel, Input } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { createAdminOrg, fetchAdminOrgs } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { AdminOrgSummary, CreateOrgRequest } from "@untiered/shared";

import { errorText, useLoad } from "./use-load";

/** "St. Xavier's College" becomes "st-xaviers-college". A suggestion; the admin can edit it. */
export function slugify(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/['’]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function NotFoundState() {
  return <EmptyState title="Page not found" description="There is nothing here for your account." />;
}

const NEVER = new Promise<never>(() => {});

export function AdminColleges() {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<AdminOrgSummary[]> => (accessToken ? fetchAdminOrgs({ accessToken, signal }) : NEVER),
    [accessToken],
  );
  const { data, error, loading, setData } = useLoad(load);

  if (error?.status === 404) return <NotFoundState />;

  return (
    <div className="flex flex-col gap-8">
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {accessToken ? (
        <CreateCollegeForm
          accessToken={accessToken}
          onCreated={(org) => setData((current) => [org, ...(current ?? [])])}
        />
      ) : null}
      <section aria-labelledby="colleges-heading" className="flex flex-col gap-3">
        <h2 id="colleges-heading" className="text-heading text-ink">
          Colleges
        </h2>
        {loading ? (
          <Skeleton className="h-32 w-full" />
        ) : data && data.length === 0 ? (
          <EmptyState title="No colleges yet" description="Create the first one above." />
        ) : data ? (
          <TableScroll>
            <Table>
              <caption className="sr-only">Colleges on Untiered Campus</caption>
              <thead className="bg-surface-sunken text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">College</th>
                  <th scope="col" className="px-4 py-3">Location</th>
                  <th scope="col" className="px-4 py-3">Status</th>
                  <th scope="col" className="px-4 py-3">Staff</th>
                  <th scope="col" className="px-4 py-3">Students</th>
                  <th scope="col" className="px-4 py-3">Interviews</th>
                </tr>
              </thead>
              <tbody>
                {data.map((org) => (
                  <tr key={org.id} className="border-t border-line">
                    <th scope="row" className="px-4 py-3 font-semibold text-ink">
                      <Link href={`/admin/campus/${org.id}`} className="text-accent underline-offset-2 hover:underline">
                        {org.name}
                      </Link>
                      <span className="block font-normal text-ink-subtle">{org.slug}</span>
                    </th>
                    <td className="px-4 py-3">{[org.city, org.state].filter(Boolean).join(", ") || "Not set"}</td>
                    <td className="px-4 py-3">
                      <Badge tone={org.status === "active" ? "positive" : "danger"}>{org.status}</Badge>
                    </td>
                    <td className="px-4 py-3">{org.staffCount}</td>
                    <td className="px-4 py-3">{org.studentCount}</td>
                    <td className="px-4 py-3">
                      {org.interviewsUsed} of {org.interviewAllowance}
                    </td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        ) : null}
      </section>
    </div>
  );
}

function CreateCollegeForm({ accessToken, onCreated }: { accessToken: string; onCreated: (org: AdminOrgSummary) => void }) {
  const id = useId();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [contactPhone, setContactPhone] = useState("");
  const [allowance, setAllowance] = useState("0");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [created, setCreated] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setCreated(null);
    const body: CreateOrgRequest = {
      name: name.trim(),
      slug: slug.trim(),
      interviewAllowance: Number.parseInt(allowance, 10) || 0,
      ...(city.trim() ? { city: city.trim() } : {}),
      ...(state.trim() ? { state: state.trim() } : {}),
      ...(contactName.trim() ? { contactName: contactName.trim() } : {}),
      ...(contactEmail.trim() ? { contactEmail: contactEmail.trim() } : {}),
      ...(contactPhone.trim() ? { contactPhone: contactPhone.trim() } : {}),
    };
    try {
      const org = await createAdminOrg(accessToken, body);
      onCreated({ ...org, staffCount: 0, studentCount: 0 });
      setCreated(org.name);
      setName("");
      setSlug("");
      setSlugEdited(false);
      setCity("");
      setState("");
      setContactName("");
      setContactEmail("");
      setContactPhone("");
      setAllowance("0");
    } catch (cause) {
      setError(errorText(cause, "The college could not be created just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        Create a college
      </h2>
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
          {created ? <Alert tone="success">{created} was created.</Alert> : null}
          <div>
            <Button type="submit" loading={pending}>
              Create college
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}
