"use client";

import { JAVASCRIPT_WORKER_SOURCE } from "@/lib/javascript-runtime";

/**
 * JavaScript, run in the reader's own browser — in a Web Worker, never on the page, for
 * the same reason Python is (`browser-python.ts`): a loop that never ends must stall a
 * worker, not the chapter.
 *
 * Unlike Python there is nothing to download, so every run gets a brand-new worker and
 * throws it away afterwards. That is what keeps one run's `const` or forgotten
 * `setInterval` from leaking into the next, and it costs a few milliseconds.
 */

/** Lessons finish in milliseconds; a run near this is a loop or an interval that never stops. */
export const JAVASCRIPT_RUN_TIMEOUT_MS = 6_000;

export interface JavaScriptRunResult {
  stdout: string;
  stderr: string;
  available: boolean;
  timedOut: boolean;
  message: string | null;
}

type WorkerLine = { id: number; type: "line"; stream: "stdout" | "stderr"; text: string } | { id: number; type: "done" };

let nextId = 0;

export function runJavaScript(source: string): Promise<JavaScriptRunResult> {
  let worker: Worker;
  try {
    const url = URL.createObjectURL(new Blob([JAVASCRIPT_WORKER_SOURCE], { type: "text/javascript" }));
    worker = new Worker(url);
    URL.revokeObjectURL(url);
  } catch {
    return Promise.resolve({
      stdout: "",
      stderr: "",
      available: false,
      timedOut: false,
      message: "This browser could not start a sandbox for your code. Try another browser, or read through the code instead.",
    });
  }

  const id = ++nextId;
  const stdout: string[] = [];
  const stderr: string[] = [];

  return new Promise((resolve) => {
    const finish = (timedOut: boolean, crashed = false) => {
      window.clearTimeout(timer);
      worker.terminate();
      resolve({
        stdout: stdout.join("\n").trim(),
        stderr: stderr.join("\n").trim(),
        available: true,
        timedOut,
        // Output streams line by line, so what printed before the stop is still shown.
        message: timedOut
          ? `Stopped after ${JAVASCRIPT_RUN_TIMEOUT_MS / 1000} seconds — that usually means a loop that never ends, ` +
            "or a setInterval that is never cleared. Your code is untouched."
          : crashed
            ? "Your code stopped the sandbox unexpectedly. It is untouched; press Run to try again."
            : null,
      });
    };
    const timer = window.setTimeout(() => finish(true), JAVASCRIPT_RUN_TIMEOUT_MS);
    worker.onmessage = (event: MessageEvent<WorkerLine>) => {
      const data = event.data;
      if (data?.id !== id) return;
      if (data.type === "line") (data.stream === "stderr" ? stderr : stdout).push(data.text);
      else finish(false);
    };
    worker.onerror = (event) => {
      event.preventDefault();
      finish(false, true);
    };
    worker.postMessage({ id, source });
  });
}
