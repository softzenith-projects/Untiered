import * as Sentry from "@sentry/nextjs";
import type {
  ApiError,
  ArenaBadgesView,
  ArenaCountersView,
  ArenaProgressView,
  AwardBadgesRequest,
  BankCompany,
  BankQuestionPage,
  BillingOverview,
  CheckoutOrder,
  ConfirmPaymentRequest,
  CourseProgressView,
  RoundType,
  CodeRunResult,
  EntitlementView,
  HintView,
  LoopBrief,
  MeResponse,
  PrepPlan,
  ProfileDetails,
  ResumeView,
  SkillView,
  UpdateProfileRequest,
  ImportArenaProgressRequest,
  ImportCourseProgressRequest,
  RecordAnswerRequest,
  ScenarioAnswerView,
  ScenarioCourseProgressView,
  ScenarioPlayView,
  ReadinessGroup,
  RoundDraft,
  RunCodeRequest,
  SessionReport,
  SessionSummary,
  SessionView,
  StartSessionRequest,
  SubmitAnswerResponse,
  TurnView,
  UsageCounts,
} from "@untiered/shared";

import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  AssignedItem,
  AssignmentInput,
  IntegrityEventBatch,
  IntegritySummary,
  AssignmentPublishedPatch,
  AssignmentStatus,
  AssignmentView,
  CompletionStatus,
  RecipientProgress,
  CampusScenarioOption,
  McqAttemptView,
  McqBankSummary,
  McqSubmitRequest,
  DashboardView,
  AttentionReason,
  AttentionRow,
  ReadinessCompletionFilter,
  ReadinessSort,
  StaffComment,
  CertificateView,
  MyProgrammeView,
  ProgrammeProgress,
  ProgrammeTemplate,
  ProgrammeTemplateInput,
  ProgrammeView,
  StartProgrammeRequest,
  ReadinessWeights,
  StudentReadiness,
  StudentReadinessRow,
  AdminCreateInviteRequest,
  AdminOrgSummary,
  ConvertLeadRequest,
  ConvertLeadResult,
  LeadRequest,
  LeadStatus,
  LeadView,
  UpdateLeadRequest,
  AdminUpdateOrgRequest,
  AuditEntryView,
  BatchView,
  CampusPage,
  CampusRole,
  CollegeUpdateOrgRequest,
  CreateInviteRequest,
  CreateOrgRequest,
  DepartmentView,
  FacultyScopesView,
  ImportCommitResult,
  ImportPreview,
  InvitePreview,
  InviteView,
  LeaderboardScope,
  LeaderboardView,
  MeCampusView,
  MemberView,
  OrgUsageRow,
  OrgView,
} from "@untiered/shared";

import type {
  AdminPackageView,
  CollegeBillingRow,
  CollegePackagesView,
  InvoicePackageRequest,
  PackageRequest,
  PayPackageRequest,
} from "@untiered/shared";

import { env } from "@/lib/env";
import type { AnswerTiming } from "@/lib/speech-timing";

/** A non-2xx response from the API, carrying the error envelope it returned. */
/**
 * A 5xx is our fault, so it is reported; a 4xx is the API saying no for a reason the
 * page already shows (not signed in, limit reached, not found), so it is not.
 */
function reportIfServerFault(path: string, error: ApiRequestError): ApiRequestError {
  if (error.status >= 500) {
    Sentry.captureException(error, { tags: { api_path: path, api_code: error.code } });
  }
  return error;
}

/**
 * The API gave no answer the page could read. Either the request never connected, or
 * something in front of the API answered without CORS headers: Caddy's bare 503s while the
 * API was frozen for seven hours on 17 November 2026, which the browser surfaces only as
 * "Failed to fetch". Nothing reached Sentry during that outage; this is what reaches it now.
 */
export class ApiUnreachableError extends Error {
  readonly path: string;

  constructor(path: string, cause: unknown) {
    super(`The API could not be reached (${path}).`, { cause });
    this.name = "ApiUnreachableError";
    this.path = path;
  }
}

/** One report per tab per minute: an outage is one issue with a count, not a flood. */
const UNREACHABLE_REPORT_INTERVAL_MS = 60_000;
let lastUnreachableReportAt = Number.NEGATIVE_INFINITY;

/**
 * Reports a request that got no readable answer, then lets the caller rethrow the original
 * error so the page behaves as before. Not reported: a request the page itself cancelled,
 * or one made while the browser knows it is offline, since neither is the API's fault.
 */
function reportIfUnreachable(path: string, error: unknown, signal?: AbortSignal): void {
  if (signal?.aborted) return;
  if (error instanceof DOMException && error.name === "AbortError") return;
  if (typeof navigator !== "undefined" && navigator.onLine === false) return;
  const now = Date.now();
  if (now - lastUnreachableReportAt < UNREACHABLE_REPORT_INTERVAL_MS) return;
  lastUnreachableReportAt = now;
  Sentry.captureException(new ApiUnreachableError(path, error), {
    level: "error",
    tags: { api_path: path, api_reachable: "no" },
    // Every path, one issue: the question is "is the API reachable", not "is /me".
    fingerprint: ["api-unreachable"],
  });
}

/** `fetch`, reporting to Sentry when it gets no answer at all. */
async function fetchReported(path: string, url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init);
  } catch (error) {
    reportIfUnreachable(path, error, init.signal ?? undefined);
    throw error;
  }
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "ApiRequestError";
    this.status = status;
    this.code = code;
  }
}

interface ApiGetOptions {
  accessToken: string;
  signal?: AbortSignal;
}

/** Pauses before each repeat of a read that failed in transit. */
const READ_RETRY_DELAYS_MS = [400, 1_200];

/** The API restarting, a dropped connection, or a gateway timing out — not an answer. */
function isTransient(response: Response): boolean {
  return response.status === 502 || response.status === 503 || response.status === 504;
}

function pause(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(signal.reason);
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve();
    }, ms);
    function onAbort() {
      clearTimeout(timer);
      reject(signal?.reason);
    }
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * A GET, repeated a couple of times if it never reached an answer. Reads are safe to
 * repeat, and a page that loads several of them at once otherwise showed "unavailable"
 * banners for a blip that had cleared a second later. Writes are never repeated here.
 */
async function fetchRead(url: string, init: RequestInit, signal?: AbortSignal): Promise<Response> {
  for (let attempt = 0; ; attempt += 1) {
    const delay = READ_RETRY_DELAYS_MS[attempt];
    try {
      const response = await fetch(url, init);
      if (delay === undefined || !isTransient(response)) return response;
    } catch (error) {
      if (delay === undefined || signal?.aborted) throw error;
    }
    await pause(delay, signal);
  }
}

