"use client";

import { useEffect, useRef, type MutableRefObject } from "react";

/** The newest frame from the voice-activity model. */
export interface SpeechFrame {
  /** Probability, 0 to 1, that the frame holds speech. */
  p: number;
  /** `Date.now()` when it arrived, so a stalled model can be told from a quiet one. */
  at: number;
}

/** A model that has not produced a frame for this long is treated as gone. */
export const SPEECH_FRAME_STALE_MS = 1_000;

/** Whether a frame is recent enough to decide on; otherwise callers fall back to volume. */
export function isFresh(frame: SpeechFrame | null, now: number): frame is SpeechFrame {
  return frame !== null && now - frame.at < SPEECH_FRAME_STALE_MS;
}

/**
 * Runs Silero VAD over the room's existing microphone stream and keeps the latest speech
 * probability in a ref. Nothing here opens a second microphone, and nothing leaves the
 * browser. The library, model and wasm load lazily and only when `enabled`; if any of it
 * fails the ref simply stays stale and the room keeps using microphone volume.
 */
export function useSpeechProbability(
  stream: MediaStream | null,
  enabled: boolean,
): MutableRefObject<SpeechFrame | null> {
  const frame = useRef<SpeechFrame | null>(null);

  useEffect(() => {
    if (!enabled || !stream || stream.getAudioTracks().length === 0) return;
    let cancelled = false;
    let vad: { destroy: () => Promise<void> } | null = null;

    (async () => {
      try {
        const { MicVAD } = await import("@ricky0123/vad-web");
        const audio = new MediaStream(stream.getAudioTracks());
        const created = await MicVAD.new({
          model: "v5",
          baseAssetPath: "/vad/",
          onnxWASMBasePath: "/vad/",
          startOnLoad: true,
          getStream: async () => audio,
          // The defaults stop the tracks, which belong to the room and to the recorder.
          pauseStream: async () => {},
          resumeStream: async () => audio,
          onFrameProcessed: (probabilities) => {
            frame.current = { p: probabilities.isSpeech, at: Date.now() };
          },
        });
        if (cancelled) {
          await created.destroy();
          return;
        }
        vad = created;
      } catch {
        // Falls back to the volume rule: the ref never freshens.
        frame.current = null;
      }
    })();

    return () => {
      cancelled = true;
      frame.current = null;
      void vad?.destroy().catch(() => undefined);
    };
  }, [stream, enabled]);

  return frame;
}
