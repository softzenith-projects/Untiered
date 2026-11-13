import type {
  AssignableRoundType,
  AssignmentInput,
  AssignmentKind,
  AssignmentView,
  CampusScenarioOption,
  CampusTopic,
  CompletionStatus,
  ReadinessComponent,
} from "@untiered/shared";

/** Labels come from the Module 4 contract comments. */
export const ROUND_LABEL: Record<AssignableRoundType, string> = {
  technical_fundamentals: "Technical interview",
  project_deep_dive: "Resume and projects",
  coding_practical: "Coding round",
  aptitude: "Aptitude",
  hr_fit_closing: "HR interview",
  behavioural_competency: "Behavioural",
  custom_topic: "Topic round",
};
export const ROUND_TYPES = Object.keys(ROUND_LABEL) as AssignableRoundType[];

export const COMPONENT_LABEL: Record<ReadinessComponent, string> = {
  coding: "Coding",
  core_cs: "Core CS",
  technical_interview: "Technical interview",
  communication: "Communication",
  aptitude: "Aptitude",
};
export const COMPONENTS = Object.keys(COMPONENT_LABEL) as ReadinessComponent[];

export const TOPIC_LABEL: Record<CampusTopic, string> = {
  dsa: "Data structures and algorithms",
  dbms: "Databases",
  os: "Operating systems",
  oops: "Object-oriented programming",
  cn: "Computer networks",
  system_design: "System design",
  communication: "Communication",
  aptitude: "Aptitude",
};
export const TOPICS = Object.keys(TOPIC_LABEL) as CampusTopic[];

export const STATUS_LABEL: Record<CompletionStatus, string> = {
  not_started: "Not started",
  in_progress: "In progress",
  completed: "Completed",
  overdue: "Overdue",
};
export const STATUS_TONE: Record<CompletionStatus, "info" | "highlight" | "positive" | "danger"> = {
  not_started: "info",
  in_progress: "highlight",
  completed: "positive",
  overdue: "danger",
};

export const BLOCKED_REASON_TEXT: Record<string, string> = {
  not_open: "This assignment has not opened yet.",
  past_due: "The deadline has passed and your college is not accepting late attempts.",
  attempt_limit: "You have used all the attempts allowed for this assignment.",
  student_cap: "You have reached the number of interviews your college allows you for this assignment.",
  college_allowance: "Your college has used up its interview allowance for now. Ask your placement office.",
};

/** The readiness component an assignment feeds, derived exactly as the contract says. */
export function defaultComponent(
  kind: AssignmentKind,
  roundType: AssignableRoundType | undefined,
  scenarios: CampusScenarioOption[] = [],
): ReadinessComponent {
  if (kind === "arena_scenarios") {
    const allDsa = scenarios.length > 0 && scenarios.every((s) => /\bdsa\b|data structures/i.test(s.courseTitle));
    return allDsa ? "coding" : "core_cs";
  }
  switch (roundType) {
    case "coding_practical":
      return "coding";
    case "aptitude":
      return "aptitude";
    case "hr_fit_closing":
    case "behavioural_competency":
      return "communication";
    case "technical_fundamentals":
    case "project_deep_dive":
      return "technical_interview";
    default:
      return "core_cs";
  }
}

export interface AssignmentForm {
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
  scenarioIds: string[];
  batchIds: string[];
  memberIds: string[];
  /** Value of a `datetime-local` input, in the browser timezone. */
  dueAt: string;
  allowLate: boolean;
  attemptLimit: string;
  interviewCap: string;
  component: ReadinessComponent;
  topic: CampusTopic | "";
}

