import * as Sentry from "@sentry/nextjs";
import type {
  ApiError,
  ArenaBadgesView,
  ArenaCountersView,
  ArenaProgressView,
  AwardBadgesRequest,
  BankCompany,
  BankQuestionPage,
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
  const response = await fetchRead(
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

  if (!response.ok) {
    const envelope = (await response.json().catch(() => null)) as ApiError | null;
    throw reportIfServerFault(
      path,
      new ApiRequestError(
        response.status,
        envelope?.error ?? "unknown_error",
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
  const response = await fetch(`${env.apiBaseUrl}${path}`, {
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
    const envelope = (await response.json().catch(() => null)) as ApiError | null;
    throw reportIfServerFault(
      path,
      new ApiRequestError(
        response.status,
        envelope?.error ?? "unknown_error",
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
}

export type EmailPreferenceChoices = Pick<EmailPreferences, "dailyQuestion" | "announcements" | "reengagement">;

export function fetchEmailPreferences(options: ApiGetOptions): Promise<EmailPreferences> {
  return apiGet<EmailPreferences>("/api/v1/me/email-preferences", options);
}

export function updateEmailPreferences(accessToken: string, choices: EmailPreferenceChoices): Promise<EmailPreferences> {
  return apiSend<EmailPreferences>("/api/v1/me/email-preferences", "PUT", accessToken, choices);
}

export async function unsubscribeEmail(token: string): Promise<void> {
  const response = await fetch(`${env.apiBaseUrl}/api/v1/email/unsubscribe/${encodeURIComponent(token)}`, { method: "POST" });
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
