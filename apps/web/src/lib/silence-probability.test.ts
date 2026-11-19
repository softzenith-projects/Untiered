import { describe, expect, it } from "vitest";

import {
  ENDPOINT_BASE_MS,
  INITIAL_PAUSE_EMA_MS,
  MAX_ENDPOINT_MS,
  MIN_ENDPOINT_MS,
  RESUME_AFTER_SUBMIT_MS,
  SILENCE_TO_END_MS,
  SPEECH_TO_START_MS,
  dynamicSilenceMs,
  initialProbabilityState,
  initialSilenceState,
  learnPause,
  observe,
  observeProbability,
  resumedAfterSubmit,
  shouldEnd,
  shouldEndWorkspace,
  type ProbabilitySilenceState,
} from "@/lib/silence";

/** Feeds frames every 100ms from `from`, returning the state and the time after the last frame. */
function feed(state: ProbabilitySilenceState, probabilities: number[], from: number) {
  let now = from;
  for (const p of probabilities) {
    state = observeProbability(state, p, now);
    now += 100;
  }
  return { state, now };
}

const frames = (p: number, ms: number) => Array<number>(ms / 100).fill(p);

describe("speech-probability path", () => {
  it("never ends an answer before the candidate has spoken", () => {
    const { state, now } = feed(initialProbabilityState, frames(0.01, 20_000), 0);
    expect(state.hasSpoken).toBe(false);
    expect(shouldEnd(state, now, 0, 2_000)).toBe(false);
  });

  it("does not count a blip shorter than SPEECH_TO_START_MS as speech", () => {
    const { state } = feed(initialProbabilityState, [0.9, 0.9, 0.0], 0);
    expect(state.hasSpoken).toBe(false);
  });

  it("starts the silence clock once sustained speech has gone quiet, and ends after the window", () => {
    let r = feed(initialProbabilityState, frames(0.9, SPEECH_TO_START_MS + 1_000), 0);
    expect(r.state.hasSpoken).toBe(true);
    r = feed(r.state, frames(0.02, 2_000), r.now);
    expect(shouldEnd(r.state, r.now, 0, 1_900)).toBe(true);
    expect(shouldEnd(r.state, r.now, 0, 2_500)).toBe(false);
  });

  it("holds between the thresholds: neither starts nor ends speech", () => {
    let r = feed(initialProbabilityState, frames(0.9, 1_000), 0);
    r = feed(r.state, frames(0.27, 1_000), r.now);
    expect(r.state.voiced).toBe(true);
    expect(r.state.silentSince).toBeNull();

    const quiet = feed(initialProbabilityState, frames(0.27, 2_000), 0);
    expect(quiet.state.voiced).toBe(false);
    expect(quiet.state.hasSpoken).toBe(false);
  });

  it("starts speech at 0.3 and ends it below 0.25", () => {
    expect(observeProbability(initialProbabilityState, 0.3, 0).voiced).toBe(true);
    const speaking = { ...initialProbabilityState, voiced: true };
    expect(observeProbability(speaking, 0.2499, 0).voiced).toBe(false);
  });

  it("reports the pause only on the frame where speech resumes", () => {
    let r = feed(initialProbabilityState, frames(0.9, 1_000), 0);
    r = feed(r.state, frames(0.01, 1_200), r.now);
    expect(r.state.resumedPauseMs).toBeNull();
    const resumed = observeProbability(r.state, 0.9, r.now);
    expect(resumed.resumedPauseMs).toBe(r.now - r.state.silentSince!);
    expect(observeProbability(resumed, 0.9, r.now + 100).resumedPauseMs).toBeNull();
  });

  it("steady low-probability noise never counts as speech, where volume would", () => {
    let loud = observe(initialSilenceState, 0.5, 0);
    loud = observe(loud, 0.5, SPEECH_TO_START_MS);
    expect(loud.hasSpoken).toBe(true);
    const { state } = feed(initialProbabilityState, frames(0.1, 10_000), 0);
    expect(state.hasSpoken).toBe(false);
  });

  it("keeps the workspace rules unchanged on this state", () => {
    let r = feed(initialProbabilityState, frames(0.9, 1_000), 0);
    r = feed(r.state, frames(0.01, 8_100), r.now);
    expect(shouldEndWorkspace(r.state, r.now, 0, null)).toBe(true);
    expect(shouldEndWorkspace(r.state, r.now, 0, r.now - 1_000)).toBe(false);
  });
});

