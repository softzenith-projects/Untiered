"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { FieldHint, FieldLabel, Input, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import {
  createBatch,
  createDepartment,
  deleteBatch,
  deleteDepartment,
  fetchBatches,
  fetchDepartments,
  updateBatch,
  updateDepartment,
} from "@/lib/api";
import type { BatchView, DepartmentView } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { errorText, useLoad } from "./use-load";

interface Structure {
  departments: DepartmentView[];
  batches: BatchView[];
}

/** What is being deleted, awaiting a yes. */
type Pending = { kind: "department"; item: DepartmentView } | { kind: "batch"; item: BatchView };

export function StructurePanel() {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal): Promise<Structure> => {
      const options = { accessToken, signal };
      const [departments, batches] = await Promise.all([fetchDepartments(orgId, options), fetchBatches(orgId, options)]);
      return { departments, batches };
    },
    [orgId, accessToken],
  );
  const { data, error, loading, reload } = useLoad(load);
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null);
  const [confirm, setConfirm] = useState<Pending | null>(null);
  const [editing, setEditing] = useState<string | null>(null);

  /** Runs a write, shows the API's message (a 409 says exactly why), and reloads on success. */
  async function run(action: () => Promise<unknown>, success: string): Promise<boolean> {
    setMessage(null);
    try {
      await action();
      setMessage({ tone: "success", text: success });
      reload();
      return true;
    } catch (cause) {
      setMessage({ tone: "error", text: errorText(cause) });
      return false;
    }
  }

  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading && !data) return <Skeleton className="h-48 w-full" />;
  if (!data) return null;

  return (
    <div className="flex flex-col gap-8">
      {message ? <Alert tone={message.tone}>{message.text}</Alert> : null}
      {confirm ? (
        <Alert tone="warning" aria-label="Confirm delete">
          <p className="font-semibold">
            Delete {confirm.kind} {confirm.kind === "department" ? confirm.item.code : confirm.item.name}?
          </p>
          <div className="mt-3 flex gap-3">
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                const target = confirm;
                setConfirm(null);
                await run(
                  () =>
                    target.kind === "department"
                      ? deleteDepartment(accessToken, orgId, target.item.id)
                      : deleteBatch(accessToken, orgId, target.item.id),
                  `Deleted ${target.kind === "department" ? target.item.code : target.item.name}.`,
                );
              }}
            >
              Yes, delete
            </Button>
            <Button variant="secondary" size="sm" onClick={() => setConfirm(null)}>
              Cancel
            </Button>
          </div>
        </Alert>
      ) : null}

      <section aria-labelledby="departments-heading" className="flex flex-col gap-4">
        <h2 id="departments-heading" className="text-heading text-ink">
          Departments
        </h2>
        <AddDepartment onAdd={(code, name) => run(() => createDepartment(accessToken, orgId, { code, name }), `Added ${code}.`)} />
        {data.departments.length === 0 ? (
          <EmptyState title="No departments yet" description="Add one above, such as CSE or ECE." />
        ) : (
          <TableScroll>
            <Table>
              <caption className="sr-only">Departments</caption>
              <thead className="bg-surface-sunken text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Code</th>
                  <th scope="col" className="px-4 py-3">Name</th>
                  <th scope="col" className="px-4 py-3">Batches</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.departments.map((department) => (
                  <tr key={department.id} className="border-t border-line">
                    {editing === department.id ? (
                      <EditDepartmentRow
                        department={department}
                        onCancel={() => setEditing(null)}
                        onSave={async (code, name) => {
                          if (await run(() => updateDepartment(accessToken, orgId, department.id, { code, name }), "Department updated.")) {
                            setEditing(null);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <th scope="row" className="px-4 py-3 font-semibold text-ink">{department.code}</th>
                        <td className="px-4 py-3">{department.name}</td>
                        <td className="px-4 py-3">{department.batchCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setEditing(department.id)} aria-label={`Rename ${department.code}`}>
                              Rename
                            </Button>
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={() => setConfirm({ kind: "department", item: department })}
                              aria-label={`Delete ${department.code}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </section>

      <section aria-labelledby="batches-heading" className="flex flex-col gap-4">
        <h2 id="batches-heading" className="text-heading text-ink">
          Batches
        </h2>
        {data.departments.length > 0 ? (
          <AddBatch
            departments={data.departments}
            onAdd={(body) => run(() => createBatch(accessToken, orgId, body), `Added ${body.name}.`)}
          />
        ) : (
          <p className="text-caption text-ink-muted">Add a department before adding batches.</p>
        )}
        {data.batches.length === 0 ? (
          <EmptyState title="No batches yet" description="A batch is one graduating class of a department, such as CSE 2027." />
        ) : (
          <TableScroll>
            <Table>
              <caption className="sr-only">Batches</caption>
              <thead className="bg-surface-sunken text-ink-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Batch</th>
                  <th scope="col" className="px-4 py-3">Department</th>
                  <th scope="col" className="px-4 py-3">Graduation year</th>
                  <th scope="col" className="px-4 py-3">Students</th>
                  <th scope="col" className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.batches.map((batch) => (
                  <tr key={batch.id} className="border-t border-line">
                    {editing === batch.id ? (
                      <EditBatchRow
                        batch={batch}
                        onCancel={() => setEditing(null)}
                        onSave={async (graduationYear, name) => {
                          if (await run(() => updateBatch(accessToken, orgId, batch.id, { graduationYear, name }), "Batch updated.")) {
                            setEditing(null);
                          }
                        }}
                      />
                    ) : (
                      <>
                        <th scope="row" className="px-4 py-3 font-semibold text-ink">{batch.name}</th>
                        <td className="px-4 py-3">{batch.departmentCode}</td>
                        <td className="px-4 py-3">{batch.graduationYear}</td>
                        <td className="px-4 py-3">{batch.studentCount}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <Button variant="secondary" size="sm" onClick={() => setEditing(batch.id)} aria-label={`Rename ${batch.name}`}>
                              Rename
                            </Button>
                            <Button
                              variant="quiet"
                              size="sm"
                              onClick={() => setConfirm({ kind: "batch", item: batch })}
                              aria-label={`Delete ${batch.name}`}
                            >
                              Delete
                            </Button>
                          </div>
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
        )}
      </section>
    </div>
  );
}

function AddDepartment({ onAdd }: { onAdd: (code: string, name: string) => Promise<boolean> }) {
  const id = useId();
  const [code, setCode] = useState("");
  const [name, setName] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onAdd(code.trim().toUpperCase(), name.trim())) {
      setCode("");
      setName("");
    }
  }

  return (
    <form onSubmit={submit} aria-label="Add a department" className="card grid gap-4 p-5 sm:grid-cols-[10rem_1fr_auto] sm:items-end">
      <div>
        <FieldLabel htmlFor={`${id}-code`}>Department code</FieldLabel>
        <Input
          id={`${id}-code`}
          required
          maxLength={16}
          pattern="[A-Za-z0-9&-]{1,16}"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          aria-describedby={`${id}-hint`}
        />
        <FieldHint id={`${id}-hint`}>Capitals, digits, &amp; or -, up to 16.</FieldHint>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-name`}>Department name</FieldLabel>
        <Input id={`${id}-name`} required value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <Button type="submit">Add department</Button>
    </form>
  );
}

function EditDepartmentRow({
  department,
  onSave,
  onCancel,
}: {
  department: DepartmentView;
  onSave: (code: string, name: string) => void;
  onCancel: () => void;
}) {
  const [code, setCode] = useState(department.code);
  const [name, setName] = useState(department.name);
  return (
    <>
      <td className="px-4 py-3">
        <Input aria-label={`Code for ${department.code}`} value={code} onChange={(event) => setCode(event.target.value)} />
      </td>
      <td className="px-4 py-3">
        <Input aria-label={`Name for ${department.code}`} value={name} onChange={(event) => setName(event.target.value)} />
      </td>
      <td className="px-4 py-3">{department.batchCount}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onSave(code.trim().toUpperCase(), name.trim())}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </td>
    </>
  );
}

function AddBatch({
  departments,
  onAdd,
}: {
  departments: DepartmentView[];
  onAdd: (body: { departmentId: string; graduationYear: number; name: string }) => Promise<boolean>;
}) {
  const id = useId();
  const [departmentId, setDepartmentId] = useState(departments[0]?.id ?? "");
  const [year, setYear] = useState(String(new Date().getFullYear() + 1));
  const [name, setName] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (await onAdd({ departmentId, graduationYear: Number.parseInt(year, 10), name: name.trim() })) setName("");
  }

  return (
    <form onSubmit={submit} aria-label="Add a batch" className="card grid gap-4 p-5 sm:grid-cols-[1fr_8rem_1fr_auto] sm:items-end">
      <div>
        <FieldLabel htmlFor={`${id}-dept`}>Department</FieldLabel>
        <Select id={`${id}-dept`} value={departmentId} onChange={(event) => setDepartmentId(event.target.value)}>
          {departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.code} - {department.name}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-year`}>Graduation year</FieldLabel>
        <Input id={`${id}-year`} required type="number" min={2000} max={2100} value={year} onChange={(event) => setYear(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-name`}>Batch name</FieldLabel>
        <Input id={`${id}-name`} required placeholder="CSE 2027" value={name} onChange={(event) => setName(event.target.value)} />
      </div>
      <Button type="submit">Add batch</Button>
    </form>
  );
}

function EditBatchRow({
  batch,
  onSave,
  onCancel,
}: {
  batch: BatchView;
  onSave: (graduationYear: number, name: string) => void;
  onCancel: () => void;
}) {
  const [name, setName] = useState(batch.name);
  const [year, setYear] = useState(String(batch.graduationYear));
  return (
    <>
      <td className="px-4 py-3">
        <Input aria-label={`Name for ${batch.name}`} value={name} onChange={(event) => setName(event.target.value)} />
      </td>
      <td className="px-4 py-3">{batch.departmentCode}</td>
      <td className="px-4 py-3">
        <Input aria-label={`Graduation year for ${batch.name}`} type="number" value={year} onChange={(event) => setYear(event.target.value)} />
      </td>
      <td className="px-4 py-3">{batch.studentCount}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <Button size="sm" onClick={() => onSave(Number.parseInt(year, 10), name.trim())}>
            Save
          </Button>
          <Button variant="secondary" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </td>
    </>
  );
}
