"use client";

import { useCallback, useId, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Checkbox, FieldHint, FieldLabel, Input, Select, Textarea } from "@/components/ui/field";
import {
  createProgrammeTemplate,
  deleteProgrammeTemplate,
  fetchAdminProgrammeTemplates,
  updateProgrammeTemplate,
} from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type {
  AssignableRoundType,
  AssignmentKind,
  CampusTopic,
  ProgrammeModule,
  ProgrammeTemplate,
  ProgrammeTemplateInput,
  ReadinessComponent,
} from "@untiered/shared";

import { NotFoundState } from "./admin-colleges";
import { COMPONENT_LABEL, COMPONENTS, defaultComponent, ROUND_LABEL, ROUND_TYPES, TOPIC_LABEL, TOPICS } from "./assignment-model";
import { moduleWhat } from "./programme-model";
import { errorText, useLoad } from "./use-load";

const NEVER = new Promise<never>(() => {});
const MAX_WEEKS = 12;

/** One module as the editor holds it: the assignment form's fields, minus dates and targets. */
export interface ModuleDraft {
  key: string;
  week: number;
  kind: AssignmentKind;
  title: string;
  instructions: string;
  roundType: AssignableRoundType;
  durationMinutes: 30 | 45 | 60;
  companyName: string;
  roleTitle: string;
  candidateStage: "student" | "recent_graduate";
  language: "english" | "hindi_english";
  focusTopic: string;
  /** One scenario id per line, such as `dsa:two-sum`. */
  scenarioIds: string;
  attemptLimit: string;
  interviewCap: string;
  allowLate: boolean;
  component: ReadinessComponent;
  componentTouched: boolean;
  topic: CampusTopic | "";
}

let nextKey = 0;
const newKey = () => `m${(nextKey += 1)}`;

export function emptyModule(week: number): ModuleDraft {
  return {
    key: newKey(),
    week,
    kind: "interview",
    title: "",
    instructions: "",
    roundType: "technical_fundamentals",
    durationMinutes: 30,
    companyName: "",
    roleTitle: "",
    candidateStage: "student",
    language: "english",
    focusTopic: "",
    scenarioIds: "",
    attemptLimit: "1",
    interviewCap: "",
    allowLate: false,
    component: defaultComponent("interview", "technical_fundamentals"),
    componentTouched: false,
    topic: "",
  };
}

export function draftFromModule(module: ProgrammeModule): ModuleDraft {
  const a = module.assignment;
  return {
    ...emptyModule(module.week),
    kind: a.kind,
    title: a.title,
    instructions: a.instructions ?? "",
    roundType: a.roundType ?? "technical_fundamentals",
    durationMinutes: a.durationMinutes ?? 30,
    companyName: a.companyName ?? "",
    roleTitle: a.roleTitle ?? "",
    candidateStage: a.candidateStage ?? "student",
    language: a.language ?? "english",
    focusTopic: a.focusTopic ?? "",
    scenarioIds: (a.scenarioIds ?? []).join("\n"),
    attemptLimit: String(a.attemptLimit ?? 1),
    interviewCap: a.interviewCap ? String(a.interviewCap) : "",
    allowLate: a.allowLate,
    component: a.component ?? defaultComponent(a.kind, a.roundType),
    componentTouched: true,
    topic: a.topic ?? "",
  };
}

const scenarioList = (text: string) =>
  text
    .split(/[\n,]/)
    .map((s) => s.trim())
    .filter(Boolean);

export function moduleFromDraft(draft: ModuleDraft): ProgrammeModule {
  const base = {
    kind: draft.kind,
    title: draft.title.trim(),
    instructions: draft.instructions.trim() || null,
    allowLate: draft.allowLate,
    component: draft.component,
    topic: draft.topic || null,
  };
  if (draft.kind === "arena_scenarios") {
    return { week: draft.week, assignment: { ...base, scenarioIds: scenarioList(draft.scenarioIds), attemptLimit: 1 } };
  }
  const custom = draft.roundType === "custom_topic";
  return {
    week: draft.week,
    assignment: {
      ...base,
      roundType: draft.roundType,
      durationMinutes: custom ? 30 : draft.durationMinutes,
      companyName: custom ? null : draft.companyName.trim() || null,
      roleTitle: custom ? null : draft.roleTitle.trim() || null,
      candidateStage: draft.candidateStage,
      language: draft.language,
      focusTopic: custom ? draft.focusTopic.trim() : null,
      attemptLimit: Number(draft.attemptLimit),
      interviewCap: draft.interviewCap.trim() ? Number(draft.interviewCap) : null,
    },
  };
}

