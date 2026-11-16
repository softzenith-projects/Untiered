"use client";

import { useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FieldLabel, Input, Select } from "@/components/ui/field";
import type { BatchView, CampusRole, CreateInviteRequest, InviteView } from "@untiered/shared";

import { ROLE_LABEL } from "./campus-context";
import { inviteErrorText } from "./invite-list";

/**
 * One invite: email, name and role, plus a batch (and optional roll number) when the role is
 * student. Used for a single student, for staff, and for the platform admin's first invite.
 */
export function InviteForm({
  roles,
  batches = [],
  submitLabel,
  onSubmit,
  onCreated,
}: {
  roles: CampusRole[];
  batches?: BatchView[];
  submitLabel: string;
  onSubmit: (body: CreateInviteRequest) => Promise<InviteView>;
  onCreated: (invite: InviteView) => void;
}) {
  const id = useId();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<CampusRole>(roles[0] ?? "student");
  const [batchId, setBatchId] = useState("");
  const [rollNumber, setRollNumber] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const isStudent = role === "student";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setDone(null);
    if (isStudent && !batchId) {
      setError("Choose a batch for a student invite.");
      return;
    }
    setPending(true);
    try {
      const invite = await onSubmit({
        email: email.trim(),
        fullName: fullName.trim(),
        role,
        ...(isStudent ? { batchId, ...(rollNumber.trim() ? { rollNumber: rollNumber.trim() } : {}) } : {}),
      });
      onCreated(invite);
      setDone(`Invited ${invite.fullName} at ${invite.email}.`);
      setFullName("");
      setEmail("");
      setRollNumber("");
    } catch (cause) {
      setError(inviteErrorText(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2" aria-label={submitLabel}>
      <div>
        <FieldLabel htmlFor={`${id}-name`}>Full name</FieldLabel>
        <Input id={`${id}-name`} required maxLength={120} value={fullName} onChange={(event) => setFullName(event.target.value)} />
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-email`}>Email</FieldLabel>
        <Input id={`${id}-email`} type="email" required value={email} onChange={(event) => setEmail(event.target.value)} />
      </div>
      {roles.length > 1 ? (
        <div>
          <FieldLabel htmlFor={`${id}-role`}>Role</FieldLabel>
          <Select id={`${id}-role`} value={role} onChange={(event) => setRole(event.target.value as CampusRole)}>
            {roles.map((value) => (
              <option key={value} value={value}>
                {value === "student" ? "Student" : ROLE_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
      ) : null}
      {isStudent ? (
        <>
          <div>
            <FieldLabel htmlFor={`${id}-batch`}>Batch</FieldLabel>
            <Select id={`${id}-batch`} value={batchId} onChange={(event) => setBatchId(event.target.value)}>
              <option value="">Choose a batch</option>
              {batches.map((batch) => (
                <option key={batch.id} value={batch.id}>
                  {batch.name}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-roll`}>Roll number (optional)</FieldLabel>
            <Input id={`${id}-roll`} value={rollNumber} onChange={(event) => setRollNumber(event.target.value)} />
          </div>
        </>
      ) : null}
      <div className="flex flex-col gap-3 sm:col-span-2">
        {error ? <Alert tone="error">{error}</Alert> : null}
        {done ? <Alert tone="success">{done}</Alert> : null}
        <div>
          <Button type="submit" loading={pending}>
            {submitLabel}
          </Button>
        </div>
      </div>
    </form>
  );
}
