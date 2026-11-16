import type { CandidateStage, InterviewLanguage, ResumeParseStatus, RoundType } from "./domain.js";

/**
 * How much interviewing this product has done, across everyone.
 *
 * Aggregate only — two integers, nothing that identifies a candidate or an employer —
 * which is what makes it safe to serve unauthenticated.
 */
export interface UsageCounts {
  /** Rounds that reached `completed`. An abandoned session is not an interview. */
  interviewsCompleted: number;
  /** Reports actually composed. Lower than the rounds when someone never opened theirs. */
  reportsGenerated: number;
}

/** Whether the candidate may start another interview, and why not if not. */
export interface EntitlementView {
  allowed: boolean;
  reason:
    | "allowed"
    | "session_in_progress"
    | "free_tier_exhausted"
    | "daily_rounds_reached"
    | "daily_minutes_reached"
    | "daily_minutes_short";
  message: string;
  /**
   * How many of the lifetime free rounds are left (3 in all, owner, 29 October 2026), or
   * null when the server sets no free limit.
   */
  remainingFree: number | null;
  /**
   * An optional daily allowance, reset at midnight India time. Off by default, so each is
   * null: the free tier is the lifetime rounds above, not a daily quota.
   */
  dailyRoundLimit: number | null;
  dailyMinuteLimit: number | null;
  remainingRoundsToday: number | null;
  remainingMinutesToday: number | null;
  /** The round blocking a new one (`created` or `in_progress`), so a client can always offer Resume. */
  openSessionId?: string | null;
  /** Paid interviews bought and not yet spent. */
  creditBalance: number;
  /**
   * What would pay for a round started now: the free allowance, or one paid interview.
   * Null when no round may start.
   */
  funding: "free" | "credit" | null;
  /** Whether interviews can be bought here; false until the server has Razorpay keys. */
  purchasable: boolean;
}

export interface TurnView {
  turnIndex: number;
  questionText: string;
  /** Short-lived signed URL for the spoken question. Null until the voice has rendered. */
  questionAudioUrl: string | null;
  /**
   * Speech is synthesised after the question text is sent, so the room has to tell
   * "still coming" apart from "not coming": a null URL alone says only that there is
   * nothing to play yet. `unavailable` means the turn runs as written text.
   */
  questionAudioStatus: SpeechStatus;
  /** Where this exchange sits in the round. */
  phase: TurnPhase;
  answered: boolean;
}

export type SpeechStatus = "pending" | "ready" | "unavailable";

/**
 * A round warms up before it gets hard, and closes rather than stopping dead. The server
 * decides which stage a turn belongs to; the room only labels it.
 */
export type TurnPhase = "warmup" | "main" | "closing";

export interface SessionView {
  id: string;
  companyName: string;
  archetype: string;
  archetypeLabel: string;
  /**
   * `inferred` means we do not know this employer and are running general patterns.
   * The UI must say so — never present an archetype pattern as a company-specific claim.
   */
  archetypeConfidence: "recognised" | "inferred";
  groundingNote: string;
  roleTitle: string;
  roundType: RoundType;
  roundLabel: string;
  /** A candidate-chosen scope for a focused custom-topic round. */
  focusTopic: string | null;
  language: InterviewLanguage;
  status: "created" | "in_progress" | "completed" | "abandoned" | "failed";
  /** Whether video was consented to. The only thing that may open the camera. */
  consentVideo: boolean;
  startedAt: string | null;
  endedAt: string | null;
  /** How long the round is scheduled to run. */
  durationMinutes: number;
  /**
   * When the round is scheduled to end, decided by the server. The room counts down to
   * this rather than to a clock of its own.
   */
  scheduledEndAt: string | null;
  turnsCompleted: number;
  /** A ceiling on exchanges, not a target — the clock is what ends the round. */
  maxTurns: number;
  currentTurn: TurnView | null;
  /**
   * The material this round is conducted around, composed once when it started.
   *
   * Null for a round that is only a conversation, and null too when composition failed.
   * The client renders the plain spoken room in both cases — a DSA round with an empty
   * editor and no problem in it is worse than one held entirely out loud.
   */
  workspace: RoundWorkspace | null;
  /** What the candidate has drawn or written so far, so a reload does not lose it. */
  board: BoardState | null;
  /**
   * Whether a college assigned this round (campus module 4). Only then does the room send
   * integrity counts (module 5), which the student was told about before consenting.
   * Optional so an older API without the field reads as a personal round.
   */
  assigned?: boolean;
}

