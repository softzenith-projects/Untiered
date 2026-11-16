"use client";

import Link from "next/link";
import { useCallback, useId, useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles, Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import { Dialog } from "@/components/ui/overlay";
import { Table, TableScroll } from "@/components/ui/table";
import { Tabs } from "@/components/ui/tabs";
import {
  createInvite,
  fetchBatches,
  fetchDepartments,
  fetchInvites,
  fetchMembers,
  removeMember,
  resendInvite,
  revokeInvite,
  updateMember,
} from "@/lib/api";
import type { BatchView, DepartmentView, InviteView, MemberView } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { InviteForm } from "./invite-form";
import { INVITE_STATUSES, InviteList, inviteErrorText, inviteStatusLabel, replaceInvite } from "./invite-list";
import { errorText, useLoad } from "./use-load";

interface Structure {
  departments: DepartmentView[];
  batches: BatchView[];
}

const TABS = [
  { id: "students", label: "Students" },
  { id: "invites", label: "Invites" },
] as const;

/** Joined students and their invites. Faculty see their own scope, read-only. */
export function StudentsPanel() {
  const { orgId, role, accessToken } = useCampusOrg();
  const canManage = role === "college_admin" || role === "tpo";
  const [tab, setTab] = useState<string>("students");
  const loadStructure = useCallback(
    async (signal: AbortSignal): Promise<Structure> => {
      const options = { accessToken, signal };
      const [departments, batches] = await Promise.all([fetchDepartments(orgId, options), fetchBatches(orgId, options)]);
      return { departments, batches };
    },
    [orgId, accessToken],
  );
  const { data: structure, error } = useLoad(loadStructure);

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (!structure) return <Skeleton className="h-48 w-full" />;

  return (
    <div className="flex flex-col gap-6">
      {canManage ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-prose text-caption text-ink-muted">
            Invite students one at a time, or upload a CSV to invite a whole batch. Nothing is created until they accept.
          </p>
          <Link href={campusHref("/campus/students/import", orgId)} className={buttonStyles({ variant: "primary" })}>
            Import students from CSV
          </Link>
        </div>
      ) : null}
      {canManage ? (
        <Tabs tabs={TABS} active={tab} onChange={setTab} label="Students and invites" idPrefix="students" />
      ) : null}
      {tab === "students" || !canManage ? (
        <div role="tabpanel" id="students-panel-students" aria-labelledby="students-tab-students">
          <JoinedStudents structure={structure} canManage={canManage} />
        </div>
      ) : (
        <div role="tabpanel" id="students-panel-invites" aria-labelledby="students-tab-invites">
          <StudentInvites structure={structure} />
        </div>
      )}
    </div>
  );
}