async function apiGet<T>(path: string, { accessToken, signal }: ApiGetOptions): Promise<T> {
  let response: Response;
  try {
    response = await fetchRead(
      `${env.apiBaseUrl}${path}`,
      {
        headers: {
          Accept: "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        // The API is the authority on freshness; never serve a cached profile.
        cache: "no-store",
        ...(signal ? { signal } : {}),
      },
      signal,
    );
  } catch (error) {
    // Only after every repeat has failed: a blip that cleared on retry is not an outage.
    reportIfUnreachable(path, error, signal);
    throw error;
  }

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as (ApiError & { code?: string }) | null;
    throw reportIfServerFault(
      path,
      new ApiRequestError(
        response.status,
        envelope?.error ?? envelope?.code ?? "unknown_error",
        envelope?.message ?? `Request to ${path} failed with status ${response.status}.`,
      ),
    );
  }

  return (await response.json()) as T;
}

async function apiSend<T>(
  path: string,
  method: "POST" | "PATCH" | "PUT" | "DELETE",
  accessToken: string,
  body?: unknown,
): Promise<T> {
  const isForm = body instanceof FormData;
  const response = await fetchReported(path, `${env.apiBaseUrl}${path}`, {
    method,
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      // Let the browser set the multipart boundary itself.
      ...(isForm || body === undefined ? {} : { "Content-Type": "application/json" }),
    },
    ...(body === undefined ? {} : { body: isForm ? body : JSON.stringify(body) }),
  });

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as (ApiError & { code?: string }) | null;
    throw reportIfServerFault(
      path,
      new ApiRequestError(
        response.status,
        envelope?.error ?? envelope?.code ?? "unknown_error",
        envelope?.message ?? `Request to ${path} failed with status ${response.status}.`,
      ),
    );
  }

  if (response.status === 204) {
    return undefined as T;
  }
  return (await response.json()) as T;
}

/** `GET /api/v1/me` — the same endpoint the mobile apps will call. */
export function fetchMe(options: ApiGetOptions): Promise<MeResponse> {
  return apiGet<MeResponse>("/api/v1/me", options);
}

export interface EmailPreferences {
  dailyQuestion: boolean;
  announcements: boolean;
  reengagement: boolean;
  consentedAt: string | null;
  /** Campus reminders, report-ready emails and weekly summaries (campus spec §9). */
  campusReminders?: boolean;
}

export type EmailPreferenceChoices = Pick<EmailPreferences, "dailyQuestion" | "announcements" | "reengagement"> & {
  /** Left out, the setting is unchanged. */
  campusReminders?: boolean;
};

export function fetchEmailPreferences(options: ApiGetOptions): Promise<EmailPreferences> {
  return apiGet<EmailPreferences>("/api/v1/me/email-preferences", options);
}

export function updateEmailPreferences(accessToken: string, choices: EmailPreferenceChoices): Promise<EmailPreferences> {
  return apiSend<EmailPreferences>("/api/v1/me/email-preferences", "PUT", accessToken, choices);
}

export async function unsubscribeEmail(token: string): Promise<void> {
  const response = await fetchReported("/api/v1/email/unsubscribe", `${env.apiBaseUrl}/api/v1/email/unsubscribe/${encodeURIComponent(token)}`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Could not unsubscribe right now.");
}

/**
 * The public usage counters. No token: this is two aggregate integers, read by the
 * landing page before anyone has signed in.
 *
 * Returns null rather than throwing. A counter is decoration; a landing page that fails
 * to render because a statistic did not load would be a poor trade.
 */
export async function fetchUsage(signal?: AbortSignal): Promise<UsageCounts | null> {
  try {
    const response = await fetch(`${env.apiBaseUrl}/api/v1/usage`, {
      headers: { Accept: "application/json" },
      signal,
      next: { revalidate: 300 },
    });
    if (!response.ok) return null;
    return (await response.json()) as UsageCounts;
  } catch {
    return null;
  }
}

// -- profile and resume ------------------------------------------------------

export function fetchProfile(options: ApiGetOptions): Promise<ProfileDetails> {
  return apiGet<ProfileDetails>("/api/v1/me/profile", options);
}

/** Just the profile photo, for the account menu: a signed URL, or null when none is set. */
export function fetchAvatar(options: ApiGetOptions): Promise<{ avatarUrl: string | null }> {
  return apiGet<{ avatarUrl: string | null }>("/api/v1/me/avatar", options);
}

export function updateProfile(
  accessToken: string,
  body: UpdateProfileRequest,
): Promise<ProfileDetails> {
  return apiSend<ProfileDetails>("/api/v1/me/profile", "PUT", accessToken, body);
}

export function upsertSkill(
  accessToken: string,
  body: { name: string; selfRatedConfidence?: number; flaggedAsWeak?: boolean },
): Promise<SkillView[]> {
  return apiSend<SkillView[]>("/api/v1/me/skills", "PUT", accessToken, body);
}

export async function deleteSkill(accessToken: string, name: string): Promise<void> {
  await apiSend<void>(`/api/v1/me/skills/${encodeURIComponent(name)}`, "DELETE", accessToken);
}

/**
 * Uploads and parses a resume.
 *
 * Slow on purpose: the parse happens inside this request rather than behind a status
 * poll, because the candidate is waiting to find out whether we read their resume
 * correctly and an answer they have to come back for is worse than a wait they can see.
 */
export function uploadResume(accessToken: string, file: File): Promise<ResumeView> {
  const form = new FormData();
  form.set("file", file);
  return apiSend<ResumeView>("/api/v1/me/resume", "POST", accessToken, form);
}

export function uploadAvatar(accessToken: string, file: File): Promise<ProfileDetails> {
  const form = new FormData();
  form.set("file", file);
  return apiSend<ProfileDetails>("/api/v1/me/avatar", "POST", accessToken, form);
}

export async function deleteResume(accessToken: string, id: string): Promise<void> {
  await apiSend<void>(`/api/v1/me/resume/${id}`, "DELETE", accessToken);
}

export function fetchEntitlement(options: ApiGetOptions): Promise<EntitlementView> {
  return apiGet<EntitlementView>("/api/v1/entitlement", options);
}

// -- paid interviews ----------------------------------------------------------

export function fetchBilling(options: ApiGetOptions): Promise<BillingOverview> {
  return apiGet<BillingOverview>("/api/v1/billing", options);
}

/** Creates a Razorpay order for one pack. The server sets the amount. */
export function createCreditOrder(accessToken: string, packId: string): Promise<CheckoutOrder> {
  return apiSend<CheckoutOrder>("/api/v1/billing/orders", "POST", accessToken, { packId });
}

/** Hands Checkout's result to the server, which verifies it and grants the interviews. */
export function confirmCreditOrder(
  accessToken: string,
  orderId: string,
  payment: ConfirmPaymentRequest,
): Promise<BillingOverview> {
  return apiSend<BillingOverview>(
    `/api/v1/billing/orders/${encodeURIComponent(orderId)}/confirm`,
    "POST",
    accessToken,
    payment,
  );
}

export const SESSION_PAGE_SIZE = 20;

export function fetchSessions(
  options: ApiGetOptions,
  page?: { limit: number; offset: number },
): Promise<SessionSummary[]> {
  const query = page ? `?limit=${page.limit}&offset=${page.offset}` : "";
  return apiGet<SessionSummary[]>(`/api/v1/sessions${query}`, options);
}

export function fetchSession(id: string, options: ApiGetOptions): Promise<SessionView> {
  return apiGet<SessionView>(`/api/v1/sessions/${id}`, options);
}

/**
 * The candidate has entered the room: the round's clock starts now, once. Returns the
 * session with the deadline to count down to; calling it again changes nothing, so a
 * reload never restarts the clock.
 */
export function beginSession(accessToken: string, id: string): Promise<SessionView> {
  return apiSend<SessionView>(`/api/v1/sessions/${id}/begin`, "POST", accessToken);
}

/**
 * One question. The room asks for this while a turn's speech is still `pending`, to
 * pick up the interviewer's voice after the question text has already been shown.
 */
export function fetchTurn(
  sessionId: string,
  turnIndex: number,
  options: ApiGetOptions,
): Promise<TurnView> {
  return apiGet<TurnView>(`/api/v1/sessions/${sessionId}/turns/${turnIndex}`, options);
}

export type InterviewClientEvent =
  | "client_phase_changed"
  | "client_heartbeat"
  | "client_page_hidden"
  | "answer_submission_started"
  | "answer_submission_failed"
  | "answer_submission_slow"
  | "browser_speech_failed"
  | "browser_speech_timed_out"
  | "question_audio_poll_timed_out"
  | "model_audio_play_rejected"
  | "model_audio_error"
  | "model_audio_stalled"
  | "model_audio_timed_out";

export type InterviewClientPhase =
  | "loading"
  | "checking"
  | "asking"
  | "answering"
  | "submitting"
  | "closing"
  | "complete"
  | "terminal"
  | "error";

/**
 * Records a privacy-safe failure marker for the live room. The server deliberately
 * accepts only this small event vocabulary: question text, transcripts, audio and
 * browser details do not belong in application logs.
 */
export function reportInterviewClientEvent(
  accessToken: string,
  sessionId: string,
  event: InterviewClientEvent,
  turnIndex?: number,
  durationMs?: number,
  requestId?: string,
  phase?: InterviewClientPhase,
): Promise<void> {
  return apiSend<void>(`/api/v1/sessions/${sessionId}/client-events`, "POST", accessToken, {
    event,
    ...(turnIndex === undefined ? {} : { turnIndex }),
    ...(durationMs === undefined ? {} : { durationMs }),
    ...(requestId === undefined ? {} : { requestId }),
    ...(phase === undefined ? {} : { phase }),
  });
}

/**
 * Sends a batch of integrity counts for an assigned round (campus module 5). Only the event
 * type and, for a paste, its length — never what was pasted or where the student went.
 *
 * `keepalive` lets the request outlive the page, for the flush on `pagehide`. It is a fetch
 * rather than `navigator.sendBeacon` because a beacon cannot carry the bearer token.
 */
export async function sendIntegrityEvents(
  accessToken: string,
  sessionId: string,
  batch: IntegrityEventBatch,
  options: { keepalive?: boolean } = {},
): Promise<void> {
  const path = `/api/v1/sessions/${encodeURIComponent(sessionId)}/integrity-events`;
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(batch),
    ...(options.keepalive ? { keepalive: true } : {}),
  });
  if (!response.ok) {
    throw new ApiRequestError(response.status, "integrity_events_failed", `Request to ${path} failed with status ${response.status}.`);
  }
}

