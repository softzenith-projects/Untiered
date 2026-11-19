import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useResumeWatch, type AutoSubmit } from "@/lib/use-resume-watch";
import type { SpeechFrame } from "@/lib/use-speech-probability";

describe("useResumeWatch", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function run(active: boolean, speakAfterMs: number | null) {
    const submit = { current: { at: Date.now(), windowMs: 2_500 } as AutoSubmit | null };
    const frames = { current: null as SpeechFrame | null };
    const onResumed = vi.fn();
    renderHook(() => useResumeWatch(active, submit, null, frames, onResumed));
    const started = Date.now();
    for (let t = 0; t < 5_000; t += 100) {
      const speaking = speakAfterMs !== null && Date.now() - started >= speakAfterMs;
      frames.current = { p: speaking ? 0.95 : 0.01, at: Date.now() };
      act(() => {
        vi.advanceTimersByTime(100);
      });
    }
    return onResumed;
  }

  it("reports the window used when the candidate speaks again within three seconds", () => {
    const onResumed = run(true, 1_000);
    expect(onResumed).toHaveBeenCalledTimes(1);
    expect(onResumed).toHaveBeenCalledWith(2_500);
  });

  it("stays quiet when they do not, when speech comes too late, or when not submitted automatically", () => {
    expect(run(true, null)).not.toHaveBeenCalled();
    expect(run(true, 4_000)).not.toHaveBeenCalled();
    expect(run(false, 1_000)).not.toHaveBeenCalled();
  });
});
