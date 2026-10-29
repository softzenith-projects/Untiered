"use client";

import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useId, useMemo, useState } from "react";

import { matchesExpected } from "@/lib/browser-python";
import { getRunner } from "@/lib/course-code-runner";
import { useAccessToken } from "@/lib/use-access-token";
import type { Block } from "@/content/courses/types";
import { InlineText } from "@/components/courses/inline-text";
import { LESSON_BUTTON, LESSON_BUTTON_PRIMARY, LessonLabel, LessonPanel } from "@/components/courses/lesson-box";
import { CopyCodeButton } from "@/components/courses/copy-code-button";

type PlaygroundBlockData = Extract<Block, { kind: "playground" }>;

type Phase = "idle" | "loading" | "running";

interface RunOutput {
  stdout: string;
  stderr: string;
  message: string | null;
  timedOut: boolean;
  /** null when there is nothing to compare against, or the run didn't produce a clean result. */
  matchesExpected: boolean | null;
}

/**
 * The "try it yourself" block (task 049): an editable CodeMirror seeded from `block.starter`,
 * Run/Reset, and stdout/stderr shown distinctly.
 *
 * The static, server-rendered code sample right above this (see `block-renderer.tsx`) is
 * what a reader with JS off, or a search engine, actually sees — this component is a
 * progressive-enhancement layer on top of it, never the only copy of the content, per
 * task 049. It never fetches Pyodide on its own: `getRunner().prepare()` below is only
 * ever called from the Run click.
 */
export function Playground({ block }: { block: PlaygroundBlockData }) {
  const [source, setSource] = useState(block.starter);
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<RunOutput | null>(null);
  const outputId = useId();
  const editorLabel = `Editable ${block.language} code`;

  const accessToken = useAccessToken();
  const runner = useMemo(() => getRunner(block.language, accessToken), [block.language, accessToken]);
  const extensions = useMemo(() => [block.language === "java" ? java() : python()], [block.language]);

  const handleRun = useCallback(async () => {
    setPhase("loading");
    const ready = await runner.prepare();
    if (!ready) {
      setPhase("idle");
      setResult({
        stdout: "",
        stderr: "",
        message:
          block.language === "java"
            ? "Java runs on our server, and you need to be signed in for that. Sign in again, then press Run."
            : "Python could not be loaded here. Try again, or read through the code instead.",
        timedOut: false,
        matchesExpected: null,
      });
      return;
    }
    setPhase("running");
    const outcome = await runner.run(source);
    setPhase("idle");
    setResult({
      stdout: outcome.stdout,
      stderr: outcome.stderr,
      message: outcome.message,
      timedOut: outcome.timedOut,
      matchesExpected:
        block.expectedOutput && outcome.available && !outcome.timedOut && !outcome.stderr
          ? matchesExpected(outcome.stdout, block.expectedOutput)
          : null,
    });
  }, [runner, source, block.expectedOutput, block.language]);

  const handleReset = useCallback(() => {
    setSource(block.starter);
    setResult(null);
  }, [block.starter]);

  return (
    <LessonPanel label="Try it yourself" flush>
      {block.prompt ? (
        <p className="border-b border-line px-5 py-3 text-body leading-relaxed text-ink sm:px-6">
          <InlineText text={block.prompt} />
        </p>
      ) : null}

      <div className="min-h-[8rem]">
        <CodeMirror
          value={source}
          extensions={extensions}
          onChange={setSource}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
          aria-label={editorLabel}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line px-5 py-3 sm:px-6">
        <CopyCodeButton code={source} />

        <button
          type="button"
          onClick={handleReset}
          className={LESSON_BUTTON}
        >
          Reset to original
        </button>

        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={phase !== "idle"}
          aria-describedby={outputId}
          className={LESSON_BUTTON_PRIMARY}
        >
          {phase === "loading" && block.language === "python" ? "Loading Python…" : phase === "idle" ? "Run" : "Running…"}
        </button>

        {/* Said before Run, not after: the code leaves this machine, and only the code does. */}
        {block.language === "java" && (
          <p className="text-caption text-ink-subtle">Java runs on our server — only this code is sent.</p>
        )}
      </div>

      <div id={outputId} role="status" aria-live="polite" className="border-t border-line bg-surface-sunken px-5 py-3 sm:px-6">
        {!result && <p className="text-caption text-ink-subtle">Run to see what this prints.</p>}
        {result?.message && <p className="text-caption text-ink-muted">{result.message}</p>}
        {result && !result.message && (
          <div className="flex flex-col gap-2">
            <div>
              <LessonLabel>Output</LessonLabel>
              <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap font-mono text-caption text-ink">
                {result.stdout || "(nothing printed)"}
              </pre>
            </div>
            {result.stderr ? (
              <div>
                <LessonLabel tone="danger">Error</LessonLabel>
                <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap font-mono text-caption text-danger">
                  {result.stderr}
                </pre>
              </div>
            ) : null}
            {result.matchesExpected !== null && (
              <p className={`text-caption ${result.matchesExpected ? "text-positive" : "text-ink-muted"}`}>
                {result.matchesExpected ? "Matches the expected output." : "Does not match the expected output."}
              </p>
            )}
          </div>
        )}
      </div>
    </LessonPanel>
  );
}
