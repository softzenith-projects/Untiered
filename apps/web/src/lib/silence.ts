/**
 * Deciding when a spoken answer has ended.
 *
 * Clicking "done answering" is the tell that this is a form rather than an interview:
 * nobody presses a button when they stop talking to a person. The round should notice
 * the silence itself.
 *
 * Getting this wrong in either direction is costly, so the rules are deliberately
 * conservative:
 *
 * - **Never cut someone off who has not started.** A candidate who takes ten seconds to
 *   think before their first word is doing the right thing, and the clock on silence
 *   does not start until they have actually spoken.
 * - **Never mistake a pause for an ending.** People pause mid-answer to think, and
 *   under pressure they pause for longer than they realise. The window is well past
 *   conversational, and any sound at all resets it.
 * - **Allow silent work.** In coding and design rounds, a longer quiet window also waits
 *   for editing or drawing to stop before the interviewer comes back in.
 */

/** Level above which we treat the microphone as carrying speech rather than room noise. */
export const SPEECH_LEVEL = 0.08;

/** How long a silence has to last, once they have spoken, before the answer is taken as finished. */
export const SILENCE_TO_END_MS = 3_500;

/** A workspace answer includes quiet thinking between speaking, typing and drawing. */
export const WORKSPACE_SILENCE_TO_END_MS = 8_000;

/** Wait after the last editor or board change before taking the floor. */
export const WORKSPACE_ACTIVITY_GRACE_MS = 12_000;

/** Nothing ends an answer in its first moments, however quiet it is. */
export const MINIMUM_ANSWER_MS = 2_000;

/**
 * Sound must persist this long before it counts as the candidate starting. A chair bump,
 * notification or one noisy analyser frame must not begin the silence countdown while
 * somebody is still thinking about the question.
 */
export const SPEECH_TO_START_MS = 400;

export interface SilenceState {
  /** Whether the candidate has said anything at all yet. */
  hasSpoken: boolean;
  /** When the current run of silence began, or null if sound is being heard. */
  silentSince: number | null;
  /** When sustained sound began, until it is long enough to count as speech. */
  loudSince: number | null;
}

export const initialSilenceState: SilenceState = { hasSpoken: false, silentSince: null, loudSince: null };

/**
 * Folds one meter reading into the running state. Pure, so the thresholds above can be
 * tested without a microphone.
 */
export function observe(state: SilenceState, level: number, now: number): SilenceState {
  if (level >= SPEECH_LEVEL) {
    if (state.hasSpoken) return { hasSpoken: true, silentSince: null, loudSince: null };
    const loudSince = state.loudSince ?? now;
    if (now - loudSince >= SPEECH_TO_START_MS) {
      return { hasSpoken: true, silentSince: null, loudSince: null };
    }
    return { hasSpoken: false, silentSince: null, loudSince };
  }
  if (!state.hasSpoken) {
    return state.loudSince === null ? state : { ...state, loudSince: null };
  }
  return { hasSpoken: true, silentSince: state.silentSince ?? now, loudSince: null };
}

/** Whether the answer should now be submitted on its own. */
export function shouldEnd(
  state: SilenceState,
  now: number,
  startedAt: number,
  silenceMs = SILENCE_TO_END_MS,
): boolean {
  if (!state.hasSpoken || state.silentSince === null) return false;
  if (now - startedAt < MINIMUM_ANSWER_MS) return false;
  return now - state.silentSince >= silenceMs;
}

/** Workspace turns finish once both speech and visible work have settled. */
export function shouldEndWorkspace(
  state: SilenceState,
  now: number,
  startedAt: number,
  lastWorkAt: number | null,
): boolean {
  if (!shouldEnd(state, now, startedAt, WORKSPACE_SILENCE_TO_END_MS)) return false;
  return lastWorkAt === null || now - lastWorkAt >= WORKSPACE_ACTIVITY_GRACE_MS;
}

/*
 * Speech-probability endpointing (PRD §interview, voice loop).
 *
 * The volume rule above never ends an answer in a noisy room and is slow for a brisk
 * speaker. This path takes a speech probability from a voice-activity model instead, and
 * learns how long this candidate pauses within an answer.
 *
 * The dynamic silence window is adapted from LiveKit Agents' `DynamicEndpointing`
 * (livekit-agents/livekit/agents/voice/endpointing.py, Apache-2.0,
 * https://github.com/livekit/agents): an exponential moving average of the pauses a speaker
 * takes between their own utterances, carried across turns. See docs/third-party-sources.md.
 */

