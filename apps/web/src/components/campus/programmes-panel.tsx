"use client";

import type { Route } from "next";
import Link from "next/link";
import { useCallback, useId, useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Checkbox, FieldHint, FieldLabel, Input, Select } from "@/components/ui/field";
import { Table, TableScroll } from "@/components/ui/table";
import { fetchBatches, fetchProgrammes, fetchProgrammeTemplates, startProgramme } from "@/lib/api";
import type { ProgrammeTemplate, ProgrammeView } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { formatIst, formatPlainDate, todayInIndia, weeklySchedule } from "./programme-model";
import { errorText, useLoad } from "./use-load";

/** The college's programmes, and (for a college admin or TPO) starting one from a template. */
export function ProgrammesPanel() {
  const { orgId, accessToken, role } = useCampusOrg();
  const load = useCallback((signal: AbortSignal) => fetchProgrammes(orgId, { accessToken, signal }), [orgId, accessToken]);
  const { data, error, loading, setData } = useLoad(load);
  const canStart = role === "college_admin" || role === "tpo";

  return (
    <div className="flex flex-col gap-8">
      {canStart ? <StartProgramme onStarted={(view) => setData((current) => [view, ...(current ?? [])])} /> : null}
      <section aria-labelledby="programmes-heading" className="flex flex-col gap-3">
        <h2 id="programmes-heading" className="text-heading text-ink">
          Programmes
        </h2>
        {error ? <Alert tone="error">{error.message}</Alert> : null}
        {loading && !data ? <Skeleton className="h-32 w-full" /> : null}
        {data && data.length === 0 ? (
          <EmptyState
            title="No programmes yet"
            description={
              canStart
                ? "Start one from a template above: its weekly assignments are created and published for the batches you choose."
                : "Your college admin or placement office starts programmes."
            }
          />
        ) : null}
        {data && data.length > 0 ? (
          <TableScroll>
            <Table>
              <caption className="sr-only">Programmes</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Programme</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Starts</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Weeks</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Batches</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Status</th>
                </tr>
              </thead>
              <tbody>
                {data.map((programme) => (
                  <tr key={programme.id} className="border-t border-line">
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <Link href={campusHref(`/campus/programmes/${programme.id}`, orgId) as Route} className="font-semibold text-accent underline">
                        {programme.title}
                      </Link>
                    </th>
                    <td className="px-3 py-2 text-ink">{formatPlainDate(programme.startsOn)}</td>
                    <td className="px-3 py-2 text-ink">{programme.weeks}</td>
                    <td className="px-3 py-2 text-ink-muted">{programme.targetBatches.map((b) => b.name).join(", ")}</td>
                    <td className="px-3 py-2">
                      <ProgrammeStatus view={programme} />
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

export function ProgrammeStatus({ view }: { view: ProgrammeView }) {
  return view.status === "active" ? <Badge tone="positive">Active</Badge> : <Badge tone="navy">Archived</Badge>;
}

function StartProgramme({ onStarted }: { onStarted: (view: ProgrammeView) => void }) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const loadTemplates = useCallback((signal: AbortSignal) => fetchProgrammeTemplates(orgId, { accessToken, signal }), [orgId, accessToken]);
  const loadBatches = useCallback((signal: AbortSignal) => fetchBatches(orgId, { accessToken, signal }), [orgId, accessToken]);
  const templates = useLoad(loadTemplates);
  const batches = useLoad(loadBatches);
  const [templateId, setTemplateId] = useState("");
  const [title, setTitle] = useState("");
  const [startsOn, setStartsOn] = useState("");
  const [batchIds, setBatchIds] = useState<string[]>([]);
  const [reviewing, setReviewing] = useState(false);
  const [problems, setProblems] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [started, setStarted] = useState<ProgrammeView | null>(null);
  const today = todayInIndia();

  const template: ProgrammeTemplate | undefined = (templates.data ?? []).find((t) => t.id === templateId);
  const schedule = useMemo(() => (template && startsOn ? weeklySchedule(startsOn, template.modules) : []), [template, startsOn]);

  function check(): string[] {
    const found: string[] = [];
    if (!template) found.push("Choose a programme template.");
    if (!startsOn) found.push("Choose a start date.");
    else if (startsOn < today) found.push("A programme cannot start in the past.");
    if (batchIds.length === 0) found.push("Choose at least one batch.");
    if (title.trim().length > 140) found.push("Keep the title to 140 characters.");
    return found;
  }

  function review(event: FormEvent) {
    event.preventDefault();
    const found = check();
    setProblems(found);
    setApiError(null);
    if (found.length === 0) setReviewing(true);
  }

  async function confirm() {
    if (!template) return;
    setPending(true);
    setApiError(null);
    try {
      const view = await startProgramme(accessToken, orgId, {
        templateId: template.id,
        ...(title.trim() ? { title: title.trim() } : {}),
        startsOn,
        batchIds,
      });
      onStarted(view);
      setStarted(view);
      setReviewing(false);
      setTemplateId("");
      setTitle("");
      setStartsOn("");
      setBatchIds([]);
    } catch (cause) {
      setApiError(errorText(cause, "The programme could not be started. Nothing was created; try again in a moment."));
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="card flex flex-col gap-5 p-6">
      <div>
        <h2 id={`${id}-heading`} className="text-heading text-ink">
          Start a programme
        </h2>
        <p className="mt-1 text-caption text-ink-muted">
          Each week of the template becomes a published assignment for the batches you choose. Week 1 opens at 9:00 am IST on the start
          date, and each week is due 7 days after it opens.
        </p>
      </div>
      {started ? (
        <Alert tone="success">
          {started.title} has started. {started.assignmentIds.length} assignments were published and students have been told.
        </Alert>
      ) : null}
      {templates.error ? <Alert tone="error">{templates.error.message}</Alert> : null}
      {templates.data && templates.data.length === 0 ? (
        <p className="text-caption text-ink-muted">No programme templates are available yet.</p>
      ) : null}
      <form onSubmit={review} className="flex flex-col gap-4" noValidate>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <FieldLabel htmlFor={`${id}-template`}>Template</FieldLabel>
            <Select
              id={`${id}-template`}
              value={templateId}
              onChange={(e) => {
                setTemplateId(e.target.value);
                setReviewing(false);
              }}
            >
              <option value="">Choose a template</option>
              {(templates.data ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.title} ({t.weeks} {t.weeks === 1 ? "week" : "weeks"})
                </option>
              ))}
            </Select>
            {template?.description ? <FieldHint>{template.description}</FieldHint> : null}
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-title`}>Title (optional)</FieldLabel>
            <Input id={`${id}-title`} value={title} maxLength={140} placeholder={template?.title ?? ""} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-start`}>Start date</FieldLabel>
            <Input
              id={`${id}-start`}
              type="date"
              min={today}
              value={startsOn}
              aria-describedby={`${id}-start-hint`}
              onChange={(e) => {
                setStartsOn(e.target.value);
                setReviewing(false);
              }}
            />
            <FieldHint id={`${id}-start-hint`}>Dates and times are in India time (IST).</FieldHint>
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="text-caption font-semibold text-ink">Batches</legend>
          {batches.error ? <Alert tone="error">{batches.error.message}</Alert> : null}
          {batches.loading && !batches.data ? <Skeleton className="h-16 w-full" /> : null}
          <div className="grid gap-2 sm:grid-cols-2">
            {(batches.data ?? []).map((batch) => (
              <label key={batch.id} className="flex items-center gap-3 rounded-lg border border-line p-3 text-body">
                <Checkbox
                  checked={batchIds.includes(batch.id)}
                  onChange={(e) => {
                    setBatchIds(e.target.checked ? [...batchIds, batch.id] : batchIds.filter((x) => x !== batch.id));
                    setReviewing(false);
                  }}
                />
                <span>
                  {batch.name} <span className="text-caption text-ink-muted">({batch.studentCount} students)</span>
                </span>
              </label>
            ))}
          </div>
        </fieldset>
        {problems.length > 0 ? (
          <Alert tone="error">
            <ul className="list-disc pl-5">
              {problems.map((message) => (
                <li key={message}>{message}</li>
              ))}
            </ul>
          </Alert>
        ) : null}
        {!reviewing ? (
          <Button type="submit" className="self-start">
            Preview the schedule
          </Button>
        ) : null}
      </form>

      {reviewing && template ? (
        <div className="flex flex-col gap-3" aria-live="polite">
          <TableScroll>
            <Table>
              <caption className="px-3 py-2 text-left text-caption font-semibold text-ink">Weekly schedule (IST)</caption>
              <thead className="bg-surface-sunken">
                <tr>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Week</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Assignment</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Opens</th>
                  <th scope="col" className="px-3 py-2 font-semibold text-ink">Due</th>
                </tr>
              </thead>
              <tbody>
                {schedule.map((row, index) => (
                  <tr key={`${row.week}-${index}`} className="border-t border-line">
                    <td className="px-3 py-2 text-ink">{row.week}</td>
                    <th scope="row" className="px-3 py-2 text-left font-normal">
                      <span className="font-semibold text-ink">{row.title}</span>
                      <span className="block text-caption text-ink-muted">{row.what}</span>
                    </th>
                    <td className="px-3 py-2 text-ink">{formatIst(row.opensAt)}</td>
                    <td className="px-3 py-2 text-ink">{formatIst(row.dueAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          </TableScroll>
          <p className="text-caption text-ink-muted">
            Confirming publishes {schedule.length} assignments now and emails the students in the chosen batches about each one.
          </p>
          {apiError ? <Alert tone="error">{apiError}</Alert> : null}
          <div className="flex flex-wrap gap-3">
            <Button type="button" onClick={confirm} loading={pending}>
              Confirm and start
            </Button>
            <Button type="button" variant="secondary" onClick={() => setReviewing(false)} disabled={pending}>
              Change something
            </Button>
          </div>
        </div>
      ) : null}
    </section>
  );
}