/** What the editor says is wrong before it asks the server, which checks everything again. */
export function validateTemplate(title: string, weeks: number, modules: ModuleDraft[]): string[] {
  const errors: string[] = [];
  if (!title.trim() || title.trim().length > 140) errors.push("Give the programme a title of up to 140 characters.");
  if (!Number.isInteger(weeks) || weeks < 1 || weeks > MAX_WEEKS) errors.push(`Choose 1 to ${MAX_WEEKS} weeks.`);
  if (modules.length === 0) errors.push("Add at least one module.");
  modules.forEach((m, index) => {
    const label = `Module ${index + 1} (week ${m.week})`;
    if (m.week > weeks) errors.push(`${label}: week ${m.week} is after the last week.`);
    if (!m.title.trim()) errors.push(`${label}: give it a title.`);
    if (m.kind === "interview") {
      if (m.roundType === "custom_topic" && !m.focusTopic.trim()) errors.push(`${label}: a topic round needs a focus topic.`);
      const attempts = Number(m.attemptLimit);
      if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) errors.push(`${label}: attempts must be 1 to 10.`);
    } else {
      const count = scenarioList(m.scenarioIds).length;
      if (count < 1 || count > 20) errors.push(`${label}: list 1 to 20 scenario ids.`);
    }
  });
  return errors;
}

