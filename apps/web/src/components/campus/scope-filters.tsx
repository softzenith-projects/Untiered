"use client";

import { useCallback, useId } from "react";

import { FieldLabel, Select } from "@/components/ui/field";
import { fetchBatches, fetchDepartments } from "@/lib/api";
import type { BatchView, DepartmentView } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { useLoad } from "./use-load";

export interface Structure {
  departments: DepartmentView[];
  batches: BatchView[];
}

/** The college's departments and batches, as far as the caller's scope shows them. */
export function useStructure() {
  const { orgId, accessToken } = useCampusOrg();
  const load = useCallback(
    async (signal: AbortSignal): Promise<Structure> => {
      const options = { accessToken, signal };
      const [departments, batches] = await Promise.all([fetchDepartments(orgId, options), fetchBatches(orgId, options)]);
      return { departments, batches };
    },
    [orgId, accessToken],
  );
  return useLoad(load);
}

export interface Scope {
  departmentId: string;
  batchId: string;
}

/** Department and batch selects. Picking a department clears a batch that is not in it. */
export function ScopeFilters({
  structure,
  scope,
  onChange,
}: {
  structure: Structure;
  scope: Scope;
  onChange: (next: Scope) => void;
}) {
  const id = useId();
  const batches = scope.departmentId
    ? structure.batches.filter((batch) => batch.departmentId === scope.departmentId)
    : structure.batches;
  return (
    <>
      <div>
        <FieldLabel htmlFor={`${id}-dept`}>Department</FieldLabel>
        <Select
          id={`${id}-dept`}
          value={scope.departmentId}
          onChange={(event) => onChange({ departmentId: event.target.value, batchId: "" })}
        >
          <option value="">All departments</option>
          {structure.departments.map((department) => (
            <option key={department.id} value={department.id}>
              {department.code}
            </option>
          ))}
        </Select>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-batch`}>Batch</FieldLabel>
        <Select id={`${id}-batch`} value={scope.batchId} onChange={(event) => onChange({ ...scope, batchId: event.target.value })}>
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

export function describeScope(structure: Structure | null, scope: Scope): string {
  const department = structure?.departments.find((item) => item.id === scope.departmentId)?.code;
  const batch = structure?.batches.find((item) => item.id === scope.batchId)?.name;
  return [department ?? "All departments", batch ?? "all batches"].join(", ");
}