/** The student's own integrity summary for one round; `recorded` is false unless it was assigned. */
export function fetchIntegrity(sessionId: string, options: ApiGetOptions): Promise<IntegritySummary> {
  return apiGet<IntegritySummary>(`/api/v1/sessions/${encodeURIComponent(sessionId)}/integrity`, options);
}

export function fetchReport(id: string, options: ApiGetOptions): Promise<SessionReport> {
  return apiGet<SessionReport>(`/api/v1/sessions/${id}/report`, options);
}

export function fetchReadiness(options: ApiGetOptions): Promise<ReadinessGroup[]> {
  return apiGet<ReadinessGroup[]>("/api/v1/readiness", options);
}

// -- question bank ----------------------------------------------------------

/** Every company with at least one sourced question. */
export function fetchBankCompanies(options: ApiGetOptions): Promise<BankCompany[]> {
  return apiGet<BankCompany[]>("/api/v1/question-bank/companies", options);
}

/** One page of a company's sourced questions, optionally one round type. 404 for an unknown slug. */
export function fetchBankQuestions(
  company: string,
  query: { roundType?: RoundType | null; limit?: number; offset?: number },
  options: ApiGetOptions,
): Promise<BankQuestionPage> {
  const params = new URLSearchParams({ company });
  if (query.roundType) params.set("roundType", query.roundType);
  if (query.limit !== undefined) params.set("limit", String(query.limit));
  if (query.offset !== undefined) params.set("offset", String(query.offset));
  return apiGet<BankQuestionPage>(`/api/v1/question-bank?${params.toString()}`, options);
}

// -- the loop brief and prep plan --------------------------------------------

/** How this company interviews for this role: sourced stages, the general pattern, bank coverage. */
export function fetchLoopBrief(
  query: { company: string; role?: string; level?: string },
  options: ApiGetOptions,
): Promise<LoopBrief> {
  const params = new URLSearchParams({ company: query.company });
  if (query.role) params.set("role", query.role);
  if (query.level) params.set("level", query.level);
  return apiGet<LoopBrief>(`/api/v1/loop-brief?${params.toString()}`, options);
}

/** The ordered practice plan for this company and role. Computed fresh every call. */
export function fetchPrepPlan(
  query: { company: string; role?: string; level?: string },
  options: ApiGetOptions,
): Promise<PrepPlan> {
  const params = new URLSearchParams({ company: query.company });
  if (query.role) params.set("role", query.role);
  if (query.level) params.set("level", query.level);
  return apiGet<PrepPlan>(`/api/v1/prep-plan?${params.toString()}`, options);
}

/**
 * Reads one line of intent into a draft round. Creates nothing — the candidate corrects
 * the draft and starts the session through `startSession` like anyone else.
 */
export function composeRound(accessToken: string, query: string): Promise<RoundDraft> {
  return apiSend<RoundDraft>("/api/v1/round-drafts", "POST", accessToken, { query });
}

export function startSession(accessToken: string, request: StartSessionRequest): Promise<SessionView> {
  return apiSend<SessionView>("/api/v1/sessions", "POST", accessToken, request);
}

/**
 * Asks the interviewer for a nudge on the current question. One per question, and it
 * goes on the record — the API is the authority on both.
 */
export function requestHint(
  accessToken: string,
  sessionId: string,
  turnIndex: number,
  requestId: string,
): Promise<HintView> {
  return apiSend<HintView>(
    `/api/v1/sessions/${sessionId}/turns/${turnIndex}/hint?requestId=${encodeURIComponent(requestId)}`,
    "POST",
    accessToken,
  );
}