/** The material a round runs on. Discriminated on `kind`; more rounds may grow one. */
export type RoundWorkspace = ProblemWorkspace | CaseWorkspace;

export interface ProblemWorkspace {
  kind: "dsa";
  problem: CodingProblem;
}

export interface CaseWorkspace {
  kind: "system_design";
  case: DesignCase;
}

/**
 * A coding problem, and enough scaffolding to run it.
 *
 * `starterPython` and `starterJava` are complete runnable programs, not fragments: they
 * read one case from stdin in the shape `stdinFormat` describes and print only the
 * answer. That is what lets a test case be piped in verbatim without a harness per
 * problem — and what makes a malformed one degrade to an editor with no Run rather than
 * a broken round.
 */
export interface CodingProblem {
  title: string;
  topic: string;
  difficulty: "easy" | "medium" | "hard";
  statement: string;
  examples: ProblemExample[];
  constraints: string[];
  starterPython: string;
  starterJava: string;
  stdinFormat: string;
  testCases: ProblemTestCase[];
  /**
   * True when every expected output came from running two independent solutions and
   * getting the same answer. False, or absent on rounds from before the check existed,
   * means the outputs are the model's own working and may be wrong — the room says so.
   */
  testsVerified?: boolean;
}

export interface ProblemExample {
  input: string;
  output: string;
  explanation?: string | null;
}

export interface ProblemTestCase {
  input: string;
  expected: string;
}

/**
 * A system design case.
 *
 * `deepDiveOptions` is the interviewer's, and the room must not render it: handing
 * someone the deep dives in advance turns a round that tests scoping into one that
 * tests reading.
 */
export interface DesignCase {
  title: string;
  summary: string;
  constraints: string[];
  openingPrompt: string;
  deepDiveOptions: string[];
}

/** Whatever the candidate produced. Shaped by the round, opaque to the server. */
export interface BoardState {
  kind: "dsa" | "system_design";
  /** DSA: the source they last had in the editor, per language. */
  sources?: Record<string, string>;
  language?: string;
  /** System design: the Excalidraw scene, as its own elements array. */
  elements?: unknown[];
  appState?: Record<string, unknown>;
}

/** A request to run the candidate's code against one input. */
export interface RunCodeRequest {
  source: string;
  language: "python" | "java";
  stdin: string;
}

/**
 * What running it produced.
 *
 * `available` false means nothing ran — no runner is configured, or it refused — and
 * `message` says so in words meant for the candidate. It is never an error: a round
 * whose compiler is missing carries on out loud, which is what is being assessed.
 */
export interface CodeRunResult {
  stdout: string;
  stderr: string;
  exitCode: number;
  timedOut: boolean;
  available: boolean;
  message: string | null;
}

/** One line of intent, as the candidate typed it. */
export interface ComposeRoundRequest {
  query: string;
}

/**
 * A round drafted from that one line, shown back before anything is created.
 *
 * Nothing is saved. The candidate corrects what is wrong and starts the round through
 * the normal endpoint, so the composer is a faster way into the same setup rather than a
 * second way to create a session.
 *
 * `companyName` may be empty, and that is an answer rather than a failure: the round
 * runs on general patterns and `groundingNote` says so. A guessed employer would be
 * worse, because it silently changes which loop the candidate practises against.
 */