export function emptyForm(): AssignmentForm {
  return {
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
    scenarioIds: [],
    batchIds: [],
    memberIds: [],
    dueAt: "",
    allowLate: false,
    attemptLimit: "1",
    interviewCap: "",
    component: defaultComponent("interview", "technical_fundamentals"),
    topic: "",
  };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** ISO instant to the value a `datetime-local` input takes, in the browser timezone. */
export function toLocalInput(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** The browser-timezone `datetime-local` value as an ISO instant. */
export function fromLocalInput(value: string): string {
  return new Date(value).toISOString();
}

export function formFromView(view: AssignmentView): AssignmentForm {
  return {
    ...emptyForm(),
    kind: view.kind,
    title: view.title,
    instructions: view.instructions ?? "",
    roundType: view.roundType ?? "technical_fundamentals",
    durationMinutes: view.durationMinutes ?? 30,
    companyName: view.companyName ?? "",
    roleTitle: view.roleTitle ?? "",
    candidateStage: view.candidateStage ?? "student",
    language: view.language ?? "english",
    focusTopic: view.focusTopic ?? "",
    scenarioIds: view.scenarioIds ?? [],
    batchIds: view.targetBatches.map((b) => b.id),
    memberIds: view.targetStudents.map((s) => s.id),
    dueAt: toLocalInput(view.dueAt),
    allowLate: view.allowLate,
    attemptLimit: String(view.attemptLimit),
    interviewCap: view.interviewCap ? String(view.interviewCap) : "",
    component: view.component ?? defaultComponent(view.kind, view.roundType),
    topic: view.topic ?? "",
  };
}

/** What the form says is wrong. Empty when it can be saved. */
export function validateForm(form: AssignmentForm): string[] {
  const errors: string[] = [];
  const title = form.title.trim();
  if (title.length < 1 || title.length > 140) errors.push("Give the assignment a title of up to 140 characters.");
  if (form.instructions.length > 2000) errors.push("Instructions can be at most 2000 characters.");
  if (form.kind === "interview") {
    if (form.roundType === "custom_topic") {
      const topic = form.focusTopic.trim();
      if (!topic) errors.push("A topic round needs a focus topic.");
      else if (topic.length > 120) errors.push("The focus topic can be at most 120 characters.");
    }
    const attempts = Number(form.attemptLimit);
    if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
      errors.push("Attempts per student must be a whole number from 1 to 10.");
    } else if (form.interviewCap.trim() !== "") {
      const cap = Number(form.interviewCap);
      if (!Number.isInteger(cap) || cap < 1) errors.push("The interview cap must be a whole number of at least 1.");
      else if (cap > attempts) errors.push("The interview cap cannot be more than the attempts per student.");
    }
  } else if (form.scenarioIds.length < 1 || form.scenarioIds.length > 20) {
    errors.push("Choose between 1 and 20 scenarios.");
  }
  if (form.batchIds.length + form.memberIds.length < 1) errors.push("Choose at least one batch or student.");
  if (!form.dueAt || Number.isNaN(new Date(form.dueAt).getTime())) errors.push("Set a deadline.");
  return errors;
}

/** The request body for a form that passed `validateForm`. */
export function toInput(form: AssignmentForm): AssignmentInput {
  const base = {
    kind: form.kind,
    title: form.title.trim(),
    instructions: form.instructions.trim() || null,
    dueAt: fromLocalInput(form.dueAt),
    allowLate: form.allowLate,
    targets: { batchIds: form.batchIds, memberIds: form.memberIds },
    component: form.component,
    topic: form.topic || null,
  };
  if (form.kind === "arena_scenarios") {
    return { ...base, scenarioIds: form.scenarioIds, attemptLimit: 1 };
  }
  const custom = form.roundType === "custom_topic";
  return {
    ...base,
    roundType: form.roundType,
    durationMinutes: custom ? 30 : form.durationMinutes,
    companyName: form.companyName.trim() || null,
    roleTitle: form.roleTitle.trim() || null,
    candidateStage: form.candidateStage,
    language: form.language,
    focusTopic: custom ? form.focusTopic.trim() : null,
    attemptLimit: Number(form.attemptLimit),
    interviewCap: form.interviewCap.trim() ? Number(form.interviewCap) : null,
  };
}

const absolute = new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short" });

export function formatDue(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : absolute.format(d);
}

/** "in 3 days", "2 hours ago", relative to `now`. */
export function relativeTime(iso: string, now: number = Date.now()): string {
  const diff = new Date(iso).getTime() - now;
  const abs = Math.abs(diff);
  const units: [number, Intl.RelativeTimeFormatUnit][] = [
    [86_400_000, "day"],
    [3_600_000, "hour"],
    [60_000, "minute"],
  ];
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [ms, unit] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return "just now";
}