/**
 * Stores what the candidate has on the board — the code they wrote, or the design they
 * drew — so a reload does not lose it (PRD 06).
 *
 * Called repeatedly while they work, so it is deliberately quiet: a failed save is not
 * worth interrupting somebody mid-thought over, and the next one will carry the same
 * state anyway.
 */
export function saveBoard(accessToken: string, id: string, board: unknown): Promise<void> {
  return apiSend<void>(`/api/v1/sessions/${id}/board`, "PUT", accessToken, board);
}

/** Runs the candidate's code for a round they own. Java only; Python runs in the browser. */
export function runCode(
  accessToken: string,
  id: string,
  request: RunCodeRequest,
): Promise<CodeRunResult> {
  return apiSend<CodeRunResult>(`/api/v1/sessions/${id}/run`, "POST", accessToken, request);
}

/** Runs a course reader's code outside any round. Java only in practice; Python runs in the browser. */
export function runCourseCode(accessToken: string, request: RunCodeRequest): Promise<CodeRunResult> {
  return apiSend<CodeRunResult>("/api/v1/code/run", "POST", accessToken, request);
}

/**
 * Ends the round now and completes it, so the report is written from what has been
 * answered so far. The opposite of [abandonSession], which forfeits it.
 */
export function finishSession(accessToken: string, id: string): Promise<SubmitAnswerResponse> {
  return apiSend<SubmitAnswerResponse>(`/api/v1/sessions/${id}/finish`, "POST", accessToken);
}

export function abandonSession(accessToken: string, id: string): Promise<void> {
  return apiSend<void>(`/api/v1/sessions/${id}/abandon`, "POST", accessToken);
}

/**
 * Deletes one past round: the transcript, the report and the recordings.
 *
 * Irreversible, and there is nothing behind it to restore from — confirm before calling
 * it. The server takes the owner from the token, so a round that is not the caller's
 * comes back as a 404 rather than a refusal.
 */
export async function deleteSession(accessToken: string, id: string): Promise<void> {
  await apiSend<void>(`/api/v1/sessions/${id}`, "DELETE", accessToken);
}

/** Deletes the caller's whole account, its stored files and its sign-in. Cannot be undone. */
export async function deleteAccount(accessToken: string): Promise<void> {
  await apiSend<void>("/api/v1/me", "DELETE", accessToken);
}

/** Uploads one spoken answer. Camera preview frames never leave the browser. */
export function submitAnswer(
  accessToken: string,
  sessionId: string,
  turnIndex: number,
  audio: Blob,
  requestId: string,
  speaksLocally = false,
  /** Submit pressed mid-answer: assess this answer as the last one and end the round. */
  endRound = false,
  /** Speech timing measured from the microphone level; omitted when it could not be measured. */
  timing: AnswerTiming | null = null,
): Promise<SubmitAnswerResponse> {
  const form = new FormData();
  form.append("turnIndex", String(turnIndex));
  form.append("requestId", requestId);
  form.append("endRound", String(endRound));
  // Told per turn rather than per session: it describes this browser, and the same
  // candidate may come back on a phone with no usable voice.
  form.append("speaksLocally", String(speaksLocally));
  if (timing) form.append("timing", JSON.stringify(timing));
  form.append("audio", audio, "answer.webm");
  return apiSend<SubmitAnswerResponse>(`/api/v1/sessions/${sessionId}/turns`, "POST", accessToken, form);
}

// -- course progress ---------------------------------------------------------

/** `GET /api/v1/me/course-progress` — every chapter this candidate has finished. */
export function fetchCourseProgress(options: ApiGetOptions): Promise<CourseProgressView> {
  return apiGet<CourseProgressView>("/api/v1/me/course-progress", options);
}

/** Idempotent: marking a finished chapter finished again is a no-op, not an error. */
export function markChapterComplete(
  accessToken: string,
  courseSlug: string,
  chapterSlug: string,
): Promise<void> {
  return apiSend<void>(
    `/api/v1/me/course-progress/${encodeURIComponent(courseSlug)}/${encodeURIComponent(chapterSlug)}`,
    "PUT",
    accessToken,
  );
}

export function markChapterIncomplete(
  accessToken: string,
  courseSlug: string,
  chapterSlug: string,
): Promise<void> {
  return apiSend<void>(
    `/api/v1/me/course-progress/${encodeURIComponent(courseSlug)}/${encodeURIComponent(chapterSlug)}`,
    "DELETE",
    accessToken,
  );
}

/** A one-off union of progress saved in this browser before it was account-backed. */
export function importCourseProgress(
  accessToken: string,
  body: ImportCourseProgressRequest,
): Promise<CourseProgressView> {
  return apiSend<CourseProgressView>("/api/v1/me/course-progress/import", "POST", accessToken, body);
}

// -- arena progress ----------------------------------------------------------

/** `GET /api/v1/me/arena` — XP, streak, badges and the review schedule. */
export function fetchArenaProgress(options: ApiGetOptions): Promise<ArenaProgressView> {
  return apiGet<ArenaProgressView>("/api/v1/me/arena", options);
}

export function fetchScenarioCourseProgress(course: string, options: ApiGetOptions): Promise<ScenarioCourseProgressView> {
  return apiGet<ScenarioCourseProgressView>(`/api/v1/me/arena/scenarios/${encodeURIComponent(course)}`, options);
}

export function startScenario(course: string, accessToken: string): Promise<ScenarioPlayView> {
  return apiSend<ScenarioPlayView>(`/api/v1/me/arena/scenarios/${encodeURIComponent(course)}/start`, "POST", accessToken);
}

export function answerScenarioStep(
  course: string, accessToken: string, stepId: string, chosenOptionId: string,
): Promise<ScenarioAnswerView> {
  return apiSend<ScenarioAnswerView>(`/api/v1/me/arena/scenarios/${encodeURIComponent(course)}/answers`, "POST", accessToken, { stepId, chosenOptionId });
}

/** Records one answered challenge. The server decides the XP and the streak. */
export function recordArenaAnswer(
  accessToken: string,
  body: RecordAnswerRequest,
): Promise<ArenaCountersView> {
  return apiSend<ArenaCountersView>("/api/v1/me/arena/answers", "POST", accessToken, body);
}

export function awardArenaBadges(
  accessToken: string,
  body: AwardBadgesRequest,
): Promise<ArenaBadgesView> {
  return apiSend<ArenaBadgesView>("/api/v1/me/arena/badges", "POST", accessToken, body);
}

/** A one-off union of Arena progress saved in this browser before it was account-backed. */
export function importArenaProgress(
  accessToken: string,
  body: ImportArenaProgressRequest,
): Promise<ArenaProgressView> {
  return apiSend<ArenaProgressView>("/api/v1/me/arena/import", "POST", accessToken, body);
}

// ---- Untiered Campus, modules 1-2 (docs/campus-api-contract.md) ----

function query(params: Record<string, string | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const text = search.toString();
  return text ? `?${text}` : "";
}

