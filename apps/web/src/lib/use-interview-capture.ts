"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { type AnswerTiming, type TimingState, finishTiming, foldLevel, startTiming } from "@/lib/speech-timing";

export type CaptureState = "idle" | "requesting" | "ready" | "recording" | "denied" | "unsupported";

export interface CapturedAnswer {
  audio: Blob;
  durationMs: number;
  /**
   * When speech was heard, measured from the meter while recording (`speech-timing.ts`).
   * Null when the meter could not sample steadily; the report then says it was not measured.
   */
  timing: AnswerTiming | null;
}

interface UseInterviewCaptureOptions {
  /** Camera is only opened when the candidate consented to video. */
  withVideo: boolean;
}

/**
 * Microphone and camera capture for one interview.
 *
 * The answer is recorded as clean audio and assessed from that. **The camera is opened but
 * not recorded**, so nothing from it leaves the browser. It is on
 * so the candidate practises being looked at, facing the drawn interviewer, and that
 * benefit never leaves their own machine.
 *
 * Recording only ever starts after [start] is called, which the session screen does only
 * once consent has been recorded server-side.
 */
export function useInterviewCapture({ withVideo }: UseInterviewCaptureOptions) {
  const [state, setState] = useState<CaptureState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [level, setLevel] = useState(0);
  // Kept in state as well as a ref: the preview element needs it during render, and a
  // ref read at render time would not trigger the re-render that attaches it.
  const [stream, setStream] = useState<MediaStream | null>(null);

  const streamRef = useRef<MediaStream | null>(null);
  const audioRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef(0);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const rafRef = useRef<number | null>(null);
  // Only while an answer is being recorded; the device check before the round is not timed.
  const timingRef = useRef<TimingState | null>(null);

  const stopMeter = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }, []);

  /**
   * Drives the speaking indicator, and times the answer while one is being recorded.
   * Never gates recording.
   */
  const runMeter = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser) return;
    // Device check already owns a meter loop when recording begins. Replace it rather
    // than starting a second loop: two RAF chains double-rendered the room and folded
    // every sound sample into the answer timing twice.
    stopMeter();
    const data = new Uint8Array(analyser.frequencyBinCount);

    const tick = () => {
      analyser.getByteTimeDomainData(data);
      let peak = 0;
      for (const sample of data) {
        peak = Math.max(peak, Math.abs(sample - 128));
      }
      const level = Math.min(1, peak / 64);
      setLevel(level);
      if (timingRef.current) timingRef.current = foldLevel(timingRef.current, level, performance.now());
      rafRef.current = requestAnimationFrame(tick);
    };
    tick();
  }, [stopMeter]);

  const requestDevices = useCallback(async (): Promise<MediaStream | null> => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      setState("unsupported");
      setError("This browser cannot record audio. Try Chrome, Edge or Safari.");
      return null;
    }

    setState("requesting");
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
        video: withVideo ? { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: "user" } : false,
      });
      streamRef.current = stream;
      setStream(stream);

      const context = new AudioContext();
      const analyser = context.createAnalyser();
      analyser.fftSize = 512;
      context.createMediaStreamSource(new MediaStream(stream.getAudioTracks())).connect(analyser);
      audioContextRef.current = context;
      analyserRef.current = analyser;

      setState("ready");
      // The meter runs from the moment the device opens, not from the moment recording
      // starts. A candidate checking their microphone before the round needs to see it
      // move to believe it works, which is the whole point of the check.
      runMeter();
      return stream;
    } catch (cause) {
      setState("denied");
      setError(
        cause instanceof DOMException && cause.name === "NotAllowedError"
          ? "Microphone access was blocked. The interview is spoken, so it cannot run without it."
          : "We could not reach your microphone. Check that no other app is using it.",
      );
      return null;
    }
  }, [runMeter, withVideo]);

  const start = useCallback(async (): Promise<boolean> => {
    const stream = streamRef.current ?? (await requestDevices());
    if (!stream) return false;

    audioChunksRef.current = [];

    const audioStream = new MediaStream(stream.getAudioTracks());
    const audioRecorder = new MediaRecorder(audioStream, recorderOptions(AUDIO_TYPES, SPEECH_BITRATE));
    audioRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) audioChunksRef.current.push(event.data);
    };
    audioRecorder.start();
    audioRecorderRef.current = audioRecorder;

    startedAtRef.current = Date.now();
    timingRef.current = startTiming(performance.now());
    setState("recording");
    runMeter();
    return true;
  }, [requestDevices, runMeter]);

  const stop = useCallback(async (): Promise<CapturedAnswer | null> => {
    const audioRecorder = audioRecorderRef.current;
    if (!audioRecorder) return null;

    const durationMs = Date.now() - startedAtRef.current;
    const timing = timingRef.current ? finishTiming(timingRef.current, performance.now()) : null;
    timingRef.current = null;
    stopMeter();
    setLevel(0);

    const audio = await finish(audioRecorder, audioChunksRef);

    audioRecorderRef.current = null;
    setState("ready");

    return { audio, durationMs, timing };
  }, [stopMeter]);

  /**
   * Everything recorded so far on this answer, without stopping (PRD 06, keep-listening).
   *
   * The recorder flushes what it holds and carries on. Chunks of one recorder concatenate into
   * one valid file, so a later snapshot, or the final [stop], carries the whole answer from its
   * first word — the interviewer hears the turn as one, however many times it waited. The meter
   * and the timing keep running too; the timing returned here covers the answer up to now.
   */
  const snapshot = useCallback(async (): Promise<CapturedAnswer | null> => {
    const audioRecorder = audioRecorderRef.current;
    if (!audioRecorder || audioRecorder.state === "inactive") return null;

    const durationMs = Date.now() - startedAtRef.current;
    const timing = timingRef.current ? finishTiming(timingRef.current, performance.now()) : null;
    await flush(audioRecorder);

    const audio = new Blob(audioChunksRef.current, { type: audioRecorder.mimeType || "application/octet-stream" });
    return { audio, durationMs, timing };
  }, []);

  /** Releases the camera light and the microphone. Called on unmount and on exit. */
  const release = useCallback(() => {
    stopMeter();
    timingRef.current = null;
    audioRecorderRef.current?.stop();
    streamRef.current?.getTracks().forEach((track) => track.stop());
    void audioContextRef.current?.close().catch(() => undefined);
    streamRef.current = null;
    audioRecorderRef.current = null;
    audioContextRef.current = null;
    analyserRef.current = null;
    setStream(null);
    setState("idle");
  }, [stopMeter]);

  useEffect(() => release, [release]);

  return {
    state,
    error,
    level,
    stream,
    requestDevices,
    start,
    stop,
    snapshot,
    release,
    isRecording: state === "recording",
  };
}

