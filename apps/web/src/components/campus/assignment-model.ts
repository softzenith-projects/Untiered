import type {
  AssignableRoundType,
  AssignmentInput,
  AssignmentKind,
  AssignmentView,
  CampusScenarioOption,
  CampusTopic,
  CompletionStatus,
  McqBankSummary,
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

/** MCQ test limits (contract "Module 4b"). */
export const MCQ_LIMITS = { minQuestions: 5, maxQuestions: 50, minMinutes: 5, maxMinutes: 120, maxCourses: 10 } as const;

/** The readiness component an assignment feeds, derived exactly as the contract says. */
export function defaultComponent(
  kind: AssignmentKind,
  roundType: AssignableRoundType | undefined,
  scenarios: CampusScenarioOption[] = [],
  mcqCourseSlugs: string[] = [],
): ReadinessComponent {
  if (kind === "mcq_test") {
    return mcqCourseSlugs.length > 0 && mcqCourseSlugs.every((slug) => slug === "dsa") ? "coding" : "core_cs";
  }
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
  /** mcq_test: the bank courses to draw from. */
  mcqCourseSlugs: string[];
  mcqQuestionCount: string;
  /** Minutes; empty means no time limit. */
  mcqTimeLimit: string;
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
    mcqCourseSlugs: [],
    mcqQuestionCount: "10",
    mcqTimeLimit: "",
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
    mcqCourseSlugs: view.mcq?.courseSlugs ?? [],
    mcqQuestionCount: view.mcq ? String(view.mcq.questionCount) : "10",
    mcqTimeLimit: view.mcq?.timeLimitMinutes ? String(view.mcq.timeLimitMinutes) : "",
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

/**
 * What the form says is wrong. Empty when it can be saved. With the MCQ [bank] loaded, an MCQ
 * test is also checked against it: every course must still be offered, and the question count
 * may not exceed what the chosen courses hold. The server checks the same again.
 */
export function validateForm(form: AssignmentForm, bank?: McqBankSummary[] | null): string[] {
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
  } else if (form.kind === "mcq_test") {
    errors.push(...validateMcq(form, bank));
  } else if (form.scenarioIds.length < 1 || form.scenarioIds.length > 20) {
    errors.push("Choose between 1 and 20 scenarios.");
  }
  if (form.batchIds.length + form.memberIds.length < 1) errors.push("Choose at least one batch or student.");
  if (!form.dueAt || Number.isNaN(new Date(form.dueAt).getTime())) errors.push("Set a deadline.");
  return errors;
}

function validateMcq(form: AssignmentForm, bank?: McqBankSummary[] | null): string[] {
  const errors: string[] = [];
  const { minQuestions, maxQuestions, minMinutes, maxMinutes, maxCourses } = MCQ_LIMITS;
  const courses = form.mcqCourseSlugs;
  if (courses.length < 1 || courses.length > maxCourses) errors.push(`Choose between 1 and ${maxCourses} courses for the test.`);
  const count = Number(form.mcqQuestionCount);
  if (!Number.isInteger(count) || count < minQuestions || count > maxQuestions) {
    errors.push(`Each attempt draws ${minQuestions} to ${maxQuestions} questions.`);
  } else if (bank && courses.length > 0) {
    const offered = new Map(bank.map((course) => [course.courseSlug, course.questions]));
    const missing = courses.filter((slug) => !offered.has(slug));
    if (missing.length > 0) {
      errors.push("A chosen course no longer has enough questions. Choose another course.");
    } else {
      const available = courses.reduce((sum, slug) => sum + (offered.get(slug) ?? 0), 0);
      if (count > available) errors.push(`The chosen courses have ${available} questions; draw at most that many.`);
    }
  }
  if (form.mcqTimeLimit.trim() !== "") {
    const minutes = Number(form.mcqTimeLimit);
    if (!Number.isInteger(minutes) || minutes < minMinutes || minutes > maxMinutes) {
      errors.push(`The time limit must be ${minMinutes} to ${maxMinutes} minutes, or empty for no limit.`);
    }
  }
  const attempts = Number(form.attemptLimit);
  if (!Number.isInteger(attempts) || attempts < 1 || attempts > 10) {
    errors.push("Attempts per student must be a whole number from 1 to 10.");
  }
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
  if (form.kind === "mcq_test") {
    return {
      ...base,
      mcq: {
        courseSlugs: form.mcqCourseSlugs,
        questionCount: Number(form.mcqQuestionCount),
        timeLimitMinutes: form.mcqTimeLimit.trim() ? Number(form.mcqTimeLimit) : null,
      },
      attemptLimit: Number(form.attemptLimit),
    };
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
