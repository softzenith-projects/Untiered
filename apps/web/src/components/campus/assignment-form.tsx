"use client";

import { useCallback, useEffect, useId, useMemo, useState, type FormEvent } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, Skeleton } from "@/components/ui/feedback";
import { Checkbox, FieldHint, FieldLabel, Input, Radio, Select, Textarea } from "@/components/ui/field";
import { fetchArenaScenarios, fetchBatches, fetchMcqBank, fetchMembers } from "@/lib/api";
import type { AssignmentKind, AssignmentView, CampusScenarioOption, McqBankSummary, MemberView } from "@untiered/shared";

import { useCampusOrg } from "./campus-context";
import {
  COMPONENT_LABEL,
  COMPONENTS,
  defaultComponent,
  emptyForm,
  formFromView,
  MCQ_LIMITS,
  ROUND_LABEL,
  ROUND_TYPES,
  TOPIC_LABEL,
  TOPICS,
  validateForm,
  type AssignmentForm,
} from "./assignment-model";
import { errorText, useLoad } from "./use-load";

const STEPS = ["What", "Who", "Rules"] as const;

/**
 * The three-step builder: what to assign, who gets it, and the deadline and limits.
 * `onSave` receives the validated form; the API's own validation message is shown on failure.
 */
export function AssignmentFormView({
  initial,
  saveLabel = "Save draft",
  onSave,
  onSaveAndPublish,
}: {
  initial?: AssignmentView;
  saveLabel?: string;
  onSave: (form: AssignmentForm) => Promise<void>;
  onSaveAndPublish?: (form: AssignmentForm) => Promise<void>;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [form, setForm] = useState<AssignmentForm>(() => (initial ? formFromView(initial) : emptyForm()));
  const [componentTouched, setComponentTouched] = useState(Boolean(initial));
  const [topicTouched, setTopicTouched] = useState(Boolean(initial));
  const [bank, setBank] = useState<McqBankSummary[] | null>(null);
  const [step, setStep] = useState(0);
  const [errors, setErrors] = useState<string[]>([]);
  const [apiError, setApiError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [studentNames, setStudentNames] = useState<Record<string, string>>(() =>
    Object.fromEntries((initial?.targetStudents ?? []).map((s) => [s.id, s.name ?? s.rollNumber ?? "Student"])),
  );

  const loadScenarios = useCallback((signal: AbortSignal) => fetchArenaScenarios(orgId, { accessToken, signal }), [orgId, accessToken]);
  const loadBatches = useCallback((signal: AbortSignal) => fetchBatches(orgId, { accessToken, signal }), [orgId, accessToken]);
  const scenarios = useLoad(loadScenarios);
  const batches = useLoad(loadBatches);

  const chosenScenarios = useMemo(
    () => (scenarios.data ?? []).filter((s) => form.scenarioIds.includes(s.id)),
    [scenarios.data, form.scenarioIds],
  );

  function patch(change: Partial<AssignmentForm>) {
    setForm((current) => {
      const next = { ...current, ...change };
      // The component follows the round type (or the scenarios) until staff choose one.
      if (!componentTouched && !("component" in change)) {
        const picked =
          next.kind === "arena_scenarios"
            ? (scenarios.data ?? []).filter((s) => next.scenarioIds.includes(s.id))
            : [];
        next.component = defaultComponent(next.kind, next.roundType, picked, next.mcqCourseSlugs);
      }
      // An MCQ test's topic follows its courses while they share one, until staff choose a topic.
      if (!topicTouched && !("topic" in change) && next.kind === "mcq_test" && "mcqCourseSlugs" in change) {
        const topics = new Set(next.mcqCourseSlugs.map((slug) => bank?.find((c) => c.courseSlug === slug)?.topic ?? null));
        const [only] = [...topics];
        next.topic = topics.size === 1 && only ? only : "";
      }
      if (next.kind === "interview" && next.roundType === "custom_topic") next.durationMinutes = 30;
      return next;
    });
  }

  function validateStep(target: number): string[] {
    const all = validateForm(form, bank);
    const byStep: RegExp[][] = [
      [/title|Instructions|focus topic|scenarios|topic round|course|questions|time limit/i],
      [/batch or student/i],
      [/deadline|Attempts|cap/i],
    ];
    return all.filter((message) => byStep[target]?.some((re) => re.test(message)));
  }

  function next() {
    const found = validateStep(step);
    setErrors(found);
    if (found.length === 0) setStep(step + 1);
  }

  async function submit(event: FormEvent, publish: boolean) {
    event.preventDefault();
    setApiError(null);
    const found = validateForm(form, bank);
    setErrors(found);
    if (found.length > 0) return;
    setPending(true);
    try {
      await (publish && onSaveAndPublish ? onSaveAndPublish(form) : onSave(form));
    } catch (cause) {
      setApiError(errorText(cause));
    } finally {
      setPending(false);
    }
  }

  const isInterview = form.kind === "interview";
  const isMcq = form.kind === "mcq_test";
  const custom = isInterview && form.roundType === "custom_topic";

  return (
    <form onSubmit={(event) => submit(event, false)} className="card flex flex-col gap-6 p-6" noValidate>
      <ol aria-label="Steps" className="flex flex-wrap gap-2">
        {STEPS.map((label, index) => (
          <li key={label} aria-current={index === step ? "step" : undefined}>
            <Badge tone={index === step ? "accent" : index < step ? "positive" : "info"}>
              {index + 1}. {label}
            </Badge>
          </li>
        ))}
      </ol>

      {step === 0 ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading text-ink">What are you assigning?</legend>
          <div role="radiogroup" aria-label="Kind of assignment" className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ["interview", "AI interview", "Each student takes a spoken mock interview."],
                ["arena_scenarios", "Arena scenario set", "Students play a chosen set of graded scenarios."],
                ["mcq_test", "MCQ test", "Multiple-choice questions from the course chapters, graded on the server."],
              ] as [AssignmentKind, string, string][]
            ).map(([value, label, hint]) => (
              <label key={value} className="card card-interactive flex cursor-pointer items-start gap-3 p-4">
                <Radio
                  name={`${id}-kind`}
                  checked={form.kind === value}
                  onChange={() => patch({ kind: value })}
                  disabled={Boolean(initial)}
                />
                <span>
                  <span className="block text-body font-semibold text-ink">{label}</span>
                  <span className="block text-caption text-ink-muted">{hint}</span>
                </span>
              </label>
            ))}
          </div>

          <div>
            <FieldLabel htmlFor={`${id}-title`}>Title</FieldLabel>
            <Input id={`${id}-title`} value={form.title} maxLength={140} onChange={(e) => patch({ title: e.target.value })} />
          </div>

          {isInterview ? (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor={`${id}-round`}>Round type</FieldLabel>
                  <Select id={`${id}-round`} value={form.roundType} onChange={(e) => patch({ roundType: e.target.value as AssignmentForm["roundType"] })}>
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
                    value={form.durationMinutes}
                    disabled={custom}
                    aria-describedby={custom ? `${id}-length-hint` : undefined}
                    onChange={(e) => patch({ durationMinutes: Number(e.target.value) as 30 | 45 | 60 })}
                  >
                    <option value={30}>30 minutes</option>
                    <option value={45}>45 minutes</option>
                    <option value={60}>60 minutes</option>
                  </Select>
                  {custom ? <FieldHint id={`${id}-length-hint`}>A topic round is always 30 minutes.</FieldHint> : null}
                </div>
              </div>
              {custom ? (
                <div>
                  <FieldLabel htmlFor={`${id}-focus`}>Focus topic</FieldLabel>
                  <Input
                    id={`${id}-focus`}
                    value={form.focusTopic}
                    maxLength={120}
                    placeholder="For example, DBMS normalisation"
                    onChange={(e) => patch({ focusTopic: e.target.value })}
                  />
                </div>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor={`${id}-company`}>Company (optional)</FieldLabel>
                  <Input id={`${id}-company`} value={form.companyName} onChange={(e) => patch({ companyName: e.target.value })} />
                  <FieldHint>Leave empty for general practice.</FieldHint>
                </div>
                <div>
                  <FieldLabel htmlFor={`${id}-role`}>Role (optional)</FieldLabel>
                  <Input id={`${id}-role`} value={form.roleTitle} onChange={(e) => patch({ roleTitle: e.target.value })} />
                </div>
                <div>
                  <FieldLabel htmlFor={`${id}-stage`}>Candidate stage</FieldLabel>
                  <Select id={`${id}-stage`} value={form.candidateStage} onChange={(e) => patch({ candidateStage: e.target.value as AssignmentForm["candidateStage"] })}>
                    <option value="student">Student</option>
                    <option value="recent_graduate">Recent graduate</option>
                  </Select>
                </div>
                <div>
                  <FieldLabel htmlFor={`${id}-language`}>Language</FieldLabel>
                  <Select id={`${id}-language`} value={form.language} onChange={(e) => patch({ language: e.target.value as AssignmentForm["language"] })}>
                    <option value="english">English</option>
                    <option value="hindi_english">Hindi and English</option>
                  </Select>
                </div>
              </div>
            </>
          ) : isMcq ? (
            <McqPicker
              courseSlugs={form.mcqCourseSlugs}
              questionCount={form.mcqQuestionCount}
              timeLimit={form.mcqTimeLimit}
              onLoaded={setBank}
              onChange={(change) => patch(change)}
            />
          ) : (
            <ScenarioPicker
              loading={scenarios.loading && !scenarios.data}
              error={scenarios.error?.message ?? null}
              options={scenarios.data ?? []}
              selected={form.scenarioIds}
              onChange={(scenarioIds) => patch({ scenarioIds })}
            />
          )}

          <div>
            <FieldLabel htmlFor={`${id}-instructions`}>Instructions for students (optional)</FieldLabel>
            <Textarea
              id={`${id}-instructions`}
              rows={3}
              value={form.instructions}
              maxLength={2000}
              onChange={(e) => patch({ instructions: e.target.value })}
            />
          </div>
        </fieldset>
      ) : null}

      {step === 1 ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading text-ink">Who gets it?</legend>
          {batches.error ? <Alert tone="error">{batches.error.message}</Alert> : null}
          {batches.loading && !batches.data ? <Skeleton className="h-24 w-full" /> : null}
          {batches.data ? (
            batches.data.length === 0 ? (
              <p className="text-caption text-ink-muted">No batches are available to you yet. You can still pick individual students.</p>
            ) : (
              <div role="group" aria-label="Batches" className="grid gap-2 sm:grid-cols-2">
                {batches.data.map((batch) => (
                  <label key={batch.id} className="flex items-center gap-3 rounded-lg border border-line p-3 text-body">
                    <Checkbox
                      checked={form.batchIds.includes(batch.id)}
                      onChange={(e) =>
                        patch({ batchIds: e.target.checked ? [...form.batchIds, batch.id] : form.batchIds.filter((x) => x !== batch.id) })
                      }
                    />
                    <span>
                      {batch.name} <span className="text-caption text-ink-muted">({batch.studentCount} students)</span>
                    </span>
                  </label>
                ))}
              </div>
            )
          ) : null}
          <StudentPicker
            selected={form.memberIds}
            names={studentNames}
            onAdd={(member) => {
              setStudentNames((current) => ({ ...current, [member.id]: member.name ?? member.email }));
              patch({ memberIds: [...form.memberIds, member.id] });
            }}
            onRemove={(memberId) => patch({ memberIds: form.memberIds.filter((x) => x !== memberId) })}
          />
        </fieldset>
      ) : null}

      {step === 2 ? (
        <fieldset className="flex flex-col gap-4">
          <legend className="text-heading text-ink">Deadline and limits</legend>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <FieldLabel htmlFor={`${id}-due`}>Deadline</FieldLabel>
              <Input id={`${id}-due`} type="datetime-local" value={form.dueAt} aria-describedby={`${id}-due-hint`} onChange={(e) => patch({ dueAt: e.target.value })} />
              <FieldHint id={`${id}-due-hint`}>
                In your timezone, {Intl.DateTimeFormat().resolvedOptions().timeZone}.
              </FieldHint>
            </div>
            <label className="flex items-center gap-3 self-end rounded-lg border border-line p-3 text-body">
              <Checkbox checked={form.allowLate} onChange={(e) => patch({ allowLate: e.target.checked })} />
              Allow late attempts
            </label>
            {isInterview || isMcq ? (
              <div>
                <FieldLabel htmlFor={`${id}-attempts`}>Attempts per student</FieldLabel>
                <Input id={`${id}-attempts`} type="number" min={1} max={10} value={form.attemptLimit} onChange={(e) => patch({ attemptLimit: e.target.value })} />
              </div>
            ) : null}
            {isInterview ? (
              <>
                <div>
                  <FieldLabel htmlFor={`${id}-cap`}>Interview cap per student (optional)</FieldLabel>
                  <Input
                    id={`${id}-cap`}
                    type="number"
                    min={1}
                    value={form.interviewCap}
                    aria-describedby={`${id}-cap-hint`}
                    onChange={(e) => patch({ interviewCap: e.target.value })}
                  />
                  <FieldHint id={`${id}-cap-hint`}>Most interviews your college pays for per student. At most the attempts; empty means the attempts.</FieldHint>
                </div>
              </>
            ) : null}
            <div>
              <FieldLabel htmlFor={`${id}-component`}>Readiness component</FieldLabel>
              <Select
                id={`${id}-component`}
                value={form.component}
                aria-describedby={`${id}-component-hint`}
                onChange={(e) => {
                  setComponentTouched(true);
                  patch({ component: e.target.value as AssignmentForm["component"] });
                }}
              >
                {COMPONENTS.map((value) => (
                  <option key={value} value={value}>
                    {COMPONENT_LABEL[value]}
                  </option>
                ))}
              </Select>
              <FieldHint id={`${id}-component-hint`}>Which readiness score this assignment feeds. Chosen from the round type until you change it.</FieldHint>
            </div>
            <div>
              <FieldLabel htmlFor={`${id}-topic`}>Topic (optional)</FieldLabel>
              <Select
                id={`${id}-topic`}
                value={form.topic}
                onChange={(e) => {
                  setTopicTouched(true);
                  patch({ topic: e.target.value as AssignmentForm["topic"] });
                }}
              >
                <option value="">No topic</option>
                {TOPICS.map((value) => (
                  <option key={value} value={value}>
                    {TOPIC_LABEL[value]}
                  </option>
                ))}
              </Select>
            </div>
          </div>
          {chosenScenarios.length > 0 ? <p className="text-caption text-ink-muted">{chosenScenarios.length} scenarios selected.</p> : null}
        </fieldset>
      ) : null}

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
        {step > 0 ? (
          <Button type="button" variant="secondary" onClick={() => setStep(step - 1)}>
            Back
          </Button>
        ) : null}
        {step < STEPS.length - 1 ? (
          <Button type="button" onClick={next}>
            Next
          </Button>
        ) : (
          <>
            <Button type="submit" disabled={pending}>
              {saveLabel}
            </Button>
            {onSaveAndPublish ? (
              <Button type="button" variant="secondary" disabled={pending} onClick={(event) => submit(event as unknown as FormEvent, true)}>
                Save and publish
              </Button>
            ) : null}
          </>
        )}
      </div>
    </form>
  );
}