const AUDIO_TYPES = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4"];

/**
 * Opus, mono, speech. Well above what the model needs to transcribe an answer or hear how
 * it was delivered, and a quarter of what the browser picks on its own.
 */
const SPEECH_BITRATE = 48_000;

/**
 * Safari and Chrome disagree on supported containers; take the first that works.
 *
 * The bitrates are set explicitly because the default is chosen for watching, and nobody
 * watches these. Every byte is one the candidate waits to upload.
 */
function recorderOptions(candidates: string[], audioBps: number): MediaRecorderOptions {
  if (typeof MediaRecorder === "undefined") return {};
  const supported = candidates.find((type) => MediaRecorder.isTypeSupported(type));
  return {
    ...(supported ? { mimeType: supported } : {}),
    audioBitsPerSecond: audioBps,
  };
}

/** A recorder that stays silent this long after `requestData` has nothing more to give. */
const FLUSH_TIMEOUT_MS = 1_000;

/**
 * Asks a running recorder for what it holds and waits for it to arrive. The recorder's own
 * `ondataavailable`, set when it started, stores the chunk; it was registered first, so it has
 * run by the time this listener resolves.
 */
function flush(recorder: MediaRecorder): Promise<void> {
  return new Promise((resolve) => {
    let timer = 0;
    const done = () => {
      window.clearTimeout(timer);
      recorder.removeEventListener("dataavailable", done);
      resolve();
    };
    timer = window.setTimeout(done, FLUSH_TIMEOUT_MS);
    recorder.addEventListener("dataavailable", done);
    try {
      recorder.requestData();
    } catch {
      done();
    }
  });
}

function finish(recorder: MediaRecorder, chunks: React.RefObject<Blob[]>): Promise<Blob> {
  return new Promise((resolve) => {
    recorder.onstop = () => {
      resolve(new Blob(chunks.current, { type: recorder.mimeType || "application/octet-stream" }));
    };
    if (recorder.state !== "inactive") {
      recorder.stop();
    } else {
      resolve(new Blob(chunks.current));
    }
  });
}