export interface RoundDraft {
  /** Optional context is represented by an empty string so form controls stay controlled. */
  companyName: string;
  /** Optional context is represented by an empty string so form controls stay controlled. */
  roleTitle: string;
  level: string;
  roundType: RoundType;
  roundLabel: string;
  /** The strict scope when the composer recognises a topic-focused request. */
  focusTopic: string | null;
  durationMinutes: number;
  language: InterviewLanguage;
  /** One sentence back to the candidate, saying what was taken from what they wrote. */
  understood: string;
  /** Everything filled in that they did not say, so they can correct it at a glance. */
  assumptions: string[];
  confidence: "high" | "medium" | "low";
  archetypeLabel: string;
  archetypeConfidence: "recognised" | "inferred";
  groundingNote: string;
}

export interface StartSessionRequest {
  /**
   * This browser will read the questions out itself, so the server should not synthesise
   * them. A browser with a modern neural voice speaks instantly and for nothing, against
   * a model quota of a hundred calls a day.
   */
  speaksLocally?: boolean;
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  /** Required by the API when `roundType` is `custom_topic`. */
  focusTopic?: string;
  language: InterviewLanguage;
  consentAudio: boolean;
  consentVideo: boolean;
  /**
   * How long the round should run. Omitted, the server picks a realistic 40 minutes —
   * the default lives there so every client gets the same round, not just this one.
   */
  durationMinutes?: number;
  /**
   * Where the candidate says they are (task 051), so they can correct the server's own
   * guess rather than sit whatever round it derived from the role title and resume alone.
   * Optional: omitted, the guess stands exactly as it did before this field existed.
   */
  candidateStage?: CandidateStage;
  /**
   * A college assignment this round fulfils (Campus module 4). The server then takes the
   * round's shape from the assignment and ignores the values above.
   */
  assignmentId?: string;
}

/**
 * Help the candidate asked for, and what asking cost them.
 *
 * `assistanceLabel` is shown in the room the moment the hint arrives. Someone deciding
 * whether to ask should learn the price then, not when they read the report.
 */
export interface HintView {
  turnIndex: number;
  text: string;
  assistanceLevel: "redirected" | "hinted" | "guided";
  assistanceLabel: string;
}

export interface SubmitAnswerResponse {
  sessionComplete: boolean;
  turnsCompleted: number;
  nextTurn: TurnView | null;
  /**
   * The last thing the interviewer says, when this answer ended the round. Null
   * otherwise. The room speaks it before showing the completion screen.
   */
  closingRemark?: string | null;
}

/**
 * One past round, as the candidate's history lists it.
 *
 * The retention fields are here so a client never has to guess what a "Read report" link
 * will do. `reportExpired` means the report, the transcript and the recordings have been
 * cleared and are not coming back — do not render the link, because following it is the
 * broken page these fields exist to prevent. `reportExpiresAt` is when that will happen,
 * so the candidate can be warned before it does rather than after. And
 * `reportRetentionDays` is the rule itself, sent rather than written into the browser:
 * it is one property on the server, and a client that hardcodes the number will still be
 * saying it on the day somebody changes it.
 */
export interface SessionSummary {
  id: string;
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  status: SessionView["status"];
  startedAt: string | null;
  endedAt: string | null;
  hasReport: boolean;
  /** Cleared by retention. There is nothing left to open, and nothing to recompose from. */
  reportExpired: boolean;
  /** ISO-8601 instant. Null once the round has been cleared. */
  reportExpiresAt: string | null;
  /** How long a report is kept, in days. */
  reportRetentionDays: number;
}

// ---------------------------------------------------------------------------
// Report (PRD 09)
// ---------------------------------------------------------------------------

/** A score is only shown when it is anchored to something the candidate said. */
export interface ReportCompetency {
  competency: string;
  score: number;
  maxScore: number;
  rationale: string;
  evidenceQuote: string;
  turnIndex: number | null;
}

