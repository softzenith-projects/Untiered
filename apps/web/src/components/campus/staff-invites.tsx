"use client";

import { useCallback, useId } from "react";

import { Alert, Skeleton } from "@/components/ui/feedback";
import {
  createAdminInvite,
  createInvite,
  fetchAdminInvites,
  fetchInvites,
  resendInvite,
  revokeInvite,
} from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { CampusPage, InviteView, StaffRole } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { InviteForm } from "./invite-form";
import { InviteList, replaceInvite } from "./invite-list";
import { useLoad } from "./use-load";

const STAFF_ROLES: StaffRole[] = ["college_admin", "tpo", "faculty"];
const NEVER = new Promise<never>(() => {});

/** Staff lists are short; follow the cursor so no invite is silently missing. */
async function followCursor(page: (cursor?: string) => Promise<CampusPage<InviteView>>): Promise<InviteView[]> {
  const all: InviteView[] = [];
  let cursor: string | undefined;
  do {
    const result = await page(cursor);
    all.push(...result.items);
    cursor = result.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

function InviteSection({
  title,
  hint,
  form,
  invites,
  loading,
  error,
  list,
}: {
  title: string;
  hint: string;
  form: React.ReactNode;
  invites: InviteView[] | null;
  loading: boolean;
  error: string | null;
  list: React.ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={`${id}-h`} className="card flex flex-col gap-5 p-6">
      <div>
        <h2 id={`${id}-h`} className="text-heading text-ink">
          {title}
        </h2>
        <p className="mt-1 max-w-prose text-caption text-ink-muted">{hint}</p>
      </div>
      {form}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {loading && !invites ? <Skeleton className="h-24 w-full" /> : null}
      {invites && invites.length === 0 ? <p className="text-caption text-ink-muted">No staff invites yet.</p> : null}
      {invites && invites.length > 0 ? list : null}
    </section>
  );
}

/** "Invite staff" for a college admin: three roles, then the list of staff invites. */
export function CollegeStaffInvites() {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback(
    async (): Promise<InviteView[]> => {
      const groups = await Promise.all(
        STAFF_ROLES.map((role) => followCursor((cursor) => fetchInvites(orgId, { accessToken }, { role, ...(cursor ? { cursor } : {}) }))),
      );
      return groups.flat();
    },
    [orgId, accessToken],
  );
  const { data, error, loading, setData } = useLoad(load);

  return (
    <InviteSection
      title="Invite staff"
      hint="They get an email with a link. When they open it and sign in, they join this college with the role you chose."
      form={
        <InviteForm
          roles={STAFF_ROLES}
          submitLabel="Send staff invite"
          onSubmit={(body) => createInvite(accessToken, orgId, body)}
          onCreated={(invite) => setData((current) => [invite, ...(current ?? [])])}
        />
      }
      invites={data}
      loading={loading}
      error={error?.message ?? null}
      list={
        data ? (
          <InviteList
            caption="Staff invites"
            invites={data}
            onResend={(invite) => resendInvite(accessToken, orgId, invite.id)}
            onRevoke={(invite) => revokeInvite(accessToken, orgId, invite.id)}
            onChanged={(updated) => setData((current) => replaceInvite(current ?? [], updated))}
          />
        ) : null
      }
    />
  );
}

/** The platform admin's "Invite the first college admin or TPO". */
export function AdminStaffInvites({ orgId }: { orgId: string }) {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<InviteView[]> =>
      accessToken ? followCursor((cursor) => fetchAdminInvites(orgId, { accessToken, signal }, cursor)) : NEVER,
    [accessToken, orgId],
  );
  const { data, error, loading, setData } = useLoad(load);

  if (!accessToken) return <Skeleton className="h-24 w-full" />;

  return (
    <InviteSection
      title="Invite the first college admin or TPO"
      hint="The college has nobody who can sign in until one of these invites is accepted. After that, the college admin invites everyone else."
      form={
        <InviteForm
          roles={["college_admin", "tpo"]}
          submitLabel="Send invite"
          onSubmit={(body) =>
            createAdminInvite(accessToken, orgId, { email: body.email, fullName: body.fullName, role: body.role as "college_admin" | "tpo" })
          }
          onCreated={(invite) => {
            setData((current) => [invite, ...(current ?? [])]);
          }}
        />
      }
      invites={data}
      loading={loading}
      error={error?.message ?? null}
      list={
        data ? (
          <InviteList
            caption="Staff invites"
            invites={data}
            onResend={(invite) => resendInvite(accessToken, orgId, invite.id)}
            onRevoke={(invite) => revokeInvite(accessToken, orgId, invite.id)}
            onChanged={(updated) => setData((current) => replaceInvite(current ?? [], updated))}
          />
        ) : null
      }
    />
  );
}