const campusOrg = (orgId: string) => `/api/v1/campus/orgs/${encodeURIComponent(orgId)}`;
const adminOrg = (orgId: string) => `/api/v1/admin/campus/orgs/${encodeURIComponent(orgId)}`;

export function fetchAdminOrgs(options: ApiGetOptions): Promise<AdminOrgSummary[]> {
  return apiGet<AdminOrgSummary[]>("/api/v1/admin/campus/orgs", options);
}

export function createAdminOrg(accessToken: string, body: CreateOrgRequest): Promise<OrgView> {
  return apiSend<OrgView>("/api/v1/admin/campus/orgs", "POST", accessToken, body);
}

export function fetchAdminOrg(orgId: string, options: ApiGetOptions): Promise<AdminOrgSummary> {
  return apiGet<AdminOrgSummary>(adminOrg(orgId), options);
}

export function updateAdminOrg(accessToken: string, orgId: string, body: AdminUpdateOrgRequest): Promise<OrgView> {
  return apiSend<OrgView>(adminOrg(orgId), "PATCH", accessToken, body);
}

export function uploadOrgLogo(accessToken: string, orgId: string, file: File): Promise<OrgView> {
  const form = new FormData();
  form.set("file", file);
  return apiSend<OrgView>(`${adminOrg(orgId)}/logo`, "PUT", accessToken, form);
}

// -- college self-registration (contract Module 13) ------------------------------

/**
 * `POST /campus/leads`, sent without a token: the person filling in /colleges has no
 * account. The answer is always `{ received: true }` whether or not we already knew of
 * the college, so there is nothing to return but success or the error.
 */