/**
 * One question the candidate was asked, and how they could have answered it better.
 *
 * The API now writes one of these for every answered, non-warm-up question — engine-side,
 * not left to the model, so a turn is never silently missing its note. `strongerFraming` is
 * nullable here only because a report stored before this existed may have none, or may have
 * one only for its weaker answers; a fresh report always has it.
 */
export interface ReportAnnotation {
  turnIndex: number;
  question: string;
  worked: string | null;
  vague: string | null;
  wouldProbe: string | null;
  strongerFraming: string | null;
}

export interface ReportCommunication {
  structure: string;
  fillerDensity: string;
  pace: string;
  rambling: string;
  handlingUncertainty: string;
  /** Camera is local-only, so the API explicitly carries no visual assessment. */
  presence?: null;
}

export interface ReportPracticeItem {
  focus: string;
  why: string;
  drill: string;
}

/**
 * One thing the candidate did well or badly, with the words that show it.
 *
 * Competency scores say how well. These say at what, and what to do — which is what a
 * candidate actually leaves with. Both are dropped server-side if the quote is not in
 * the transcript.
 */
export interface ReportAssessedArea {
  area: string;
  evidenceQuote: string;
  turnIndex: number | null;
  whyItMatters: string;
  whatToDo: string;
}

/** Where a real, retrievable document can be cited. Empty until there is a corpus. */
export interface ProvenanceSource {
  title: string;
  publisher: string | null;
  url: string | null;
  year: number | null;
}

/**
 * Why one question was asked, recorded when it was composed rather than reconstructed
 * afterwards.
 */
export interface ReportQuestionSource {
  turnIndex: number;
  question: string;
  phase: TurnPhase;
  /** What it was testing. */
  probes: string;
  /** Why this candidate got it, referring to what they had already said. */
  askedBecause: string;
  /** The archetype-level pattern behind it. */
  basis: string;
  tier: "model_knowledge" | "published_source" | "community_reported";
  /** What the tier means, in words shown to the candidate. */
  tierDisclosure: string;
  sources: ProvenanceSource[];
}

/**
 * The provenance section of the report.
 *
 * `disclosure` is the load-bearing field and it is deliberately unflattering: today
 * every question is `model_knowledge` with no sources, and saying so is the difference
 * between a citation and a claim. Never render the entries without it.
 */
export interface ReportQuestionSources {
  entries: ReportQuestionSource[];
  employerRecognised: boolean;
  archetypeLabel: string;
  headline: string;
  disclosure: string;
}

/** Always rendered as a simulation, never as a verdict. */
export interface ReportOutcome {
  label: string;
  likelihood: string;
  reasoning: string;
}

/**
 * How much the interviewer had to help, and what the candidate did with it.
 *
 * The counts are computed from the recorded turns; the narrative is written by the model
 * against those counts. Both are shown so the two cannot quietly disagree.
 */
export interface ReportAssistance {
  totalAnswers: number;
  unaidedAnswers: number;
  assistedAnswers: number;
  headline: string;
  narrative: string | null;
  breakdown: Array<{ label: string; count: number }>;
  /** What was actually supplied, in the interviewer's words. */
  moments: string[];
}

export interface SessionReport {
  sessionId: string;
  companyName: string;
  roleTitle: string;
  roundType: RoundType;
  roundLabel: string;
  /** The candidate-selected scope for a custom round; absent on older stored reports. */
  focusTopic?: string | null;
  archetypeLabel: string;
  answeredTurns: number;
  /** Non-warm-up answers that can support a competency judgement. */
  assessableTurns?: number;
  generatedAt: string;
  headline: string;
  summary: string;
  assistance: ReportAssistance;
  competencies: ReportCompetency[];
  annotations: ReportAnnotation[];
  communication: ReportCommunication;
  strengths: ReportAssessedArea[];
  developmentAreas: ReportAssessedArea[];
  questionSources: ReportQuestionSources;
  practicePlan: ReportPracticeItem[];
  recommendedNextSession: string;
  outcomeSimulation: ReportOutcome;
  /** Null or absent on a report written before spoken-English feedback existed. */
  spokenEnglish?: ReportSpokenEnglish | null;
}