/**
 * The MCQ test's courses (only those the bank offers, with their question counts and topic),
 * how many questions each attempt draws, and an optional time limit.
 */
function McqPicker({
  courseSlugs,
  questionCount,
  timeLimit,
  onLoaded,
  onChange,
}: {
  courseSlugs: string[];
  questionCount: string;
  timeLimit: string;
  onLoaded: (bank: McqBankSummary[]) => void;
  onChange: (change: Partial<AssignmentForm>) => void;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const load = useCallback((signal: AbortSignal) => fetchMcqBank(orgId, { accessToken, signal }), [orgId, accessToken]);
  const bank = useLoad(load);
  useEffect(() => {
    if (bank.data) onLoaded(bank.data);
  }, [bank.data, onLoaded]);

  if (bank.error) return <Alert tone="error">{bank.error.message}</Alert>;
  if (bank.loading && !bank.data) return <Skeleton className="h-24 w-full" />;
  const courses = bank.data ?? [];
  if (courses.length === 0) {
    return <Alert tone="info">No course has enough multiple-choice questions for a test yet.</Alert>;
  }
  const available = courses.filter((c) => courseSlugs.includes(c.courseSlug)).reduce((sum, c) => sum + c.questions, 0);
  return (
    <div className="flex flex-col gap-4">
      <div role="group" aria-label="Courses" className="flex flex-col gap-2">
        <p className="text-caption text-ink-muted">
          Questions are drawn at random from these courses&apos; chapter quizzes, so students may see different questions.
          {courseSlugs.length > 0 ? ` The chosen courses hold ${available} questions.` : ""}
        </p>
        <ul className="grid gap-2 sm:grid-cols-2">
          {courses.map((course) => {
            const checked = courseSlugs.includes(course.courseSlug);
            return (
              <li key={course.courseSlug}>
                <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-body">
                  <Checkbox
                    checked={checked}
                    disabled={!checked && courseSlugs.length >= MCQ_LIMITS.maxCourses}
                    onChange={(e) =>
                      onChange({
                        mcqCourseSlugs: e.target.checked
                          ? [...courseSlugs, course.courseSlug]
                          : courseSlugs.filter((slug) => slug !== course.courseSlug),
                      })
                    }
                  />
                  <span>
                    <span className="block font-semibold text-ink">{course.courseTitle}</span>
                    <span className="block text-caption text-ink-muted">
                      {course.questions} questions · {course.topic ? TOPIC_LABEL[course.topic] : "No campus topic"}
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <FieldLabel htmlFor={`${id}-count`}>Questions per attempt</FieldLabel>
          <Input
            id={`${id}-count`}
            type="number"
            min={MCQ_LIMITS.minQuestions}
            max={MCQ_LIMITS.maxQuestions}
            value={questionCount}
            aria-describedby={`${id}-count-hint`}
            onChange={(e) => onChange({ mcqQuestionCount: e.target.value })}
          />
          <FieldHint id={`${id}-count-hint`}>
            {MCQ_LIMITS.minQuestions} to {MCQ_LIMITS.maxQuestions}, and no more than the chosen courses hold.
          </FieldHint>
        </div>
        <div>
          <FieldLabel htmlFor={`${id}-limit`}>Time limit in minutes (optional)</FieldLabel>
          <Input
            id={`${id}-limit`}
            type="number"
            min={MCQ_LIMITS.minMinutes}
            max={MCQ_LIMITS.maxMinutes}
            value={timeLimit}
            aria-describedby={`${id}-limit-hint`}
            onChange={(e) => onChange({ mcqTimeLimit: e.target.value })}
          />
          <FieldHint id={`${id}-limit-hint`}>Empty means no limit. Students see a timer when there is one.</FieldHint>
        </div>
      </div>
    </div>
  );
}

function ScenarioPicker({
  loading,
  error,
  options,
  selected,
  onChange,
}: {
  loading: boolean;
  error: string | null;
  options: CampusScenarioOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  if (error) return <Alert tone="error">{error}</Alert>;
  if (loading) return <Skeleton className="h-24 w-full" />;
  if (options.length === 0) return <Alert tone="info">No Arena scenarios are live right now.</Alert>;
  return (
    <div role="group" aria-label="Scenarios" className="flex flex-col gap-2">
      <p className="text-caption text-ink-muted">Choose 1 to 20 scenarios. {selected.length} chosen.</p>
      <ul className="grid max-h-72 gap-2 overflow-y-auto">
        {options.map((option) => {
          const checked = selected.includes(option.id);
          return (
            <li key={option.id}>
              <label className="flex items-start gap-3 rounded-lg border border-line p-3 text-body">
                <Checkbox
                  checked={checked}
                  disabled={!checked && selected.length >= 20}
                  onChange={(e) => onChange(e.target.checked ? [...selected, option.id] : selected.filter((x) => x !== option.id))}
                />
                <span>
                  <span className="block font-semibold text-ink">{option.title}</span>
                  <span className="block text-caption text-ink-muted">
                    {option.courseTitle} · {option.tier} · about {option.estimatedMinutes} min
                  </span>
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function StudentPicker({
  selected,
  names,
  onAdd,
  onRemove,
}: {
  selected: string[];
  names: Record<string, string>;
  onAdd: (member: MemberView) => void;
  onRemove: (id: string) => void;
}) {
  const { orgId, accessToken } = useCampusOrg();
  const id = useId();
  const [text, setText] = useState("");
  const [q, setQ] = useState("");
  const [results, setResults] = useState<MemberView[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q) return;
    const controller = new AbortController();
    fetchMembers(orgId, { accessToken, signal: controller.signal }, { role: "student", q })
      .then((page) => {
        if (controller.signal.aborted) return;
        setResults(page.items);
        setError(null);
      })
      .catch(() => {
        if (!controller.signal.aborted) setError("Students could not be searched just now.");
      });
    return () => controller.abort();
  }, [orgId, accessToken, q]);

  return (
    <div className="flex flex-col gap-2">
      <div role="search" className="flex items-end gap-2">
        <div className="flex-1">
          <FieldLabel htmlFor={`${id}-q`}>Add individual students (optional)</FieldLabel>
          <Input
            id={`${id}-q`}
            type="search"
            value={text}
            placeholder="Name, email or roll number"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                setQ(text.trim());
              }
            }}
          />
        </div>
        <Button type="button" variant="secondary" onClick={() => setQ(text.trim())}>
          Search
        </Button>
      </div>
      {error ? <Alert tone="error">{error}</Alert> : null}
      {q && results.length > 0 ? (
        <ul aria-label="Search results" className="divide-y divide-line rounded-lg border border-line">
          {results.map((member) => (
            <li key={member.id} className="flex items-center justify-between gap-3 p-3 text-body">
              <span>
                {member.name ?? member.email}
                <span className="block text-caption text-ink-muted">{[member.batchName, member.rollNumber].filter(Boolean).join(" · ")}</span>
              </span>
              <Button type="button" size="sm" variant="secondary" disabled={selected.includes(member.id)} onClick={() => onAdd(member)}>
                {selected.includes(member.id) ? "Added" : `Add ${member.name ?? member.email}`}
              </Button>
            </li>
          ))}
        </ul>
      ) : null}
      {selected.length > 0 ? (
        <ul aria-label="Selected students" className="flex flex-wrap gap-2">
          {selected.map((memberId) => (
            <li key={memberId}>
              <span className="pill pill-info inline-flex items-center gap-2">
                {names[memberId] ?? "Student"}
                <button type="button" aria-label={`Remove ${names[memberId] ?? "student"}`} onClick={() => onRemove(memberId)}>
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
