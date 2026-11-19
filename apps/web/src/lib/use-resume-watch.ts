"use client";

import { useEffect, type MutableRefObject } from "react";

import {
  RESUME_AFTER_SUBMIT_MS,
  initialProbabilityState,
  initialSilenceState,
  observe,
  observeProbability,
  resumedAfterSubmit,
} from "@/lib/silence";
import { isFresh, type SpeechFrame } from "@/lib/use-speech-probability";

const WATCH_TICK_MS = 100;

/** An answer the room submitted on its own, and the silence window that triggered it. */
export interface AutoSubmit {
  at: number;
  windowMs: number;
}

/**
 * After an automatic submit, listens for the candidate speaking again while the interviewer
 * is still thinking. That means the silence window cut them off mid-thought, and the window
 * used is reported so it can be tuned. Runs flag on or off: with the voice model it reads
 * the same speech probability; without it, a small meter on the room's existing stream.
 */
export function useResumeWatch(
  active: boolean,
  submit: MutableRefObject<AutoSubmit | null>,
  stream: MediaStream | null,
  frames: MutableRefObject<SpeechFrame | null>,
  onResumed: (windowMs: number) => void,
): void {
  useEffect(() => {
    const auto = submit.current;
    if (!active || !auto) return;

    let analyser: AnalyserNode | null = null;
    let context: AudioContext | null = null;
    if (stream && typeof AudioContext !== "undefined") {
      try {
        context = new AudioContext();
        analyser = context.createAnalyser();
        analyser.fftSize = 512;
        context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
      } catch {
        analyser = null;
      }
    }
    const data = analyser ? new Uint8Array(analyser.frequencyBinCount) : null;

    let volume = initialSilenceState;
    let probability = initialProbabilityState;
    let reported = false;

    const id = setInterval(() => {
      const now = Date.now();
      if (now - auto.at > RESUME_AFTER_SUBMIT_MS) {
        clearInterval(id);
        return;
      }
      const frame = frames.current;
      let spoke: boolean;
      if (isFresh(frame, now)) {
        probability = observeProbability(probability, frame.p, now);
        spoke = probability.hasSpoken;
      } else if (analyser && data) {
        analyser.getByteTimeDomainData(data);
        let peak = 0;
        for (const sample of data) peak = Math.max(peak, Math.abs(sample - 128));
        volume = observe(volume, Math.min(1, peak / 64), now);
        spoke = volume.hasSpoken;
      } else {
        spoke = false;
      }
      if (spoke && !reported && resumedAfterSubmit(auto.at, now)) {
        reported = true;
        clearInterval(id);
        onResumed(auto.windowMs);
      }
    }, WATCH_TICK_MS);

    return () => {
      clearInterval(id);
      void context?.close().catch(() => undefined);
    };
  }, [active, submit, stream, frames, onResumed]);
}