/** Probability at or above which a frame counts as speech (vad-web's default positive threshold). */
export const SPEECH_PROBABILITY_START = 0.3;

/** Probability below which a speaking frame counts as silence again. Between the two, hold. */
export const SPEECH_PROBABILITY_END = 0.25;

/** Weight on the previous average in the moving average; the newest pause gets the rest. */
export const PAUSE_EMA_ALPHA = 0.9;

/** The average a candidate starts with: a 2.5s window until we have seen them pause. */
export const INITIAL_PAUSE_EMA_MS = 1_000;

/** Fixed part of the silence window, before the learned pause is added. */
export const ENDPOINT_BASE_MS = 1_000;

/** How many of the candidate's own typical pauses the window allows on top of the base. */
export const ENDPOINT_PAUSE_MULTIPLIER = 1.5;

/** The window never gets shorter than this, however brisk the speaker. */
export const MIN_ENDPOINT_MS = 2_000;

/** The window never gets longer than this, however slow the speaker. */
export const MAX_ENDPOINT_MS = 4_500;

/** A gap shorter than this is breath or a stop consonant, not a pause worth learning from. */
export const MIN_LEARNABLE_PAUSE_MS = 300;

/** If speech resumes within this long of an automatic submit, the answer was cut off. */
export const RESUME_AFTER_SUBMIT_MS = 3_000;

export interface ProbabilitySilenceState extends SilenceState {
  /** Hysteresis memory: whether the previous frame was inside speech. */
  voiced: boolean;
  /**
   * Set only on the frame where speech resumed after a pause within the answer: how long
   * that pause was. The caller feeds it to `learnPause`.
   */
  resumedPauseMs: number | null;
}

export const initialProbabilityState: ProbabilitySilenceState = {
  ...initialSilenceState,
  voiced: false,
  resumedPauseMs: null,
};

/**
 * Folds one speech-probability frame into the running state. Hysteresis stops a
 * probability hovering near one threshold from flickering between speech and silence.
 * The "has spoken" and "silent since" bookkeeping is shared with the volume rule, so
 * `SPEECH_TO_START_MS` still applies and nothing ends before they have spoken.
 */
export function observeProbability(
  state: ProbabilitySilenceState,
  probability: number,
  now: number,
): ProbabilitySilenceState {
  const voiced = probability >= SPEECH_PROBABILITY_START
    ? true
    : probability < SPEECH_PROBABILITY_END
      ? false
      : state.voiced;
  const next = observe(state, voiced ? 1 : 0, now);
  const resumed = voiced && state.hasSpoken && state.silentSince !== null;
  return {
    ...next,
    voiced,
    resumedPauseMs: resumed ? now - state.silentSince! : null,
  };
}

/**
 * Updates the learned pause length. Pauses too short to be pauses are ignored, and one
 * longer than the window can ever be is capped so a single long think does not drag it up.
 */
export function learnPause(emaMs: number, pauseMs: number | null): number {
  if (pauseMs === null || pauseMs < MIN_LEARNABLE_PAUSE_MS) return emaMs;
  const capped = Math.min(pauseMs, MAX_ENDPOINT_MS);
  return PAUSE_EMA_ALPHA * emaMs + (1 - PAUSE_EMA_ALPHA) * capped;
}

/** Silence needed to end a spoken (non-workspace) answer, given this candidate's average pause. */
export function dynamicSilenceMs(emaMs: number): number {
  const window = ENDPOINT_BASE_MS + ENDPOINT_PAUSE_MULTIPLIER * emaMs;
  return Math.min(MAX_ENDPOINT_MS, Math.max(MIN_ENDPOINT_MS, window));
}

/** Whether speech began again soon enough after an automatic submit to call it a false cut-off. */
export function resumedAfterSubmit(submittedAt: number, speechAt: number): boolean {
  const elapsed = speechAt - submittedAt;
  return elapsed >= 0 && elapsed <= RESUME_AFTER_SUBMIT_MS;
}
