"use client";

import { runCourseCode } from "@/lib/api";
import { runJavaScript } from "@/lib/browser-javascript";
import { loadPython, runPython } from "@/lib/browser-python";
import { runOnServer } from "@/lib/server-code-runner";

export type PlaygroundLanguage = "python" | "java" | "javascript";

export interface RunOutcome {
  stdout: string;
  stderr: string;
  /** False when the interpreter itself could not be loaded, rather than the code failing. */
  available: boolean;
  /** True when the run was stopped for taking too long — most likely an endless loop. */
  timedOut: boolean;
  /** True when a server run was stopped for printing too much; the output is its start. */
  outputLimited?: boolean;
  message: string | null;
}

export interface CodeRunner {
  /**
   * Starts loading whatever the runner needs. Never called on mount — only from the
   * playground's own Run/enable handler — so opening a chapter never fetches an
   * interpreter nobody asked for yet (task 049's main perf risk).
   */
  prepare(): Promise<boolean>;
  run(source: string): Promise<RunOutcome>;
}

const pythonRunner: CodeRunner = {
  prepare: () => loadPython(),
  run: (source) => runPython(source, ""),
};

/** JavaScript needs no interpreter download: the browser already is one. */
const javascriptRunner: CodeRunner = {
  prepare: () => Promise.resolve(true),
  run: (source) => runJavaScript(source),
};

/**
 * Java on our server runner — there is still no free, unencumbered way to run it in a
 * browser (CheerpJ needs a commercial licence, DoppioJVM is dead, TeaVM's class library
 * is partial). Courses are behind sign-in, so a reader always has a token to send; until
 * it has loaded, `prepare()` says not yet rather than sending an unauthenticated run.
 */
function javaRunner(accessToken: string | null | undefined): CodeRunner {
  return {
    prepare: () => Promise.resolve(Boolean(accessToken)),
    run: (source) => runOnServer(() => runCourseCode(accessToken ?? "", { source, language: "java", stdin: "" })),
  };
}

/** One runner per supported language — the pluggable seam task 049 asks for. */
export function getRunner(language: PlaygroundLanguage, accessToken?: string | null): CodeRunner {
  if (language === "python") return pythonRunner;
  if (language === "javascript") return javascriptRunner;
  return javaRunner(accessToken);
}