/**
 * How the candidate spoke (PRD §09). Every number is measured — timings from the
 * microphone level, counts from the transcript — and computed server-side; a figure that
 * could not be measured is null, with a note saying why. Only `observations` come from
 * the model, and each quotes the candidate.
 */
export interface ReportSpokenEnglish {
  /** False in a Hindi-English round: English is not assessed there. */
  languageAssessed: boolean;
  scope: string;
  answersTotal: number;
  answersTimed: number;
  timingNote: string | null;
  wordCount: number;
  wordsPerMinute: number | null;
  /** Which side of the stated conversational range the pace fell on. */
  paceBand: "below" | "within" | "above" | null;
  paceNote: string;
  pauseCount: number | null;
  longestPauseSeconds: number | null;
  pauseSharePercent: number | null;
  medianFirstWordSeconds: number | null;
  hesitationCount: number | null;
  hesitationsPer100Words: number | null;
  answers: ReportSpokenAnswer[];
  observations: ReportSpokenObservation[];
}

export interface ReportSpokenAnswer {
  turnIndex: number;
  words: number;
  wordsPerMinute: number | null;
  pauseCount: number | null;
  longestPauseSeconds: number | null;
  firstWordSeconds: number | null;
}

export interface ReportSpokenObservation {
  aspect: "fluency" | "filler_words" | "grammar" | "vocabulary" | "clarity" | "coherence";
  aspectLabel: string;
  finding: string;
  evidenceQuote: string;
  turnIndex: number | null;
  suggestion: string;
}

/** Derived by grouping completed sessions — there is no stored target list. */
export interface ReadinessGroup {
  companyName: string;
  roleTitle: string;
  sessionsCompleted: number;
  firstAttemptAt: string | null;
  latestAttemptAt: string | null;
  latestAverageScore: number | null;
  firstAverageScore: number | null;
  recurringWeaknesses: string[];
}

// ---------------------------------------------------------------------------
// Profile and resume (PRD 05)
// ---------------------------------------------------------------------------

export interface ResumeEmployment {
  employer: string;
  title: string | null;
  startDate: string | null;
  endDate: string | null;
  current: boolean;
}

export interface ResumeProject {
  name: string;
  description: string | null;
  technologies: string[];
}

/**
 * The resume as the candidate's own profile page shows it back to them.
 *
 * `lowConfidenceFields` is the important one: the parser names what it was unsure of
 * rather than guessing, and the page has to surface that. A wrong employer silently
 * degrades every future interview, and the candidate is the only one who can catch it.
 */
export interface ResumeView {
  id: string;
  filename: string;
  status: ResumeParseStatus;
  error: string | null;
  uploadedAt: string | null;
  headline: string | null;
  employments: ResumeEmployment[];
  projects: ResumeProject[];
  detectedSkills: string[];
  lowConfidenceFields: string[];
  /** Derived from the dates by the server, never claimed by the resume. */
  totalExperienceMonths: number | null;
  gapCount: number;
  shortTenureCount: number;
}

export interface SkillView {
  name: string;
  selfRatedConfidence: number | null;
  detectedInResume: boolean;
  flaggedAsWeak: boolean;
}

export interface ProfileDetails {
  resume: ResumeView | null;
  skills: SkillView[];
  avatarUrl: string | null;
  /**
   * What the candidate saved about themselves. These used to be absent, which made the
   * profile write-only: everything typed into the form persisted and none of it ever came
   * back, so it read as a save that had silently failed.
   */
  currentLevel: string | null;
  targetLevel: string | null;
  linkedinUrl: string | null;
}

export interface UpdateProfileRequest {
  function?: string;
  currentLevel?: string;
  targetLevel?: string;
  location?: string;
  headline?: string;
  linkedinUrl?: string;
  noticePeriodDays?: number;
  workAuthorisationStatus?: string;
  relocationIntent?: string;
  peopleManagementScope?: string;
}
