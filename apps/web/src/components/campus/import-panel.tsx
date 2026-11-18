"use client";

import Link from "next/link";
import { useId, useMemo, useState, type DragEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { buttonStyles, Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/feedback";
import { FieldHint, FieldLabel } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { ApiRequestError, commitImport, discardImport, uploadImport } from "@/lib/api";
import type { ImportCommitResult, ImportPreview, ImportProblem } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { errorText } from "./use-load";

/** Every problem code in plain English. None says whether an email has an Untiered account. */
export const PROBLEM_LABEL: Record<ImportProblem, string> = {
  missing_name: "Name is missing",
  bad_email: "Email address is not valid",
  duplicate_email_in_file: "This email appears more than once in the file",
  duplicate_roll_in_file: "This roll number appears more than once in the file",
  unknown_department: "Department code is not set up in this college",
  unknown_batch: "Batch name is not set up in this college",
  batch_department_mismatch: "This batch belongs to a different department",
  graduation_year_mismatch: "Graduation year does not match the batch",
  already_member: "Already a student at this college",
  already_invited: "Already has an open invite",
  roll_number_taken: "Roll number already belongs to another student",
};

export const CSV_HEADER = "name,email,roll_number,department,batch,graduation_year";
export const CSV_EXAMPLE = "Asha Verma,asha.verma@college.edu,21CS001,CSE,CSE 2027,2027";
/** A header and one example row. Built in the browser; nothing is fetched. */
export const CSV_TEMPLATE = `${CSV_HEADER}\n${CSV_EXAMPLE}\n`;

const MAX_BYTES = 1024 * 1024;

export function importErrorText(cause: unknown): string {
  if (cause instanceof ApiRequestError) {
    if (cause.code === "csv_invalid") {
      return cause.message || "That file could not be read as a student CSV. Use the template: UTF-8, with the header row first, up to 1 MB and 5,000 students.";
    }
    if (cause.code === "import_not_open") {
      return "This import has already been used or has expired (imports last 24 hours). Upload the file again.";
    }
    if (cause.status === 404) return "This import could not be found. It may have expired. Upload the file again.";
  }
  return errorText(cause);
}

export function ImportPanel() {
  const { orgId, accessToken } = useCampusOrg();
  const fileId = useId();
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportCommitResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"upload" | "commit" | "discard" | null>(null);
  const [dragging, setDragging] = useState(false);
  const templateHref = useMemo(() => `data:text/csv;charset=utf-8,${encodeURIComponent(CSV_TEMPLATE)}`, []);

  async function upload(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    if (file.size > MAX_BYTES) {
      setError("That file is over 1 MB. Split it into smaller files.");
      return;
    }
    setBusy("upload");
    try {
      setPreview(await uploadImport(accessToken, orgId, file));
    } catch (cause) {
      setError(importErrorText(cause));
    } finally {
      setBusy(null);
    }
  }

  async function commit() {
    if (!preview) return;
    setError(null);
    setBusy("commit");
    try {
      setResult(await commitImport(accessToken, orgId, preview.id));
      setPreview(null);
    } catch (cause) {
      setError(importErrorText(cause));
    } finally {
      setBusy(null);
    }
  }

  async function discard() {
    if (!preview) return;
    setError(null);
    setBusy("discard");
    try {
      await discardImport(accessToken, orgId, preview.id);
      setPreview(null);
    } catch (cause) {
      setError(importErrorText(cause));
    } finally {
      setBusy(null);
    }
  }

  function onDrop(event: DragEvent) {
    event.preventDefault();
    setDragging(false);
    void upload(event.dataTransfer.files[0]);
  }

  const studentsHref = campusHref("/campus/students", orgId);

  if (result) {
    return (
      <section aria-label="Import result" className="card flex flex-col gap-4 p-6">
        <Alert tone="success">
          {result.invited} {result.invited === 1 ? "student was" : "students were"} invited.
          {result.skipped > 0 ? ` ${result.skipped} ${result.skipped === 1 ? "row was" : "rows were"} skipped because of problems.` : ""}
        </Alert>
        <p className="max-w-prose text-caption text-ink-muted">
          Each student gets an email with a link. They join when they open it, sign in and agree to what the college can see. Track who has joined on the Invites tab.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href={studentsHref} className={buttonStyles({ variant: "primary" })}>
            Go to students
          </Link>
          <Button variant="secondary" onClick={() => setResult(null)}>
            Import another file
          </Button>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <p>
        <Link href={studentsHref} className="text-caption font-semibold text-accent underline-offset-2 hover:underline">
          Back to students
        </Link>
      </p>
      {error ? <Alert tone="error">{error}</Alert> : null}

      {!preview ? (
        <section aria-labelledby={`${fileId}-h`} className="card flex flex-col gap-4 p-6">
          <h2 id={`${fileId}-h`} className="text-heading text-ink">
            Upload a student list
          </h2>
          <p className="max-w-prose text-caption text-ink-muted">
            A CSV with the columns <code>{CSV_HEADER}</code>. Department is the department code and batch is the batch name, both as set up under
            Departments and batches. You review every row before anyone is invited.
          </p>
          <p className="max-w-prose text-caption text-ink-muted">
            <strong className="font-semibold text-ink">No accounts are created at import.</strong> Each student gets a single-use invite link,
            and a student who already uses Untiered keeps their own account.
          </p>
          <div>
            <a href={templateHref} download="untiered-students-template.csv" className={buttonStyles({ variant: "secondary" })}>
              Download a template
            </a>
          </div>
          <div
            onDragOver={(event) => {
              event.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            className={`rounded-lg border-2 border-dashed p-6 ${dragging ? "border-accent bg-accent-wash" : "border-line"}`}
          >
            <FieldLabel htmlFor={fileId}>Choose a CSV file, or drop one here</FieldLabel>
            <input
              id={fileId}
              type="file"
              accept=".csv,text/csv"
              disabled={busy === "upload"}
              aria-describedby={`${fileId}-hint`}
              onChange={(event) => {
                void upload(event.target.files?.[0]);
                event.target.value = "";
              }}
              className="field-control"
            />
            <FieldHint id={`${fileId}-hint`}>UTF-8, comma or semicolon separated, up to 1 MB and 5,000 students.</FieldHint>
            {busy === "upload" ? <p className="mt-2 text-caption text-ink-muted" role="status">Checking the file...</p> : null}
          </div>
        </section>
      ) : (
        <Preview preview={preview} busy={busy} onCommit={() => void commit()} onDiscard={() => void discard()} />
      )}
    </div>
  );
}

function Preview({
  preview,
  busy,
  onCommit,
  onDiscard,
}: {
  preview: ImportPreview;
  busy: string | null;
  onCommit: () => void;
  onDiscard: () => void;
}) {
  const { summary } = preview;
  return (
    <section aria-label="Import preview" className="flex flex-col gap-5">
      <div className="card flex flex-wrap items-center gap-x-8 gap-y-3 p-6">
        <Stat label="Rows in the file" value={summary.total} />
        <Stat label="Ready to invite" value={summary.valid} tone="positive" />
        <Stat label="With problems" value={summary.withProblems} tone={summary.withProblems > 0 ? "danger" : "info"} />
      </div>
      {summary.withProblems > 0 ? (
        <Alert tone="warning">
          Rows with problems are skipped. Fix them in the file and upload it again to invite those students, or invite them one at a time.
        </Alert>
      ) : null}
      <TableScroll>
        <Table>
          <caption className="sr-only">Rows in the uploaded file</caption>
          <thead className="bg-surface-sunken text-ink-muted">
            <tr>
              <th scope="col" className="px-4 py-3">Row</th>
              <th scope="col" className="px-4 py-3">Name</th>
              <th scope="col" className="px-4 py-3">Email</th>
              <th scope="col" className="px-4 py-3">Roll number</th>
              <th scope="col" className="px-4 py-3">Batch</th>
              <th scope="col" className="px-4 py-3">Check</th>
            </tr>
          </thead>
          <tbody>
            {preview.rows.map((row) => (
              <tr key={row.rowNumber} className="border-t border-line align-top">
                <th scope="row" className="px-4 py-3 text-ink-muted">{row.rowNumber}</th>
                <td className="px-4 py-3 text-ink">{row.fullName ?? "-"}</td>
                <td className="px-4 py-3 text-ink">{row.email ?? "-"}</td>
                <td className="px-4 py-3">{row.rollNumber ?? "-"}</td>
                <td className="px-4 py-3">
                  {row.batchName ?? "-"}
                  {row.departmentCode ? <span className="block text-ink-subtle">{row.departmentCode}</span> : null}
                </td>
                <td className="px-4 py-3">
                  {row.problems.length === 0 ? (
                    <Badge tone="positive">Will be invited</Badge>
                  ) : (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`Problems in row ${row.rowNumber}`}>
                      {row.problems.map((problem) => (
                        <li key={problem}>
                          <Badge tone="danger">{PROBLEM_LABEL[problem] ?? problem}</Badge>
                        </li>
                      ))}
                    </ul>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      </TableScroll>
      <div className="flex flex-wrap items-center gap-3">
        <Button onClick={onCommit} loading={busy === "commit"} disabled={summary.valid === 0 || busy !== null}>
          Invite {summary.valid} {summary.valid === 1 ? "student" : "students"}
        </Button>
        <Button variant="secondary" onClick={onDiscard} disabled={busy !== null}>
          Discard this file
        </Button>
      </div>
    </section>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: "positive" | "danger" | "info" }) {
  const color = tone === "positive" ? "text-positive" : tone === "danger" ? "text-danger" : "text-ink";
  return (
    <div>
      <p className={`text-display ${color}`}>{value}</p>
      <p className="text-caption text-ink-muted">{label}</p>
    </div>
  );
}