function StructureFilters({
  structure,
  departmentId,
  batchId,
  onDepartment,
  onBatch,
  showDepartment,
}: {
  structure: Structure;
  departmentId: string;
  batchId: string;
  onDepartment: (value: string) => void;
  onBatch: (value: string) => void;
  showDepartment: boolean;
}) {
  const id = useId();
  const batches = departmentId ? structure.batches.filter((batch) => batch.departmentId === departmentId) : structure.batches;
  return (
    <>
      {showDepartment ? (
        <div>
          <FieldLabel htmlFor={`${id}-dept`}>Department</FieldLabel>
          <Select
            id={`${id}-dept`}
            value={departmentId}
            onChange={(event) => {
              onDepartment(event.target.value);
              onBatch("");
            }}
          >
            <option value="">All departments</option>
            {structure.departments.map((department) => (
              <option key={department.id} value={department.id}>
                {department.code}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      <div>
        <FieldLabel htmlFor={`${id}-batch`}>Batch</FieldLabel>
        <Select id={`${id}-batch`} value={batchId} onChange={(event) => onBatch(event.target.value)}>
          <option value="">All batches</option>
          {batches.map((batch) => (
            <option key={batch.id} value={batch.id}>
              {batch.name}
            </option>
          ))}
        </Select>
      </div>
    </>
  );
}

function JoinedStudents({ structure, canManage }: { structure: Structure; canManage: boolean }) {
  const { orgId, accessToken } = useCampusOrg();
  const searchId = useId();
  const [departmentId, setDepartmentId] = useState("");
  const [batchId, setBatchId] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [editing, setEditing] = useState<MemberView | null>(null);
  const [removing, setRemoving] = useState<MemberView | null>(null);
  const filter = useMemo(
    () => ({ role: "student" as const, ...(departmentId ? { departmentId } : {}), ...(batchId ? { batchId } : {}), ...(q ? { q } : {}) }),
    [departmentId, batchId, q],
  );
  const load = useCallback((signal: AbortSignal) => fetchMembers(orgId, { accessToken, signal }, filter), [orgId, accessToken, filter]);
  const { data, error: loadErrorState, loading, setData, reload } = useLoad(load);
  const rows = data?.items ?? [];
  const cursor = data?.nextCursor ?? null;
  const loadError = loadErrorState?.message ?? null;
  const setRows = (update: (current: MemberView[]) => MemberView[]) =>
    setData((current) => (current ? { ...current, items: update(current.items) } : current));

  async function loadMore() {
    if (!cursor) return;
    try {
      const page = await fetchMembers(orgId, { accessToken }, { ...filter, cursor });
      setData((current) => ({ items: [...(current?.items ?? []), ...page.items], nextCursor: page.nextCursor }));
    } catch (cause) {
      setMessage({ tone: "error", text: errorText(cause) });
    }
  }

  const who = (member: MemberView) => member.name ?? member.email;

  return (
    <div className="flex flex-col gap-5">
      <form
        className="grid gap-4 sm:grid-cols-4"
        role="search"
        aria-label="Filter students"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setQ(search.trim());
        }}
      >
        <StructureFilters
          structure={structure}
          departmentId={departmentId}
          batchId={batchId}
          onDepartment={setDepartmentId}
          onBatch={setBatchId}
          showDepartment
        />
        <div className="sm:col-span-2">
          <FieldLabel htmlFor={searchId}>Search</FieldLabel>
          <div className="flex gap-2">
            <Input id={searchId} type="search" placeholder="Name, email or roll number" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </div>
        </div>
      </form>

      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {removing ? (
        <Alert tone="warning" aria-label="Confirm remove">
          <p className="font-semibold">Remove {who(removing)} from the college?</p>
          <p className="mt-1">They lose access to the college and it stops seeing their work. Their Untiered account is not deleted.</p>
          <div className="mt-3 flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const target = removing;
                setRemoving(null);
                try {
                  await removeMember(accessToken, orgId, target.id);
                  setRows((current) => current.filter((row) => row.id !== target.id));
                  setMessage({ tone: "success", text: `Removed ${who(target)}.` });
                } catch (cause) {
                  setMessage({ tone: "error", text: errorText(cause) });
                }
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

      {loadError ? (
        <Alert tone="error">{loadError}</Alert>
      ) : loading && !data ? (
        <Skeleton className="h-40 w-full" />
      ) : rows.length === 0 ? (
        <EmptyState
          title="No students to show"
          description={q || batchId || departmentId ? "No joined student matches these filters." : "Students appear here once they accept their invite."}
        />
      ) : (
        <TableScroll>
          <Table>
            <caption className="sr-only">Joined students</caption>
            <thead className="bg-surface-sunken text-ink-muted">
              <tr>
                <th scope="col" className="px-4 py-3">Name</th>
                <th scope="col" className="px-4 py-3">Roll number</th>
                <th scope="col" className="px-4 py-3">Batch</th>
                <th scope="col" className="px-4 py-3">Activity</th>
                {canManage ? <th scope="col" className="px-4 py-3">Actions</th> : null}
              </tr>
            </thead>
            <tbody>
              {rows.map((member) => (
                <tr key={member.id} className="border-t border-line align-top">
                  <th scope="row" className="px-4 py-3 font-semibold text-ink">
                    {who(member)}
                    {member.name ? <span className="block font-normal text-ink-subtle">{member.email}</span> : null}
                  </th>
                  <td className="px-4 py-3">{member.rollNumber ?? "Not set"}</td>
                  <td className="px-4 py-3">{member.batchName ?? "No batch"}</td>
                  <td className="px-4 py-3">
                    <Badge tone={member.active ? "positive" : "highlight"}>{member.active ? "Active" : "Quiet"}</Badge>
                  </td>
                  {canManage ? (
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <Button variant="secondary" size="sm" aria-label={`Edit ${who(member)}`} onClick={() => setEditing(member)}>
                          Edit
                        </Button>
                        <Button variant="quiet" size="sm" aria-label={`Remove ${who(member)}`} onClick={() => setRemoving(member)}>
                          Remove
                        </Button>
                      </div>
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </Table>
        </TableScroll>
      )}
      {cursor ? (
        <div>
          <Button variant="secondary" onClick={() => void loadMore()}>
            Load more students
          </Button>
        </div>
      ) : null}

      {editing ? (
        <EditStudent
          key={editing.id}
          member={editing}
          batches={structure.batches}
          onClose={() => setEditing(null)}
          onSaved={(updated) => {
            setRows((current) => current.map((row) => (row.id === updated.id ? updated : row)));
            setMessage({ tone: "success", text: `Saved ${who(updated)}.` });
            setEditing(null);
            reload();
          }}
        />
      ) : null}
    </div>
  );
}

function EditStudent({
  member,
  batches,
  onClose,
  onSaved,
}: {
  member: MemberView;
  batches: BatchView[];
  onClose: () => void;
  onSaved: (updated: MemberView) => void;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [batchId, setBatchId] = useState(member.batchId ?? "");
  const [rollNumber, setRollNumber] = useState(member.rollNumber ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      onSaved(
        await updateMember(accessToken, orgId, member.id, {
          ...(batchId && batchId !== member.batchId ? { batchId } : {}),
          ...(rollNumber.trim() !== (member.rollNumber ?? "") ? { rollNumber: rollNumber.trim() } : {}),
        }),
      );
    } catch (cause) {
      setError(
        cause instanceof Error && "code" in cause && cause.code === "roll_number_taken"
          ? "Another student in this college already has that roll number."
          : errorText(cause, "The student could not be saved just now."),
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open onClose={onClose} title={`Edit ${member.name ?? member.email}`}>
      <form onSubmit={save} className="flex flex-col gap-4">
        <div>
          <FieldLabel htmlFor={`${id}-batch`}>Batch</FieldLabel>
          <Select id={`${id}-batch`} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
            {batches.map((batch) => (
              <option key={batch.id} value={batch.id}>
                {batch.name}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-roll`}>Roll number</FieldLabel>
          <Input id={`${id}-roll`} value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} />
        </div>
        {error ? <Alert tone="error">{error}</Alert> : null}
        <div className="flex gap-3">
          <Button type="submit" loading={pending}>
            Save
          </Button>
          <Button type="button" variant="secondary" onClick={onClose}>
            Cancel
          </Button>
        </div>
      </form>
    </Dialog>
  );
}

function StudentInvites({ structure }: { structure: Structure }) {
  const { orgId, accessToken } = useCampusOrg();
  const searchId = useId();
  const statusId = useId();
  const [status, setStatus] = useState("");
  const [batchId, setBatchId] = useState("");
  const [search, setSearch] = useState("");
  const [q, setQ] = useState("");
  const [showForm, setShowForm] = useState(false);
  const load = useCallback(
    (signal: AbortSignal) =>
      fetchInvites(
        orgId,
        { accessToken, signal },
        { role: "student", ...(status ? { status } : {}), ...(batchId ? { batchId } : {}), ...(q ? { q } : {}) },
      ),
    [orgId, accessToken, status, batchId, q],
  );
  const { data, error, loading, setData, reload } = useLoad(load);
  const [more, setMore] = useState<string | null>(null);

  async function loadMore() {
    if (!data?.nextCursor) return;
    try {
      const page = await fetchInvites(orgId, { accessToken }, { role: "student", cursor: data.nextCursor, ...(status ? { status } : {}), ...(batchId ? { batchId } : {}), ...(q ? { q } : {}) });
      setData({ items: [...data.items, ...page.items], nextCursor: page.nextCursor });
    } catch (cause) {
      setMore(inviteErrorText(cause));
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <Button variant={showForm ? "secondary" : "primary"} aria-expanded={showForm} onClick={() => setShowForm((value) => !value)}>
          {showForm ? "Close the form" : "Invite a student"}
        </Button>
      </div>
      {showForm ? (
        <section aria-label="Invite a student" className="card p-6">
          <InviteForm
            roles={["student"]}
            batches={structure.batches}
            submitLabel="Send student invite"
            onSubmit={(body) => createInvite(accessToken, orgId, body)}
            onCreated={() => reload()}
          />
        </section>
      ) : null}

      <form
        className="grid gap-4 sm:grid-cols-4"
        role="search"
        aria-label="Filter invites"
        onSubmit={(event: FormEvent) => {
          event.preventDefault();
          setQ(search.trim());
        }}
      >
        <div>
          <FieldLabel htmlFor={statusId}>Status</FieldLabel>
          <Select id={statusId} value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="">Any status</option>
            {INVITE_STATUSES.map((value) => (
              <option key={value} value={value}>
                {inviteStatusLabel(value)}
              </option>
            ))}
          </Select>
        </div>
        <StructureFilters structure={structure} departmentId="" batchId={batchId} onDepartment={() => {}} onBatch={setBatchId} showDepartment={false} />
        <div>
          <FieldLabel htmlFor={searchId}>Search</FieldLabel>
          <div className="flex gap-2">
            <Input id={searchId} type="search" placeholder="Name or email" value={search} onChange={(event) => setSearch(event.target.value)} />
            <Button type="submit" variant="secondary">
              Search
            </Button>
          </div>
        </div>
      </form>

      {more ? <Alert tone="error">{more}</Alert> : null}
      {error ? (
        <Alert tone="error">{error.message}</Alert>
      ) : loading && !data ? (
        <Skeleton className="h-40 w-full" />
      ) : !data || data.items.length === 0 ? (
        <EmptyState title="No invites to show" description="Invite a student above, or import a CSV to invite a whole batch." />
      ) : (
        <>
          <InviteList
            showBatch
            caption="Student invites"
            invites={data.items}
            onResend={(invite: InviteView) => resendInvite(accessToken, orgId, invite.id)}
            onRevoke={(invite: InviteView) => revokeInvite(accessToken, orgId, invite.id)}
            onChanged={(updated) => setData({ items: replaceInvite(data.items, updated), nextCursor: data.nextCursor })}
          />
          {data.nextCursor ? (
            <div>
              <Button variant="secondary" onClick={() => void loadMore()}>
                Load more invites
              </Button>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
