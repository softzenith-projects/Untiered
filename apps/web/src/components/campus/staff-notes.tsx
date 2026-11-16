"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { FieldError, FieldHint, FieldLabel, Select, Textarea } from "@/components/ui/field";
import { createStaffComment, deleteStaffComment, fetchStaffComments, updateStaffComment } from "@/lib/api";
import type { StaffComment } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import { formatDate } from "./readiness-model";
import { errorText, useLoad } from "./use-load";

export const NOTE_MAX = 2000;

/** A round a note may be about: one of the student's assigned interviews. */
export interface NoteSession {
  id: string;
  label: string;
}

/**
 * Private staff notes on one student (campus spec §8). Staff only: the API never returns them
 * on a student route, and the student agreed, when joining, that such notes may exist. The
 * author edits their own; the author or a college admin deletes. The API enforces all of it;
 * the buttons shown here are a convenience.
 */
export function StaffNotesPanel({ memberId, sessions = [] }: { memberId: string; sessions?: NoteSession[] }) {
  const { orgId, orgName, accessToken, role } = useCampusOrg();
  const id = useId();
  const load = useCallback(
    (signal: AbortSignal) => fetchStaffComments(orgId, memberId, { accessToken, signal }),
    [orgId, memberId, accessToken],
  );
  const { data, error, loading, setData } = useLoad(load);
  const [draft, setDraft] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const sessionLabel = new Map(sessions.map((session) => [session.id, session.label]));

  async function add(event: FormEvent) {
    event.preventDefault();
    const body = draft.trim();
    if (!body) {
      setFormError("Write a note before saving it.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const created = await createStaffComment(accessToken, orgId, memberId, { body, ...(sessionId ? { sessionId } : {}) });
      setData((current) => [created, ...(current ?? [])]);
      setDraft("");
      setSessionId("");
    } catch (cause) {
      setFormError(errorText(cause, "The note could not be saved. Try again in a moment."));
    } finally {
      setSaving(false);
    }
  }

  function replace(next: StaffComment) {
    setData((current) => (current ?? []).map((note) => (note.id === next.id ? next : note)));
  }

  function remove(noteId: string) {
    setData((current) => (current ?? []).filter((note) => note.id !== noteId));
  }

  const notes = data ?? [];
  return (
    <section aria-labelledby={`${id}-heading`} className="card flex flex-col gap-4 p-6">
      <div>
        <h2 id={`${id}-heading`} className="text-heading text-ink">
          Private staff notes
        </h2>
        <p className="mt-1 text-caption text-ink-muted">
          Only staff at {orgName} can see these notes. The student never sees them.
        </p>
      </div>

      <form onSubmit={add} className="flex flex-col gap-3" noValidate>
        <div>
          <FieldLabel htmlFor={`${id}-body`}>Add a note</FieldLabel>
          <Textarea
            id={`${id}-body`}
            rows={3}
            value={draft}
            maxLength={NOTE_MAX}
            onChange={(event) => setDraft(event.target.value)}
            aria-describedby={`${id}-body-hint${formError ? ` ${id}-body-error` : ""}`}
            aria-invalid={formError ? true : undefined}
            className="w-full"
          />
          <FieldHint id={`${id}-body-hint`}>
            {draft.length}/{NOTE_MAX} characters. Write about progress, not about the person.
          </FieldHint>
          {formError ? <FieldError id={`${id}-body-error`}>{formError}</FieldError> : null}
        </div>
        {sessions.length > 0 ? (
          <div>
            <FieldLabel htmlFor={`${id}-session`}>About a round (optional)</FieldLabel>
            <Select id={`${id}-session`} value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
              <option value="">No particular round</option>
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.label}
                </option>
              ))}
            </Select>
          </div>
        ) : null}
        <Button type="submit" loading={saving} className="self-start">
          {saving ? "Saving..." : "Save note"}
        </Button>
      </form>

      {error ? <Alert tone="error">{error.status === 404 ? "This student could not be found in your college." : error.message}</Alert> : null}
      {loading && !data ? <Skeleton className="h-24 w-full" /> : null}
      {!loading && !error && notes.length === 0 ? <p className="text-caption text-ink-muted">No notes yet.</p> : null}
      {notes.length > 0 ? (
        <ul className="flex flex-col gap-3" aria-label="Notes">
          {notes.map((note) => (
            <NoteItem
              key={note.id}
              note={note}
              roundLabel={note.sessionId ? (sessionLabel.get(note.sessionId) ?? "An assigned round") : null}
              canDelete={note.isMine || role === "college_admin"}
              onSaved={replace}
              onDeleted={remove}
            />
          ))}
        </ul>
      ) : null}
    </section>
  );
}

function NoteItem({
  note,
  roundLabel,
  canDelete,
  onSaved,
  onDeleted,
}: {
  note: StaffComment;
  roundLabel: string | null;
  canDelete: boolean;
  onSaved: (next: StaffComment) => void;
  onDeleted: (id: string) => void;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(note.body);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);

  async function save() {
    const body = text.trim();
    if (!body) {
      setProblem("A note cannot be empty. Delete it instead.");
      return;
    }
    setBusy(true);
    setProblem(null);
    try {
      onSaved(await updateStaffComment(accessToken, orgId, note.id, body));
      setEditing(false);
    } catch (cause) {
      setProblem(errorText(cause, "The note could not be saved. Try again in a moment."));
    } finally {
      setBusy(false);
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setProblem(null);
    try {
      await deleteStaffComment(accessToken, orgId, note.id);
      onDeleted(note.id);
    } catch (cause) {
      setProblem(errorText(cause, "The note could not be deleted. Try again in a moment."));
      setBusy(false);
    }
  }

  return (
    <li className="rounded-lg border border-line p-4">
      <p className="text-caption text-ink-muted">
        {note.isMine ? "You" : (note.authorName ?? "A former staff member")} · {formatDate(note.createdAt)}
        {note.editedAt ? " · edited" : ""}
        {roundLabel ? ` · ${roundLabel}` : ""}
      </p>
      {editing ? (
        <div className="mt-2 flex flex-col gap-2">
          <label htmlFor={`${id}-edit`} className="sr-only">
            Edit note
          </label>
          <Textarea
            id={`${id}-edit`}
            rows={3}
            value={text}
            maxLength={NOTE_MAX}
            onChange={(event) => setText(event.target.value)}
            className="w-full"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={save} loading={busy}>
              Save changes
            </Button>
            <Button
              size="sm"
              variant="quiet"
              onClick={() => {
                setEditing(false);
                setText(note.body);
                setProblem(null);
              }}
            >
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <p className="mt-2 whitespace-pre-wrap text-body text-ink">{note.body}</p>
      )}
      {!editing && (note.isMine || canDelete) ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          {note.isMine ? (
            <Button size="sm" variant="secondary" onClick={() => setEditing(true)}>
              Edit
            </Button>
          ) : null}
          {canDelete && !confirming ? (
            <Button size="sm" variant="quiet" onClick={() => setConfirming(true)}>
              Delete
            </Button>
          ) : null}
          {confirming ? (
            <>
              <span className="text-caption text-ink">Delete this note for every staff member?</span>
              <Button size="sm" variant="destructive" onClick={confirmDelete} loading={busy}>
                Yes, delete
              </Button>
              <Button size="sm" variant="quiet" onClick={() => setConfirming(false)}>
                Keep it
              </Button>
            </>
          ) : null}
        </div>
      ) : null}
      {problem ? (
        <p role="alert" className="field-error mt-2 text-caption">
          {problem}
        </p>
      ) : null}
    </li>
  );
}