/** Platform admin: the programme template catalogue and its editor. */
export function AdminProgrammes() {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<ProgrammeTemplate[]> => (accessToken ? fetchAdminProgrammeTemplates({ accessToken, signal }) : NEVER),
    [accessToken],
  );
  const { data, error, loading, setData } = useLoad(load);
  const [editing, setEditing] = useState<ProgrammeTemplate | "new" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  if (error?.status === 404) return <NotFoundState />;

  async function remove(id: string) {
    if (!accessToken) return;
    setDeleteError(null);
    try {
      await deleteProgrammeTemplate(accessToken, id);
      setData((current) => (current ?? []).filter((t) => t.id !== id));
      setConfirmDelete(null);
    } catch (cause) {
      setDeleteError(errorText(cause));
    }
  }

  return (
    <div className="flex flex-col gap-8">
      {error ? <Alert tone="error">{error.message}</Alert> : null}
      {editing && accessToken ? (
        <TemplateEditor
          accessToken={accessToken}
          initial={editing === "new" ? undefined : editing}
          onCancel={() => setEditing(null)}
          onSaved={(saved) => {
            setData((current) => {
              const rest = (current ?? []).filter((t) => t.id !== saved.id);
              return [saved, ...rest];
            });
            setEditing(null);
          }}
        />
      ) : (
        <Button type="button" className="self-start" onClick={() => setEditing("new")} disabled={!accessToken}>
          New template
        </Button>
      )}
      <section aria-labelledby="templates-heading" className="flex flex-col gap-3">
        <h2 id="templates-heading" className="text-heading text-ink">
          Templates
        </h2>
        {deleteError ? <Alert tone="error">{deleteError}</Alert> : null}
        {loading && !data ? <Skeleton className="h-32 w-full" /> : null}
        {data && data.length === 0 ? <EmptyState title="No templates yet" description="Create the first one above." /> : null}
        {data && data.length > 0 ? (
          <ul className="grid gap-4 md:grid-cols-2">
            {data.map((template) => (
              <li key={template.id}>
                <article className="card flex h-full flex-col gap-3 p-5">
                  <h3 className="text-body font-semibold text-ink">{template.title}</h3>
                  {template.description ? <p className="text-caption text-ink-muted">{template.description}</p> : null}
                  <p className="text-caption text-ink-muted">
                    {template.weeks} {template.weeks === 1 ? "week" : "weeks"} · {template.modules.length}{" "}
                    {template.modules.length === 1 ? "module" : "modules"}
                  </p>
                  <ol className="flex flex-col gap-1 text-caption text-ink">
                    {template.modules.map((module, index) => (
                      <li key={index}>
                        Week {module.week}: {module.assignment.title} <span className="text-ink-muted">({moduleWhat(module)})</span>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-auto flex flex-wrap items-center gap-2">
                    <Button type="button" size="sm" variant="secondary" onClick={() => setEditing(template)}>
                      Edit<span className="sr-only"> {template.title}</span>
                    </Button>
                    {confirmDelete === template.id ? (
                      <>
                        <span className="text-caption text-ink">Programmes already started keep running.</span>
                        <Button type="button" size="sm" variant="destructive" onClick={() => remove(template.id)}>
                          Yes, delete
                        </Button>
                        <Button type="button" size="sm" variant="quiet" onClick={() => setConfirmDelete(null)}>
                          Keep it
                        </Button>
                      </>
                    ) : (
                      <Button type="button" size="sm" variant="quiet" onClick={() => setConfirmDelete(template.id)}>
                        Delete<span className="sr-only"> {template.title}</span>
                      </Button>
                    )}
                  </div>
                </article>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}

export function TemplateEditor({
  accessToken,
  initial,
  onSaved,
  onCancel,
}: {
  accessToken: string;
  initial?: ProgrammeTemplate;
  onSaved: (template: ProgrammeTemplate) => void;
  onCancel: () => void;
}) {
  const id = useId();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [weeks, setWeeks] = useState(initial?.weeks ?? 6);
  const [modules, setModules] = useState<ModuleDraft[]>(() => (initial ? initial.modules.map(draftFromModule) : [emptyModule(1)]));
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  function patchModule(key: string, change: Partial<ModuleDraft>) {
    setModules((current) =>
      current.map((m) => {
        if (m.key !== key) return m;
        const next = { ...m, ...change };
        if ("component" in change) next.componentTouched = true;
        else if (!next.componentTouched) next.component = defaultComponent(next.kind, next.roundType);
        if (next.kind === "interview" && next.roundType === "custom_topic") next.durationMinutes = 30;
        return next;
      }),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    const found = validateTemplate(title, weeks, modules);
    setErrors(found);
    setApiError(null);
    if (found.length > 0) return;
    const body: ProgrammeTemplateInput = {
      title: title.trim(),
      description: description.trim(),
      weeks,
      modules: modules.map(moduleFromDraft),
    };
    setPending(true);
    try {
      onSaved(initial ? await updateProgrammeTemplate(accessToken, initial.id, body) : await createProgrammeTemplate(accessToken, body));
    } catch (cause) {
      setApiError(errorText(cause));
    } finally {
      setPending(false);
    }
  }

  return (
    <form onSubmit={submit} className="card flex flex-col gap-6 p-6" noValidate aria-labelledby={`${id}-heading`}>
      <h2 id={`${id}-heading`} className="text-heading text-ink">
        {initial ? `Edit ${initial.title}` : "New programme template"}
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${id}-title`}>Programme title</FieldLabel>
          <Input id={`${id}-title`} value={title} maxLength={140} onChange={(e) => setTitle(e.target.value)} />
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-weeks`}>Weeks</FieldLabel>
          <Select id={`${id}-weeks`} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))}>
            {Array.from({ length: MAX_WEEKS }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "week" : "weeks"}
              </option>
            ))}
          </Select>
        </div>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-description`}>Description</FieldLabel>
        <Textarea id={`${id}-description`} rows={2} maxLength={2000} value={description} onChange={(e) => setDescription(e.target.value)} />
      </div>

      <div className="flex flex-col gap-4">
        {modules.map((module, index) => (
          <ModuleEditor
            key={module.key}
            index={index}
            module={module}
            weeks={weeks}
            onChange={(change) => patchModule(module.key, change)}
            onRemove={modules.length > 1 ? () => setModules((current) => current.filter((m) => m.key !== module.key)) : undefined}
          />
        ))}
        <Button
          type="button"
          variant="secondary"
          className="self-start"
          onClick={() => setModules((current) => [...current, emptyModule(Math.min(weeks, (current.at(-1)?.week ?? 0) + 1))])}
        >
          Add a module
        </Button>
      </div>

      {errors.length > 0 ? (
        <Alert tone="error">
          <ul className="list-disc pl-5">
            {errors.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </Alert>
      ) : null}
      {apiError ? <Alert tone="error">{apiError}</Alert> : null}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" loading={pending}>
          {initial ? "Save changes" : "Create template"}
        </Button>
        <Button type="button" variant="quiet" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function ModuleEditor({
  index,
  module,
  weeks,
  onChange,
  onRemove,
}: {
  index: number;
  module: ModuleDraft;
  weeks: number;
  onChange: (change: Partial<ModuleDraft>) => void;
  onRemove?: () => void;
}) {
  const id = useId();
  const interview = module.kind === "interview";
  const custom = interview && module.roundType === "custom_topic";
  return (
    <fieldset className="flex flex-col gap-4 rounded-lg border border-line p-4">
      <legend className="px-1 text-body font-semibold text-ink">Module {index + 1}</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor={`${id}-week`}>Week</FieldLabel>
          <Select id={`${id}-week`} value={module.week} onChange={(e) => onChange({ week: Number(e.target.value) })}>
            {Array.from({ length: weeks }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                Week {n}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-kind`}>Kind</FieldLabel>
          <Select id={`${id}-kind`} value={module.kind} onChange={(e) => onChange({ kind: e.target.value as AssignmentKind })}>
            <option value="interview">AI interview</option>
            <option value="arena_scenarios">Arena scenario set</option>
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
          <Input id={`${id}-title`} value={module.title} maxLength={140} onChange={(e) => onChange({ title: e.target.value })} />
        </div>
      </div>
      {interview ? (
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <FieldLabel htmlFor={`${id}-round`}>Round type</FieldLabel>
            <Select id={`${id}-round`} value={module.roundType} onChange={(e) => onChange({ roundType: e.target.value as AssignableRoundType })}>
              {ROUND_TYPES.map((value) => (
                <option key={value} value={value}>
                  {ROUND_LABEL[value]}
                </option>
              ))}
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-length`}>Length</FieldLabel>
            <Select
              id={`${id}-length`}
              value={module.durationMinutes}
              disabled={custom}
              onChange={(e) => onChange({ durationMinutes: Number(e.target.value) as 30 | 45 | 60 })}
            >
              <option value={30}>30 minutes</option>
              <option value={45}>45 minutes</option>
              <option value={60}>60 minutes</option>
            </Select>
          </div>
          {custom ? (
            <div>
              <FieldLabel htmlFor={`${id}-focus`}>Focus topic</FieldLabel>
              <Input id={`${id}-focus`} value={module.focusTopic} maxLength={120} onChange={(e) => onChange({ focusTopic: e.target.value })} />
            </div>
          ) : (
            <>
              <div>
                <FieldLabel htmlFor={`${id}-company`}>Company (optional)</FieldLabel>
                <Input id={`${id}-company`} value={module.companyName} onChange={(e) => onChange({ companyName: e.target.value })} />
              </div>
              <div>
                <FieldLabel htmlFor={`${id}-role`}>Role (optional)</FieldLabel>
                <Input id={`${id}-role`} value={module.roleTitle} onChange={(e) => onChange({ roleTitle: e.target.value })} />
              </div>
            </>
          )}
          <div>
            <FieldLabel htmlFor={`${id}-stage`}>Candidate stage</FieldLabel>
            <Select id={`${id}-stage`} value={module.candidateStage} onChange={(e) => onChange({ candidateStage: e.target.value as ModuleDraft["candidateStage"] })}>
              <option value="student">Student</option>
              <option value="recent_graduate">Recent graduate</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-language`}>Language</FieldLabel>
            <Select id={`${id}-language`} value={module.language} onChange={(e) => onChange({ language: e.target.value as ModuleDraft["language"] })}>
              <option value="english">English</option>
              <option value="hindi_english">Hindi and English</option>
            </Select>
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-attempts`}>Attempts per student</FieldLabel>
            <Input id={`${id}-attempts`} type="number" min={1} max={10} value={module.attemptLimit} onChange={(e) => onChange({ attemptLimit: e.target.value })} />
          </div>
          <div>
            <FieldLabel htmlFor={`${id}-cap`}>Interview cap (optional)</FieldLabel>
            <Input id={`${id}-cap`} type="number" min={1} value={module.interviewCap} onChange={(e) => onChange({ interviewCap: e.target.value })} />
          </div>
        </div>
      ) : (
        <div>
          <FieldLabel htmlFor={`${id}-scenarios`}>Scenario ids</FieldLabel>
          <Textarea
            id={`${id}-scenarios`}
            rows={3}
            value={module.scenarioIds}
            aria-describedby={`${id}-scenarios-hint`}
            onChange={(e) => onChange({ scenarioIds: e.target.value })}
          />
          <FieldHint id={`${id}-scenarios-hint`}>One live Arena scenario id per line, such as dsa:two-sum. The server checks each one.</FieldHint>
        </div>
      )}
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <FieldLabel htmlFor={`${id}-component`}>Readiness component</FieldLabel>
          <Select id={`${id}-component`} value={module.component} onChange={(e) => onChange({ component: e.target.value as ReadinessComponent })}>
            {COMPONENTS.map((value) => (
              <option key={value} value={value}>
                {COMPONENT_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-topic`}>Topic (optional)</FieldLabel>
          <Select id={`${id}-topic`} value={module.topic} onChange={(e) => onChange({ topic: e.target.value as ModuleDraft["topic"] })}>
            <option value="">No topic</option>
            {TOPICS.map((value) => (
              <option key={value} value={value}>
                {TOPIC_LABEL[value]}
              </option>
            ))}
          </Select>
        </div>
        <label className="flex items-center gap-3 self-end rounded-lg border border-line p-3 text-body">
          <Checkbox checked={module.allowLate} onChange={(e) => onChange({ allowLate: e.target.checked })} />
          Allow late attempts
        </label>
      </div>
      <div>
        <FieldLabel htmlFor={`${id}-instructions`}>Instructions for students (optional)</FieldLabel>
        <Textarea id={`${id}-instructions`} rows={2} maxLength={2000} value={module.instructions} onChange={(e) => onChange({ instructions: e.target.value })} />
      </div>
      {onRemove ? (
        <Button type="button" size="sm" variant="quiet" className="self-start" onClick={onRemove}>
          Remove module {index + 1}
        </Button>
      ) : null}
    </fieldset>
  );
}
