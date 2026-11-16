"use client";

import type { IntegrityEvent } from "@untiered/shared";
import { useEffect, useRef } from "react";

import { ApiRequestError, sendIntegrityEvents } from "@/lib/api";

/*
 * Integrity signals for a round a college assigned (campus module 5).
 *
 * Three things are counted, and nothing else: the interview tab being hidden, the window
 * losing focus while the tab stays visible, and a paste into the code editor or a text field
 * (its length, never its text). The student was told exactly this on the start screen, before
 * consenting. A personal round is never watched: the room enables this only when the server
 * says the round is assigned, and the server drops anything sent for any other round.
 *
 * Nothing here shows on screen. The live room stays as empty as an interview is; there is no
 * warning, no counter, and no reaction to anything counted.
 */

/** How long events gather before they are sent together. */
export const INTEGRITY_FLUSH_MS = 10_000;
/** The longest wait between retries while the API is unreachable. */
export const INTEGRITY_MAX_BACKOFF_MS = 120_000;
/** The API's limit per request. */
export const INTEGRITY_BATCH_SIZE = 50;
/** Past this, a round is far beyond the server's caps; further events add nothing. */
const MAX_QUEUED = 1_000;
/** Long enough for a tab switch to have hidden the page, so it is counted once, as a tab switch. */
const BLUR_SETTLE_MS = 250;

type Send = (events: IntegrityEvent[], keepalive: boolean) => Promise<void>;

export interface IntegrityRecorder {
  record(event: IntegrityEvent): void;
  /** Sends everything queued now. With `keepalive`, the requests may outlive the page. */
  flush(keepalive?: boolean): Promise<void>;
  stop(): void;
}

/**
 * Queues events and sends them in batches of at most [INTEGRITY_BATCH_SIZE]. A failed send
 * keeps its events and retries with exponential backoff; a request the API refused outright
 * (a 4xx other than 408 or 429) is dropped, since sending it again would be refused again.
 */
export function createIntegrityRecorder(send: Send, flushMs: number = INTEGRITY_FLUSH_MS): IntegrityRecorder {
  let queue: IntegrityEvent[] = [];
  let timer: ReturnType<typeof setTimeout> | null = null;
  let failures = 0;
  let sending = false;
  let stopped = false;

  const schedule = (delay: number) => {
    if (stopped || timer !== null || queue.length === 0) return;
    timer = setTimeout(() => {
      timer = null;
      void sendQueued(false);
    }, delay);
  };

  const sendQueued = async (keepalive: boolean) => {
    if (sending && !keepalive) return;
    sending = true;
    try {
      while (queue.length > 0) {
        const batch = queue.slice(0, INTEGRITY_BATCH_SIZE);
        queue = queue.slice(batch.length);
        try {
          await send(batch, keepalive);
          failures = 0;
        } catch (error) {
          if (isRefused(error)) continue;
          queue = [...batch, ...queue];
          failures += 1;
          break;
        }
      }
    } finally {
      sending = false;
    }
    if (queue.length > 0) {
      schedule(Math.min(flushMs * 2 ** failures, INTEGRITY_MAX_BACKOFF_MS));
    }
  };

  return {
    record(event) {
      if (stopped || queue.length >= MAX_QUEUED) return;
      queue.push(event);
      schedule(flushMs);
    },
    flush(keepalive = false) {
      if (timer !== null) {
        clearTimeout(timer);
        timer = null;
      }
      return sendQueued(keepalive);
    },
    stop() {
      stopped = true;
      if (timer !== null) clearTimeout(timer);
      timer = null;
    },
  };
}

function isRefused(error: unknown): boolean {
  return error instanceof ApiRequestError && error.status >= 400 && error.status < 500 && error.status !== 408 && error.status !== 429;
}

/** Where a paste landed, or null when it was not into somewhere an answer is written. */
export function pasteSurface(target: EventTarget | null): "code" | "text" | null {
  if (!(target instanceof Element)) return null;
  if (target.closest(".cm-editor")) return "code";
  if (target instanceof HTMLTextAreaElement) return "text";
  if (target instanceof HTMLInputElement) return ["text", "search", ""].includes(target.type) ? "text" : null;
  if (target instanceof HTMLElement && target.isContentEditable) return "text";
  return null;
}

/**
 * Counts integrity signals while [enabled] — an assigned round that is under way — and sends
 * them for [sessionId]. Renders nothing and changes nothing on screen.
 */
export function useIntegritySignals({
  sessionId,
  accessToken,
  enabled,
  turnIndex,
}: {
  sessionId: string;
  accessToken: string | null | undefined;
  enabled: boolean;
  turnIndex: number | null;
}): void {
  const token = useRef(accessToken);
  const turn = useRef(turnIndex);
  useEffect(() => {
    token.current = accessToken;
  }, [accessToken]);
  useEffect(() => {
    turn.current = turnIndex;
  }, [turnIndex]);

  useEffect(() => {
    if (!enabled) return;
    const recorder = createIntegrityRecorder((events, keepalive) => {
      const current = token.current;
      if (!current) return Promise.reject(new Error("Not signed in yet."));
      return sendIntegrityEvents(current, sessionId, { events }, { keepalive });
    });
    const record = (event: Omit<IntegrityEvent, "at" | "turnIndex">) => {
      recorder.record({
        ...event,
        at: new Date().toISOString(),
        ...(turn.current === null ? {} : { turnIndex: turn.current }),
      });
    };

    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") record({ type: "tab_hidden" });
    };
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    const onBlur = () => {
      if (blurTimer !== null) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => {
        blurTimer = null;
        // A hidden tab is already counted as a switch, and focus moving into a frame on this
        // page is not the window losing focus.
        if (document.visibilityState === "hidden") return;
        if (document.activeElement instanceof HTMLIFrameElement) return;
        record({ type: "window_blur" });
      }, BLUR_SETTLE_MS);
    };
    const onPaste = (event: ClipboardEvent) => {
      const surface = pasteSurface(event.target);
      if (!surface) return;
      // Only the length leaves this function. The text itself is never kept or sent.
      const chars = event.clipboardData?.getData("text/plain").length ?? 0;
      record({ type: "paste", surface, chars });
    };
    const onPageHide = () => {
      void recorder.flush(true);
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("blur", onBlur);
    document.addEventListener("paste", onPaste, true);
    window.addEventListener("pagehide", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("blur", onBlur);
      document.removeEventListener("paste", onPaste, true);
      window.removeEventListener("pagehide", onPageHide);
      if (blurTimer !== null) clearTimeout(blurTimer);
      // The round ended or the room closed: send what is left, then stop.
      void recorder.flush().finally(() => recorder.stop());
    };
  }, [enabled, sessionId]);
}
