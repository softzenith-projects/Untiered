"use client";

import Link from "next/link";
import { useCallback, useId, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { FieldHint, FieldLabel, Input } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlay";
import { fetchAdminOrg, updateAdminOrg, uploadOrgLogo } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { AdminOrgSummary, OrgView } from "@untiered/shared";

import { NotFoundState } from "./admin-colleges";
import { errorText, useLoad } from "./use-load";

const NEVER = new Promise<never>(() => {});
const MAX_LOGO_BYTES = 512 * 1024;

export function AdminCollegeDetail({ orgId }: { orgId: string }) {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<AdminOrgSummary> => (accessToken ? fetchAdminOrg(orgId, { accessToken, signal }) : NEVER),
    [accessToken, orgId],
  );
  const { data, error, loading, setData } = useLoad(load);

  if (error?.status === 404) return <NotFoundState />;
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading || !data || !accessToken) return <Skeleton className="h-64 w-full" />;

  const merge = (org: OrgView) => setData((current) => (current ? { ...current, ...org } : current));

  return (
    <div className="flex flex-col gap-8">
      <p>
        <Link href="/admin/campus" className="text-caption font-semibold text-accent underline-offset-2 hover:underline">
          All colleges
        </Link>
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <h2 className="text-heading text-ink">{data.name}</h2>
        <Badge tone={data.status === "active" ? "positive" : "danger"}>{data.status}</Badge>
        <span className="text-caption text-ink-muted">
          {data.staffCount} staff · {data.studentCount} students · {data.interviewsUsed} of {data.interviewAllowance} interviews used
        </span>
      </div>
      <ProfileForm org={data} accessToken={accessToken} onSaved={merge} />
      <LogoUpload org={data} accessToken={accessToken} onSaved={merge} />
      <StatusControl org={data} accessToken={accessToken} onSaved={merge} />
    </div>
  );
}

function ProfileForm({ org, accessToken, onSaved }: { org: OrgView; accessToken: string; onSaved: (org: OrgView) => void }) {
  const id = useId();
  const [name, setName] = useState(org.name);
  const [city, setCity] = useState(org.city ?? "");
  const [state, setState] = useState(org.state ?? "");
  const [contactName, setContactName] = useState(org.contactName ?? "");
  const [contactEmail, setContactEmail] = useState(org.contactEmail ?? "");
  const [contactPhone, setContactPhone] = useState(org.contactPhone ?? "");
  const [allowance, setAllowance] = useState(String(org.interviewAllowance));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const updated = await updateAdminOrg(accessToken, org.id, {
        name: name.trim(),
        city: city.trim(),
        state: state.trim(),
        contactName: contactName.trim(),
        contactEmail: contactEmail.trim(),
        contactPhone: contactPhone.trim(),
        interviewAllowance: Number.parseInt(allowance, 10) || 0,
      });
      onSaved(updated);
      setSaved(true);
    } catch (cause) {
      setError(errorText(cause, "The college could not be saved just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        Profile and allowance
      </h2>
      <p className="mt-1 text-caption text-ink-muted">Slug: {org.slug} (fixed once created).</p>
      <form onSubmit={submit} className="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${id}-name`}>College name</FieldLabel>
          <Input id={`${id}-name`} required value={name} onChange={(event) => setName(event.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-allowance`}>Interview allowance</FieldLabel>
          <Input id={`${id}-allowance`} type="number" min={0} value={allowance} onChange={(event) => setAllowance(event.target.value)} />
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
        <div className="flex flex-col gap-3 sm:col-span-2">
          {error ? <Alert tone="error">{error}</Alert> : null}
          {saved ? <Alert tone="success">Saved.</Alert> : null}
          <div>
            <Button type="submit" loading={pending}>
              Save changes
            </Button>
          </div>
        </div>
      </form>
    </section>
  );
}

function LogoUpload({ org, accessToken, onSaved }: { org: OrgView; accessToken: string; onSaved: (org: OrgView) => void }) {
  const id = useId();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function choose(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!["image/png", "image/jpeg", "image/webp"].includes(file.type)) {
      setError("The logo must be a PNG, JPEG or WebP image.");
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setError("The logo must be 512 KB or smaller.");
      return;
    }
    setPending(true);
    try {
      onSaved(await uploadOrgLogo(accessToken, org.id, file));
    } catch (cause) {
      setError(errorText(cause, "The logo could not be uploaded just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        Logo
      </h2>
      <div className="mt-4 flex flex-wrap items-center gap-4">
        {org.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={org.logoUrl} alt={`${org.name} logo`} className="size-16 rounded-lg border border-line object-contain" />
        ) : (
          <p className="text-caption text-ink-muted">No logo yet.</p>
        )}
        <div>
          <FieldLabel htmlFor={`${id}-file`}>Upload a logo</FieldLabel>
          <input
            id={`${id}-file`}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            disabled={pending}
            aria-describedby={`${id}-hint`}
            onChange={(event) => {
              void choose(event.target.files?.[0]);
              event.target.value = "";
            }}
            className="field-control"
          />
          <FieldHint id={`${id}-hint`}>PNG, JPEG or WebP, up to 512 KB.</FieldHint>
        </div>
      </div>
      {error ? <Alert tone="error" className="mt-3">{error}</Alert> : null}
    </section>
  );
}

function StatusControl({ org, accessToken, onSaved }: { org: OrgView; accessToken: string; onSaved: (org: OrgView) => void }) {
  const id = useId();
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const suspending = org.status === "active";

  async function apply() {
    setPending(true);
    setError(null);
    try {
      onSaved(await updateAdminOrg(accessToken, org.id, { status: suspending ? "suspended" : "active" }));
      setConfirming(false);
    } catch (cause) {
      setError(errorText(cause, "The status could not be changed just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-h`} className="card p-6">
      <h2 id={`${id}-h`} className="text-heading text-ink">
        Status
      </h2>
      <p className="mt-1 max-w-prose text-caption text-ink-muted">
        {suspending
          ? "Suspending hides the college from its staff and students until it is reactivated. Nothing is deleted."
          : "This college is suspended. Reactivating restores access for its staff and students."}
      </p>
      <div className="mt-4">
        <Button variant={suspending ? "destructive" : "primary"} onClick={() => setConfirming(true)}>
          {suspending ? "Suspend college" : "Reactivate college"}
        </Button>
      </div>
      <Dialog open={confirming} onClose={() => setConfirming(false)} title={suspending ? `Suspend ${org.name}?` : `Reactivate ${org.name}?`}>
        <div className="flex flex-col gap-4">
          <p className="text-caption text-ink-muted">
            {suspending ? "Its staff and students will lose access straight away." : "Its staff and students will get access back."}
          </p>
          {error ? <Alert tone="error">{error}</Alert> : null}
          <div className="flex gap-3">
            <Button variant={suspending ? "destructive" : "primary"} loading={pending} onClick={() => void apply()}>
              {suspending ? "Yes, suspend" : "Yes, reactivate"}
            </Button>
            <Button variant="secondary" onClick={() => setConfirming(false)}>
              Cancel
            </Button>
          </div>
        </div>
      </Dialog>
    </section>
  );
}
