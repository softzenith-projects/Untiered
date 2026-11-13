"use client";

import { useCallback, useEffect, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Checkbox, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import {
  changeMemberRole,
  fetchBatches,
  fetchDepartments,
  fetchFacultyScopes,
  fetchMembers,
  removeMember,
  saveFacultyScopes,
} from "@/lib/api";
import type { BatchView, CampusRole, DepartmentView, MemberView, StaffRole } from "@untiered/shared";

import { ROLE_LABEL, useCampusOrg } from "./campus-context";
import { errorText, useLoad } from "./use-load";

const STAFF_ROLES: StaffRole[] = ["college_admin", "tpo", "faculty"];

interface StaffData {
  members: MemberView[];
  departments: DepartmentView[];
  batches: BatchView[];
}

export function StaffPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal): Promise<StaffData> => {
      const options = { accessToken, signal };
      /** Staff are few; follow the cursor so nobody is silently missing from the list. */
      async function staffWithRole(role: CampusRole): Promise<MemberView[]> {
        const all: MemberView[] = [];
        let cursor: string | undefined;
        do {
          const page = await fetchMembers(orgId, options, { role, ...(cursor ? { cursor } : {}) });
          all.push(...page.items);
          cursor = page.nextCursor ?? undefined;
        } while (cursor);
        return all;
      }
      const [groups, departments, batches] = await Promise.all([
        Promise.all(STAFF_ROLES.map(staffWithRole)),
        fetchDepartments(orgId, options),
        fetchBatches(orgId, options),
      ]);
      return { members: groups.flat(), departments, batches };
    },
    [orgId, accessToken],
  );
  const { data, error, loading, reload } = useLoad(load);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [removing, setRemoving] = useState<MemberView | null>(null);
  const [scopesFor, setScopesFor] = useState<MemberView | null>(null);

  async function run(action: () => Promise<unknown>, success: string) {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
      reload();
    } catch (cause) {
      setMessage({ tone: "error", text: errorText(cause) });
      reload();
    }
  }

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  const who = (member: MemberView) => member.name ?? member.email;

  return (
    <div className="flex flex-col gap-6">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {removing ? (
        <Alert tone="warning" aria-label="Confirm remove">
          <p className="font-semibold">Remove {who(removing)} from {data.members.length > 0 ? "the college" : "staff"}?</p>
          <p className="mt-1">They lose staff access. Their account is not deleted.</p>
          <div className="mt-3 flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const target = removing;
                setRemoving(null);
                if (scopesFor?.id === target.id) setScopesFor(null);
                await run(() => removeMember(accessToken, orgId, target.id), `Removed ${who(target)}.`);
              }}
            >
              Yes, remove
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setRemoving(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}

      {data.members.length === 0 ? (
        <EmptyState title="No staff yet" description="Staff appear here once they have joined the college." />
      ) : (
        <TableScroll>
          <Table>
            <caption className="sr-only">College staff</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Role</th>
                <th scope="col" className="px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {data.members.map((member) => (
                <tr key={member.id} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {member.name ?? member.email}
                    {member.name ? <span className="block font-normal text-ink-subtle">{member.email}</span> : null}
                  </th>
                  <td className="px-4 py-3">
                    <Select
                      aria-label={`Role for ${who(member)}`}
                      value={member.role}
                      onChange={(event) =>
                        void run(
                          () => changeMemberRole(accessToken, orgId, member.id, event.target.value as StaffRole),
                          `${who(member)} is now ${ROLE_LABEL[event.target.value as StaffRole]}.`,
                        )
                      }
                    >
                      {STAFF_ROLES.map((role) => (
                        <option key={role} value={role}>
                          {ROLE_LABEL[role]}
                        </option>
                      ))}
                    </Select>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {member.role === "faculty" ? (
                        <Button variant="secondary" size="sm" onClick={() => setScopesFor(member)} aria-label={`Edit scope for ${who(member)}`}>
                          Edit scope
                        </Button>
                      ) : null}
                      <Button variant="quiet" size="sm" onClick={() => setRemoving(member)} aria-label={`Remove ${who(member)}`}>
                        Remove
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}

      {scopesFor ? (
        <ScopeEditor
          key={scopesFor.id}
          member={scopesFor}
          departments={data.departments}
          batches={data.batches}
          onClose={() => setScopesFor(null)}
        />
      ) : null}
    </div>
  );
}

function ScopeEditor({
  member,
  departments,
  batches,
  onClose,
}: {
  member: MemberView;
  departments: DepartmentView[];
  batches: BatchView[];
  onClose: () => void;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const [departmentIds, setDepartmentIds] = useState<string[] | null>(null);
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, setPending] = useState(false);
  const name = member.name ?? member.email;

  useEffect(() => {
    const controller = new AbortController();
    fetchFacultyScopes(orgId, member.id, { accessToken, signal: controller.signal })
      .then((scopes) => {
        if (controller.signal.aborted) return;
        setDepartmentIds(scopes.departmentIds);
        setBatchIds(scopes.batchIds);
      })
      .catch((cause: unknown) => !controller.signal.aborted && setError(errorText(cause, "The scope could not be loaded.")));
    return () => controller.abort();
  }, [orgId, accessToken, member.id]);

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((value) => value !== id) : [...list, id]);

  async function save() {
    setPending(true);
    setError(null);
    setSaved(false);
    try {
      const result = await saveFacultyScopes(accessToken, orgId, member.id, { departmentIds: departmentIds ?? [], batchIds });
      setDepartmentIds(result.departmentIds);
      setBatchIds(result.batchIds);
      setSaved(true);
    } catch (cause) {
      setError(errorText(cause, "The scope could not be saved just now."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-label={`Scope for ${name}`} className="card flex flex-col gap-4 p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-heading text-ink">Scope for {name}</h2>
          <p className="mt-1 max-w-prose text-caption text-ink-muted">
            A faculty member sees only the departments and batches ticked here.
          </p>
        </div>
        <Badge tone="info">Faculty</Badge>
      </div>
      {departmentIds === null && !error ? (
        <Skeleton className="h-24 w-full" />
      ) : departmentIds === null ? null : (
        <div className="grid gap-6 sm:grid-cols-2">
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-caption font-semibold text-ink">Departments</legend>
            {departments.length === 0 ? <p className="text-caption text-ink-muted">No departments yet.</p> : null}
            {departments.map((department) => (
              <label key={department.id} className="flex items-center gap-3 text-caption text-ink">
                <Checkbox
                  checked={departmentIds.includes(department.id)}
                  onChange={() => setDepartmentIds((current) => toggle(current ?? [], department.id))}
                />
                {department.code} - {department.name}
              </label>
            ))}
          </fieldset>
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-1 text-caption font-semibold text-ink">Batches</legend>
            {batches.length === 0 ? <p className="text-caption text-ink-muted">No batches yet.</p> : null}
            {batches.map((batch) => (
              <label key={batch.id} className="flex items-center gap-3 text-caption text-ink">
                <Checkbox checked={batchIds.includes(batch.id)} onChange={() => setBatchIds((current) => toggle(current, batch.id))} />
                {batch.name}
              </label>
            ))}
          </fieldset>
        </div>
      )}
      {error ? <Alert tone="error">{error}</Alert> : null}
      {saved ? <Alert tone="success">Scope saved.</Alert> : null}
      <div className="flex gap-3">
        <Button onClick={() => void save()} loading={pending} disabled={departmentIds === null}>
          Save scope
        </Button>
        <Button variant="secondary" onClick={onClose}>
          Close
        </Button>
      </div>
    </section>
  );
}