describe("dynamic endpointing", () => {
  it("starts at 2.0s", () => {
    expect(dynamicSilenceMs(INITIAL_PAUSE_EMA_MS)).toBe(ENDPOINT_BASE_MS + 1.5 * INITIAL_PAUSE_EMA_MS);
    expect(dynamicSilenceMs(INITIAL_PAUSE_EMA_MS)).toBe(2_000);
  });

  it("clamps to 1.5s and 4.5s", () => {
    expect(dynamicSilenceMs(0)).toBe(MIN_ENDPOINT_MS);
    expect(dynamicSilenceMs(100_000)).toBe(MAX_ENDPOINT_MS);
  });

  it("moves slowly toward a speaker's pauses (alpha 0.9)", () => {
    expect(learnPause(1_000, 2_000)).toBeCloseTo(1_100);
    let ema = 1_000;
    for (let i = 0; i < 60; i += 1) ema = learnPause(ema, 2_000);
    expect(ema).toBeGreaterThan(1_900);
    expect(dynamicSilenceMs(ema)).toBeGreaterThan(dynamicSilenceMs(1_000));
  });

  it("shortens for a brisk speaker and lengthens for a slow one", () => {
    let brisk = INITIAL_PAUSE_EMA_MS;
    let slow = INITIAL_PAUSE_EMA_MS;
    for (let i = 0; i < 60; i += 1) {
      brisk = learnPause(brisk, 400);
      slow = learnPause(slow, 3_000);
    }
    expect(dynamicSilenceMs(brisk)).toBeLessThan(2_000);
    expect(dynamicSilenceMs(slow)).toBeGreaterThan(3_500);
  });

  it("ignores gaps too short to be pauses and caps very long ones", () => {
    expect(learnPause(1_000, 150)).toBe(1_000);
    expect(learnPause(1_000, null)).toBe(1_000);
    expect(learnPause(1_000, 60_000)).toBeCloseTo(0.9 * 1_000 + 0.1 * MAX_ENDPOINT_MS);
  });

  it("learns from a pause that ended in more speech", () => {
    let r = feed(initialProbabilityState, frames(0.9, 1_000), 0);
    r = feed(r.state, frames(0.01, 2_000), r.now);
    const resumed = observeProbability(r.state, 0.9, r.now);
    const ema = learnPause(INITIAL_PAUSE_EMA_MS, resumed.resumedPauseMs);
    expect(ema).toBeGreaterThan(INITIAL_PAUSE_EMA_MS);
  });
});

describe("flag-off equivalence", () => {
  it("keeps the volume rule's default window", () => {
    expect(SILENCE_TO_END_MS).toBe(3_500);
    let s = observe(initialSilenceState, 0.5, 0);
    s = observe(s, 0.5, SPEECH_TO_START_MS);
    s = observe(s, 0, 5_000);
    expect(shouldEnd(s, 5_000 + 3_499, 0)).toBe(false);
    expect(shouldEnd(s, 5_000 + 3_500, 0)).toBe(true);
  });
});

describe("resumed after submit", () => {
  it("is a false cut-off when speech returns within the window", () => {
    expect(resumedAfterSubmit(10_000, 11_000)).toBe(true);
    expect(resumedAfterSubmit(10_000, 10_000 + RESUME_AFTER_SUBMIT_MS)).toBe(true);
  });

  it("is not once the window has passed, or before the submit", () => {
    expect(resumedAfterSubmit(10_000, 10_000 + RESUME_AFTER_SUBMIT_MS + 1)).toBe(false);
    expect(resumedAfterSubmit(10_000, 9_000)).toBe(false);
  });
});
