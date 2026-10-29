import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

import { JAVASCRIPT_WORKER_SOURCE } from "@/lib/javascript-runtime";

/**
 * Test-only helpers for the JavaScript runtime: run a program through the exact worker
 * source the browser starts, and run it through the real `node`, so a test can hold the
 * two to each other — and a lesson's pasted output to both.
 */

export interface ProgramOutput {
  stdout: string;
  stderr: string;
}

/** Evaluates the shipped worker source in a fresh VM context standing in for a Worker. */
export function runInWorkerSource(source: string, timeoutMs = 4_000): Promise<ProgramOutput> {
  return new Promise((resolve) => {
    const stdout: string[] = [];
    const stderr: string[] = [];
    const handles = new Set<ReturnType<typeof setTimeout>>();
    const done = () => {
      clearTimeout(deadline);
      for (const handle of handles) clearTimeout(handle);
      resolve({ stdout: stdout.join("\n"), stderr: stderr.join("\n") });
    };
    const deadline = setTimeout(() => {
      stderr.push("(timed out)");
      done();
    }, timeoutMs);

    const self: Record<string, unknown> = {
      setTimeout: (fn: () => void, ms?: number) => {
        const handle = setTimeout(fn, ms);
        handles.add(handle);
        return handle;
      },
      clearTimeout: (handle: ReturnType<typeof setTimeout>) => clearTimeout(handle),
      setInterval: (fn: () => void, ms?: number) => {
        const handle = setInterval(fn, ms);
        handles.add(handle as unknown as ReturnType<typeof setTimeout>);
        return handle;
      },
      clearInterval: (handle: ReturnType<typeof setInterval>) => clearInterval(handle),
      queueMicrotask: (fn: () => void) => queueMicrotask(fn),
      postMessage: (message: { type: string; stream?: string; text?: string }) => {
        if (message.type === "line") (message.stream === "stderr" ? stderr : stdout).push(message.text ?? "");
        else if (message.type === "done") done();
      },
    };
    const context = vm.createContext(self);
    vm.runInContext("var self = this;", context);
    vm.runInContext(JAVASCRIPT_WORKER_SOURCE, context);
    (self.onmessage as (event: { data: unknown }) => void)({ data: { id: 1, source } });
  });
}

/** Runs a program under the real `node`, as a CommonJS file — what a lesson's author ran. */
export function runInNode(source: string): ProgramOutput {
  const dir = mkdtempSync(join(tmpdir(), "js-course-"));
  try {
    const file = join(dir, "program.js");
    writeFileSync(file, source);
    const result = spawnSync(process.execPath, [file], { encoding: "utf8", timeout: 10_000 });
    return { stdout: result.stdout.replace(/\r\n/g, "\n").trimEnd(), stderr: result.stderr.replace(/\r\n/g, "\n").trimEnd() };
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