export async function submitCollegeLead(body: LeadRequest): Promise<void> {
  const response = await fetchReported("/api/v1/campus/leads", `${env.apiBaseUrl}/api/v1/campus/leads`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (response.ok) return;
  const envelope = (await response.json().catch(() => null)) as ApiError | null;
  throw reportIfServerFault(
    "/api/v1/campus/leads",
    new ApiRequestError(
      response.status,
      envelope?.error ?? "unknown_error",
      envelope?.message ?? `Request to /api/v1/campus/leads failed with status ${response.status}.`,
    ),
  );
}

const ADMIN_LEADS = "/api/v1/admin/campus/leads";
const adminLead = (leadId: string) => `${ADMIN_LEADS}/${encodeURIComponent(leadId)}`;

export function fetchAdminLeads(
  filter: { status?: LeadStatus; q?: string; cursor?: string },
  options: ApiGetOptions,
): Promise<CampusPage<LeadView>> {
  return apiGet<CampusPage<LeadView>>(`${ADMIN_LEADS}${query(filter)}`, options);
}

export function fetchAdminLead(leadId: string, options: ApiGetOptions): Promise<LeadView> {
  return apiGet<LeadView>(adminLead(leadId), options);
}

export function updateAdminLead(accessToken: string, leadId: string, body: UpdateLeadRequest): Promise<LeadView> {
  return apiSend<LeadView>(adminLead(leadId), "PATCH", accessToken, body);
}

export function deleteAdminLead(accessToken: string, leadId: string): Promise<void> {
  return apiSend<void>(adminLead(leadId), "DELETE", accessToken);
}

export function convertAdminLead(accessToken: string, leadId: string, body: ConvertLeadRequest): Promise<ConvertLeadResult> {
  return apiSend<ConvertLeadResult>(`${adminLead(leadId)}/convert`, "POST", accessToken, body);
}

export function fetchMeCampus(options: ApiGetOptions): Promise<MeCampusView> {
  return apiGet<MeCampusView>("/api/v1/me/campus", options);
}

export function fetchCampusOrg(orgId: string, options: ApiGetOptions): Promise<OrgView> {
  return apiGet<OrgView>(campusOrg(orgId), options);
}

export function updateCampusOrg(accessToken: string, orgId: string, body: CollegeUpdateOrgRequest): Promise<OrgView> {
  return apiSend<OrgView>(campusOrg(orgId), "PATCH", accessToken, body);
}

export function fetchDepartments(orgId: string, options: ApiGetOptions): Promise<DepartmentView[]> {
  return apiGet<DepartmentView[]>(`${campusOrg(orgId)}/departments`, options);
}

export function createDepartment(
  accessToken: string,
  orgId: string,
  body: { code: string; name: string },
): Promise<DepartmentView> {
  return apiSend<DepartmentView>(`${campusOrg(orgId)}/departments`, "POST", accessToken, body);
}

export function updateDepartment(
  accessToken: string,
  orgId: string,
  id: string,
  body: { code?: string; name?: string },
): Promise<DepartmentView> {
  return apiSend<DepartmentView>(`${campusOrg(orgId)}/departments/${encodeURIComponent(id)}`, "PATCH", accessToken, body);
}

export async function deleteDepartment(accessToken: string, orgId: string, id: string): Promise<void> {
  await apiSend<void>(`${campusOrg(orgId)}/departments/${encodeURIComponent(id)}`, "DELETE", accessToken);
}

export function fetchBatches(orgId: string, options: ApiGetOptions, departmentId?: string): Promise<BatchView[]> {
  return apiGet<BatchView[]>(`${campusOrg(orgId)}/batches${query({ departmentId })}`, options);
}

export function createBatch(
  accessToken: string,
  orgId: string,
  body: { departmentId: string; graduationYear: number; name: string },
): Promise<BatchView> {
  return apiSend<BatchView>(`${campusOrg(orgId)}/batches`, "POST", accessToken, body);
}

export function updateBatch(
  accessToken: string,
  orgId: string,
  id: string,
  body: { graduationYear?: number; name?: string },
): Promise<BatchView> {
  return apiSend<BatchView>(`${campusOrg(orgId)}/batches/${encodeURIComponent(id)}`, "PATCH", accessToken, body);
}

export async function deleteBatch(accessToken: string, orgId: string, id: string): Promise<void> {
  await apiSend<void>(`${campusOrg(orgId)}/batches/${encodeURIComponent(id)}`, "DELETE", accessToken);
}

export interface MemberFilter {
  role?: CampusRole;
  batchId?: string;
  departmentId?: string;
  q?: string;
  cursor?: string;
}

export function fetchMembers(orgId: string, options: ApiGetOptions, filter: MemberFilter = {}): Promise<CampusPage<MemberView>> {
  return apiGet<CampusPage<MemberView>>(`${campusOrg(orgId)}/members${query({ ...filter })}`, options);
}

export function updateMember(
  accessToken: string,
  orgId: string,
  id: string,
  body: { batchId?: string; rollNumber?: string },
): Promise<MemberView> {
  return apiSend<MemberView>(`${campusOrg(orgId)}/members/${encodeURIComponent(id)}`, "PATCH", accessToken, body);
}

export async function removeMember(accessToken: string, orgId: string, id: string): Promise<void> {
  await apiSend<void>(`${campusOrg(orgId)}/members/${encodeURIComponent(id)}`, "DELETE", accessToken);
}

export function changeMemberRole(
  accessToken: string,
  orgId: string,
  id: string,
  role: Exclude<CampusRole, "student">,
): Promise<MemberView> {
  return apiSend<MemberView>(`${campusOrg(orgId)}/members/${encodeURIComponent(id)}/role`, "PATCH", accessToken, { role });
}

export function fetchFacultyScopes(orgId: string, id: string, options: ApiGetOptions): Promise<FacultyScopesView> {
  return apiGet<FacultyScopesView>(`${campusOrg(orgId)}/members/${encodeURIComponent(id)}/faculty-scopes`, options);
}

export function saveFacultyScopes(
  accessToken: string,
  orgId: string,
  id: string,
  scopes: FacultyScopesView,
): Promise<FacultyScopesView> {
  return apiSend<FacultyScopesView>(
    `${campusOrg(orgId)}/members/${encodeURIComponent(id)}/faculty-scopes`,
    "PUT",
    accessToken,
    scopes,
  );
}

export function fetchAuditLog(orgId: string, options: ApiGetOptions, cursor?: string): Promise<CampusPage<AuditEntryView>> {
  return apiGet<CampusPage<AuditEntryView>>(`${campusOrg(orgId)}/audit-log${query({ cursor })}`, options);
}

// ---- Untiered Campus, module 3: student onboarding ----

export interface InviteFilter {
  status?: string;
  role?: CampusRole;
  batchId?: string;
  q?: string;
  cursor?: string;
}

export function fetchInvites(orgId: string, options: ApiGetOptions, filter: InviteFilter = {}): Promise<CampusPage<InviteView>> {
  return apiGet<CampusPage<InviteView>>(`${campusOrg(orgId)}/invites${query({ ...filter })}`, options);
}

export function createInvite(accessToken: string, orgId: string, body: CreateInviteRequest): Promise<InviteView> {
  return apiSend<InviteView>(`${campusOrg(orgId)}/invites`, "POST", accessToken, body);
}

export function resendInvite(accessToken: string, orgId: string, id: string): Promise<InviteView> {
  return apiSend<InviteView>(`${campusOrg(orgId)}/invites/${encodeURIComponent(id)}/resend`, "POST", accessToken);
}

export function revokeInvite(accessToken: string, orgId: string, id: string): Promise<InviteView> {
  return apiSend<InviteView>(`${campusOrg(orgId)}/invites/${encodeURIComponent(id)}/revoke`, "POST", accessToken);
}

/** Uploads a student CSV; nothing is invited until `commitImport`. */
export function uploadImport(accessToken: string, orgId: string, file: File): Promise<ImportPreview> {
  const form = new FormData();
  form.set("file", file);
  return apiSend<ImportPreview>(`${campusOrg(orgId)}/imports`, "POST", accessToken, form);
}

export function commitImport(accessToken: string, orgId: string, id: string): Promise<ImportCommitResult> {
  return apiSend<ImportCommitResult>(`${campusOrg(orgId)}/imports/${encodeURIComponent(id)}/commit`, "POST", accessToken);
}

export async function discardImport(accessToken: string, orgId: string, id: string): Promise<void> {
  await apiSend<void>(`${campusOrg(orgId)}/imports/${encodeURIComponent(id)}`, "DELETE", accessToken);
}

export function fetchAdminInvites(orgId: string, options: ApiGetOptions, cursor?: string): Promise<CampusPage<InviteView>> {
  return apiGet<CampusPage<InviteView>>(`${adminOrg(orgId)}/invites${query({ cursor })}`, options);
}

export function createAdminInvite(accessToken: string, orgId: string, body: AdminCreateInviteRequest): Promise<InviteView> {
  return apiSend<InviteView>(`${adminOrg(orgId)}/invites`, "POST", accessToken, body);
}

const inviteToken = (token: string) => `/api/v1/campus/invites/${encodeURIComponent(token)}`;

export function fetchInvitePreview(token: string, options: ApiGetOptions): Promise<InvitePreview> {
  return apiGet<InvitePreview>(inviteToken(token), options);
}

export function acceptInvite(accessToken: string, token: string, body: AcceptInviteRequest): Promise<AcceptInviteResponse> {
  return apiSend<AcceptInviteResponse>(`${inviteToken(token)}/accept`, "POST", accessToken, body);
}

export async function leaveCollege(accessToken: string): Promise<void> {
  await apiSend<void>("/api/v1/me/campus/leave", "POST", accessToken);
}

// ---- Untiered Campus, module 4: assignments ----

export function fetchArenaScenarios(orgId: string, options: ApiGetOptions): Promise<CampusScenarioOption[]> {
  return apiGet<CampusScenarioOption[]>(`${campusOrg(orgId)}/arena-scenarios`, options);
}

export function fetchAssignments(orgId: string, options: ApiGetOptions, status?: AssignmentStatus): Promise<AssignmentView[]> {
  return apiGet<AssignmentView[]>(`${campusOrg(orgId)}/assignments${query({ status })}`, options);
}

export function createAssignment(accessToken: string, orgId: string, body: AssignmentInput): Promise<AssignmentView> {
  return apiSend<AssignmentView>(`${campusOrg(orgId)}/assignments`, "POST", accessToken, body);
}

export function fetchAssignment(orgId: string, id: string, options: ApiGetOptions): Promise<AssignmentView> {
  return apiGet<AssignmentView>(`${campusOrg(orgId)}/assignments/${encodeURIComponent(id)}`, options);
}

export function updateAssignment(
  accessToken: string,
  orgId: string,
  id: string,
  body: Partial<AssignmentInput> | AssignmentPublishedPatch,
): Promise<AssignmentView> {
  return apiSend<AssignmentView>(`${campusOrg(orgId)}/assignments/${encodeURIComponent(id)}`, "PATCH", accessToken, body);
}

export function publishAssignment(accessToken: string, orgId: string, id: string): Promise<AssignmentView> {
  return apiSend<AssignmentView>(`${campusOrg(orgId)}/assignments/${encodeURIComponent(id)}/publish`, "POST", accessToken);
}

export function archiveAssignment(accessToken: string, orgId: string, id: string): Promise<AssignmentView> {
  return apiSend<AssignmentView>(`${campusOrg(orgId)}/assignments/${encodeURIComponent(id)}/archive`, "POST", accessToken);
}

export function fetchAssignmentProgress(
  orgId: string,
  id: string,
  options: ApiGetOptions,
  filter: { batchId?: string; status?: CompletionStatus } = {},
): Promise<RecipientProgress[]> {
  return apiGet<RecipientProgress[]>(`${campusOrg(orgId)}/assignments/${encodeURIComponent(id)}/progress${query({ ...filter })}`, options);
}

/** What the signed-in student has been assigned. Not behind the campus switch: answers `[]` when off. */
export function fetchMyAssignments(options: ApiGetOptions): Promise<AssignedItem[]> {
  return apiGet<AssignedItem[]>("/api/v1/me/assignments", options);
}

// ---- Untiered Campus, module 4b: MCQ tests ----

/** Bank courses with at least five live questions; never a question or a key. */
export function fetchMcqBank(orgId: string, options: ApiGetOptions): Promise<McqBankSummary[]> {
  return apiGet<McqBankSummary[]>(`${campusOrg(orgId)}/mcq-bank`, options);
}

/** Starts an attempt at an MCQ test assignment; the questions come back without their key. */
export function startMcqAttempt(accessToken: string, assignmentId: string): Promise<McqAttemptView> {
  return apiSend<McqAttemptView>(`/api/v1/me/assignments/${encodeURIComponent(assignmentId)}/mcq-attempts`, "POST", accessToken);
}

/** The student's own attempt: to resume it, or its result once submitted. */
export function fetchMcqAttempt(attemptId: string, options: ApiGetOptions): Promise<McqAttemptView> {
  return apiGet<McqAttemptView>(`/api/v1/me/mcq-attempts/${encodeURIComponent(attemptId)}`, options);
}

/** Submits the answers; the server grades them and returns the result with the review. */
export function submitMcqAttempt(accessToken: string, attemptId: string, body: McqSubmitRequest): Promise<McqAttemptView> {
  return apiSend<McqAttemptView>(`/api/v1/me/mcq-attempts/${encodeURIComponent(attemptId)}/submit`, "POST", accessToken, body);
}

/** A student's attempt, for staff. Audited as `mcq.viewed`. */
export function fetchStudentMcqAttempt(
  orgId: string,
  memberId: string,
  attemptId: string,
  options: ApiGetOptions,
): Promise<McqAttemptView> {
  return apiGet<McqAttemptView>(
    `${campusOrg(orgId)}/students/${encodeURIComponent(memberId)}/mcq-attempts/${encodeURIComponent(attemptId)}`,
    options,
  );
}

// ---- Untiered Campus, modules 6-7: readiness and the placement dashboard ----

export interface DashboardFilter {
  batchId?: string;
  departmentId?: string;
}

export interface ReadinessFilter extends DashboardFilter {
  band?: string;
  completion?: ReadinessCompletionFilter;
  sort?: ReadinessSort;
  order?: "asc" | "desc";
  cursor?: string;
}

/** Platform admin: usage and estimated AI cost per college. Dates are YYYY-MM-DD, both inclusive. */
export function fetchCampusUsage(params: { from?: string; to?: string }, options: ApiGetOptions): Promise<OrgUsageRow[]> {
  const query = new URLSearchParams();
  if (params.from) query.set("from", params.from);
  if (params.to) query.set("to", params.to);
  const suffix = query.size > 0 ? `?${query.toString()}` : "";
  return apiGet<OrgUsageRow[]>(`/api/v1/admin/campus/usage${suffix}`, options);
}

// -- Module 14: college packages and payments -------------------------------------------

const adminPackages = (orgId: string) => `${adminOrg(orgId)}/packages`;
const adminPackage = (orgId: string, packageId: string) => `${adminPackages(orgId)}/${encodeURIComponent(packageId)}`;

/** Platform admin: every package of one college. */
export function fetchAdminPackages(orgId: string, options: ApiGetOptions): Promise<AdminPackageView[]> {
  return apiGet<AdminPackageView[]>(adminPackages(orgId), options);
}

export function createAdminPackage(accessToken: string, orgId: string, body: PackageRequest): Promise<AdminPackageView> {
  return apiSend<AdminPackageView>(adminPackages(orgId), "POST", accessToken, body);
}

export function updateAdminPackage(
  accessToken: string,
  orgId: string,
  packageId: string,
  body: PackageRequest,
): Promise<AdminPackageView> {
  return apiSend<AdminPackageView>(adminPackage(orgId, packageId), "PATCH", accessToken, body);
}

export function invoiceAdminPackage(
  accessToken: string,
  orgId: string,
  packageId: string,
  body: InvoicePackageRequest,
): Promise<AdminPackageView> {
  return apiSend<AdminPackageView>(`${adminPackage(orgId, packageId)}/invoice`, "POST", accessToken, body);
}

export function payAdminPackage(accessToken: string, orgId: string, packageId: string, body: PayPackageRequest): Promise<AdminPackageView> {
  return apiSend<AdminPackageView>(`${adminPackage(orgId, packageId)}/paid`, "POST", accessToken, body);
}

export function voidAdminPackage(accessToken: string, orgId: string, packageId: string): Promise<AdminPackageView> {
  return apiSend<AdminPackageView>(`${adminPackage(orgId, packageId)}/void`, "POST", accessToken);
}

export async function deleteAdminPackage(accessToken: string, orgId: string, packageId: string): Promise<void> {
  await apiSend<void>(adminPackage(orgId, packageId), "DELETE", accessToken);
}

/** Platform admin: every college's current package, payments and cost. */
export function fetchCampusBilling(options: ApiGetOptions): Promise<CollegeBillingRow[]> {
  return apiGet<CollegeBillingRow[]>("/api/v1/admin/campus/billing", options);
}

/** College staff: the college's packages, as much as the caller's role may see. */
export function fetchCollegePackages(orgId: string, options: ApiGetOptions): Promise<CollegePackagesView> {
  return apiGet<CollegePackagesView>(`${campusOrg(orgId)}/packages`, options);
}

export function fetchMyLeaderboard(scope: LeaderboardScope, options: ApiGetOptions): Promise<LeaderboardView> {
  return apiGet<LeaderboardView>(`/api/v1/me/campus/leaderboard?scope=${scope}`, options);
}

export function setLeaderboardOptIn(accessToken: string, optIn: boolean): Promise<{ optIn: boolean }> {
  return apiSend<{ optIn: boolean }>("/api/v1/me/campus/leaderboard-preference", "PUT", accessToken, { optIn });
}

/** The signed-in student's own readiness. `404` when they are not a joined student. */
export function fetchMyReadiness(options: ApiGetOptions): Promise<StudentReadiness> {
  return apiGet<StudentReadiness>("/api/v1/me/campus/readiness", options);
}

export function fetchStudentReadiness(orgId: string, memberId: string, options: ApiGetOptions): Promise<StudentReadiness> {
  return apiGet<StudentReadiness>(`${campusOrg(orgId)}/students/${encodeURIComponent(memberId)}/readiness`, options);
}

/** The existing session report, as a college staff member may read it. */
export function fetchStaffStudentReport(orgId: string, memberId: string, sessionId: string, options: ApiGetOptions): Promise<SessionReport> {
  return apiGet<SessionReport>(
    `${campusOrg(orgId)}/students/${encodeURIComponent(memberId)}/reports/${encodeURIComponent(sessionId)}`,
    options,
  );
}

/** The integrity summary of one of the student's assigned rounds, as college staff read it. */
export function fetchStaffStudentIntegrity(
  orgId: string,
  memberId: string,
  sessionId: string,
  options: ApiGetOptions,
): Promise<IntegritySummary> {
  return apiGet<IntegritySummary>(
    `${campusOrg(orgId)}/students/${encodeURIComponent(memberId)}/reports/${encodeURIComponent(sessionId)}/integrity`,
    options,
  );
}

export function fetchReadinessWeights(orgId: string, options: ApiGetOptions): Promise<ReadinessWeights> {
  return apiGet<ReadinessWeights>(`${campusOrg(orgId)}/readiness-weights`, options);
}

export function updateReadinessWeights(accessToken: string, orgId: string, weights: ReadinessWeights): Promise<ReadinessWeights> {
  return apiSend<ReadinessWeights>(`${campusOrg(orgId)}/readiness-weights`, "PUT", accessToken, weights);
}

export function fetchDashboard(orgId: string, options: ApiGetOptions, filter: DashboardFilter = {}): Promise<DashboardView> {
  return apiGet<DashboardView>(`${campusOrg(orgId)}/dashboard${query({ ...filter })}`, options);
}

export function fetchReadinessRows(
  orgId: string,
  options: ApiGetOptions,
  filter: ReadinessFilter = {},
): Promise<CampusPage<StudentReadinessRow>> {
  return apiGet<CampusPage<StudentReadinessRow>>(`${campusOrg(orgId)}/students/readiness${query({ ...filter })}`, options);
}

/** Records that a staff member opened the printable batch report. Answers `204`. */
export async function recordBatchReportViewed(accessToken: string, orgId: string, filter: DashboardFilter = {}): Promise<void> {
  await apiSend<void>(`${campusOrg(orgId)}/exports/batch-report-viewed`, "POST", accessToken, filter);
}

/**
 * The student CSV. It needs the bearer token, so it cannot be a plain link: fetch it as a
 * Blob and let the caller save it.
 */
export async function downloadStudentsCsv(orgId: string, accessToken: string, filter: ReadinessFilter = {}): Promise<Blob> {
  const { batchId, departmentId, band, completion } = filter;
  const response = await fetchReported("/exports/students.csv", `${env.apiBaseUrl}${campusOrg(orgId)}/exports/students.csv${query({ batchId, departmentId, band, completion })}`, {
    headers: { Accept: "text/csv", Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ApiError | null;
    throw new ApiRequestError(
      response.status,
      envelope?.error ?? "unknown_error",
      envelope?.message ?? `The export failed with status ${response.status}.`,
    );
  }
  return response.blob();
}

// ---- Untiered Campus, module 8: the faculty view ----

export function fetchAttention(orgId: string, options: ApiGetOptions, reason?: AttentionReason): Promise<AttentionRow[]> {
  return apiGet<AttentionRow[]>(`${campusOrg(orgId)}/attention${query({ reason })}`, options);
}

/** Private staff notes on one student, newest first. Staff only; a student never sees them. */
export function fetchStaffComments(orgId: string, memberId: string, options: ApiGetOptions): Promise<StaffComment[]> {
  return apiGet<StaffComment[]>(`${campusOrg(orgId)}/students/${encodeURIComponent(memberId)}/comments`, options);
}

export function createStaffComment(
  accessToken: string,
  orgId: string,
  memberId: string,
  body: { body: string; sessionId?: string | null },
): Promise<StaffComment> {
  return apiSend<StaffComment>(`${campusOrg(orgId)}/students/${encodeURIComponent(memberId)}/comments`, "POST", accessToken, body);
}

export function updateStaffComment(accessToken: string, orgId: string, id: string, body: string): Promise<StaffComment> {
  return apiSend<StaffComment>(`${campusOrg(orgId)}/comments/${encodeURIComponent(id)}`, "PATCH", accessToken, { body });
}

export async function deleteStaffComment(accessToken: string, orgId: string, id: string): Promise<void> {
  await apiSend<void>(`${campusOrg(orgId)}/comments/${encodeURIComponent(id)}`, "DELETE", accessToken);
}

// ---- Untiered Campus, module 10: programmes ----

const ADMIN_TEMPLATES = "/api/v1/admin/campus/programme-templates";

export function fetchAdminProgrammeTemplates(options: ApiGetOptions): Promise<ProgrammeTemplate[]> {
  return apiGet<ProgrammeTemplate[]>(ADMIN_TEMPLATES, options);
}

export function createProgrammeTemplate(accessToken: string, body: ProgrammeTemplateInput): Promise<ProgrammeTemplate> {
  return apiSend<ProgrammeTemplate>(ADMIN_TEMPLATES, "POST", accessToken, body);
}

export function updateProgrammeTemplate(accessToken: string, id: string, body: Partial<ProgrammeTemplateInput>): Promise<ProgrammeTemplate> {
  return apiSend<ProgrammeTemplate>(`${ADMIN_TEMPLATES}/${encodeURIComponent(id)}`, "PATCH", accessToken, body);
}

export async function deleteProgrammeTemplate(accessToken: string, id: string): Promise<void> {
  await apiSend<void>(`${ADMIN_TEMPLATES}/${encodeURIComponent(id)}`, "DELETE", accessToken);
}

export function fetchProgrammeTemplates(orgId: string, options: ApiGetOptions): Promise<ProgrammeTemplate[]> {
  return apiGet<ProgrammeTemplate[]>(`${campusOrg(orgId)}/programme-templates`, options);
}

export function fetchProgrammes(orgId: string, options: ApiGetOptions): Promise<ProgrammeView[]> {
  return apiGet<ProgrammeView[]>(`${campusOrg(orgId)}/programmes`, options);
}

export function startProgramme(accessToken: string, orgId: string, body: StartProgrammeRequest): Promise<ProgrammeView> {
  return apiSend<ProgrammeView>(`${campusOrg(orgId)}/programmes`, "POST", accessToken, body);
}

export function fetchProgramme(orgId: string, id: string, options: ApiGetOptions): Promise<ProgrammeView> {
  return apiGet<ProgrammeView>(`${campusOrg(orgId)}/programmes/${encodeURIComponent(id)}`, options);
}

export function fetchProgrammeProgress(orgId: string, id: string, options: ApiGetOptions): Promise<ProgrammeProgress[]> {
  return apiGet<ProgrammeProgress[]>(`${campusOrg(orgId)}/programmes/${encodeURIComponent(id)}/progress`, options);
}

export function archiveProgramme(accessToken: string, orgId: string, id: string): Promise<ProgrammeView> {
  return apiSend<ProgrammeView>(`${campusOrg(orgId)}/programmes/${encodeURIComponent(id)}/archive`, "POST", accessToken);
}

/** The signed-in student's programmes. Not behind the campus switch: answers `[]` when off. */
export function fetchMyProgrammes(options: ApiGetOptions): Promise<MyProgrammeView[]> {
  return apiGet<MyProgrammeView[]>("/api/v1/me/programmes", options);
}

/** `404` until every module of the programme is completed. */
export function fetchMyCertificate(programmeId: string, options: ApiGetOptions): Promise<CertificateView> {
  return apiGet<CertificateView>(`/api/v1/me/programmes/${encodeURIComponent(programmeId)}/certificate`, options);
}
