"use client";

import type { BoardState, CodeRunResult, CodingProblem, ProblemTestCase } from "@untiered/shared";
import { java } from "@codemirror/lang-java";
import { python } from "@codemirror/lang-python";
import CodeMirror from "@uiw/react-codemirror";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { loadPython, matchesExpected, runPython } from "@/lib/browser-python";
import { JAVA_VERSION_NOTE, runOnServer } from "@/lib/server-code-runner";

type Language = "python" | "java";

interface RunState {
  caseIndex: number;
  stdout: string;
  stderr: string;
  passed: boolean | null;
  message: string | null;
}

/**
 * The DSA round's answer workspace: the editor and its test cases. The problem stays
 * beside the interviewer so the candidate can read it while working.
 *
 * Deliberately **not** a coding-practice tool. There is no submit-to-a-judge, no score,
 * no green tick parade. The candidate is being assessed on what they say while they
 * write, and the interviewer is listening the whole time — running the code is a way to
 * find out something mid-thought, exactly as it is when a real interviewer says "go on,
 * run it".
 *
 * Which is also why nothing here reports a verdict. A passing case is shown as a passing
 * case and nothing more: no "Accepted", no congratulation. What it meant is the
 * interviewer's to say, at the debrief.
 */
export function DsaWorkspace({
  problem,
  board,
  onBoardChange,
  runJava,
}: {
  problem: CodingProblem;
  board: BoardState | null;
  onBoardChange: (board: BoardState) => void;
  /** Java cannot run in a browser, so the room hands in a call to the round's run endpoint. */
  runJava: (source: string, stdin: string) => Promise<CodeRunResult>;
}) {
  const [language, setLanguage] = useState<Language>(() => (board?.language === "java" ? "java" : "python"));
  const [sources, setSources] = useState<Record<string, string>>(() => ({
    python: board?.sources?.python ?? problem.starterPython,
    java: board?.sources?.java ?? problem.starterJava,
  }));
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunState | null>(null);
  const [selectedCase, setSelectedCase] = useState(0);
  const [pythonReady, setPythonReady] = useState<boolean | null>(null);

  // Ten megabytes of interpreter, fetched when the room opens rather than when Run is
  // first pressed — and loaded inside a worker, so fetching it never freezes the room.
  useEffect(() => {
    let live = true;
    void loadPython().then((ready) => {
      if (live) setPythonReady(ready);
    });
    return () => {
      live = false;
    };
  }, []);

  const source = sources[language] ?? "";

  const setSource = useCallback(
    (next: string) => {
      setSources((current) => {
        const updated = { ...current, [language]: next };
        onBoardChange({ kind: "dsa", sources: updated, language });
        return updated;
      });
    },
    [language, onBoardChange],
  );

  const testCase: ProblemTestCase | undefined = problem.testCases[selectedCase];

  const run = useCallback(async () => {
    if (!testCase) return;
    setRunning(true);
    try {
      const outcome =
        language === "java"
          ? await runOnServer(() => runJava(source, testCase.input))
          : await runPython(source, testCase.input);
      setResult({
        caseIndex: selectedCase,
        stdout: outcome.stdout,
        stderr: outcome.stderr,
        passed:
          outcome.available && !outcome.timedOut && !("outputLimited" in outcome && outcome.outputLimited) && !outcome.stderr
            ? matchesExpected(outcome.stdout, testCase.expected)
            : null,
        message: outcome.message,
      });
    } finally {
      setRunning(false);
    }
  }, [language, runJava, selectedCase, source, testCase]);

  const extensions = useMemo(() => [language === "java" ? java() : python()], [language]);

  return (
    <div className="flex h-full min-h-0 flex-col bg-navy">
      <EditorBar
        language={language}
        onLanguage={(next) => {
          setLanguage(next);
          onBoardChange({ kind: "dsa", sources, language: next });
        }}
        onRun={() => void run()}
        running={running}
        canRun={Boolean(testCase)}
        pythonReady={pythonReady}
      />

      <div className="min-h-0 flex-1 overflow-auto bg-navy">
        <CodeMirror
          value={source}
          height="100%"
          extensions={extensions}
          theme="dark"
          onChange={setSource}
          basicSetup={{ lineNumbers: true, foldGutter: false, highlightActiveLine: false }}
          aria-label={`Your ${language} solution`}
        />
      </div>

      <TestCases
        cases={problem.testCases}
        selected={selectedCase}
        onSelect={setSelectedCase}
        result={result}
        stdinFormat={problem.stdinFormat}
        verified={problem.testsVerified === true}
      />
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="mt-2">
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{label}</p>
      <pre className="mt-0.5 overflow-x-auto font-mono text-caption text-ink">{value}</pre>
    </div>
  );
}

function EditorBar({
  language,
  onLanguage,
  onRun,
  running,
  canRun,
  pythonReady,
}: {
  language: Language;
  onLanguage: (language: Language) => void;
  onRun: () => void;
  running: boolean;
  canRun: boolean;
  pythonReady: boolean | null;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-on-navy/10 bg-navy px-4 py-2.5 text-on-navy">
      <div className="flex gap-1" role="group" aria-label="Language">
        {(["python", "java"] as const).map((option) => (
          <button
            key={option}
            type="button"
            onClick={() => onLanguage(option)}
            aria-pressed={language === option}
            className={`rounded-md px-2.5 py-1 text-caption capitalize transition ${
              language === option ? "bg-on-navy/10 text-on-navy" : "text-on-navy-muted hover:bg-on-navy/5"
            }`}
          >
            {option}
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onRun}
        disabled={running || !canRun}
        className="ml-auto rounded-lg bg-accent px-3 py-1.5 text-caption font-medium text-accent-contrast transition hover:bg-accent-strong disabled:opacity-50"
      >
        {running ? "Running…" : "Run"}
      </button>

      {/* Said once, plainly, rather than discovered when Run does nothing. */}
      {language === "python" && pythonReady === null && (
        <span className="text-caption text-on-navy-muted">Loading Python…</span>
      )}
      {language === "python" && pythonReady === true && (
        <span className="text-caption text-on-navy-muted">Runs locally — your code stays on this machine.</span>
      )}
      {language === "python" && pythonReady === false && (
        <span className="text-caption text-on-navy-muted">Python could not load. The round runs out loud.</span>
      )}
      {language === "java" && (
        <span className="text-caption text-on-navy-muted">
          Runs on our server — only your code and the test input are sent. {JAVA_VERSION_NOTE}
        </span>
      )}
    </div>
  );
}

function TestCases({
  cases,
  selected,
  onSelect,
  result,
  stdinFormat,
  verified,
}: {
  cases: ProblemTestCase[];
  selected: number;
  onSelect: (index: number) => void;
  result: RunState | null;
  stdinFormat: string;
  /** The expected outputs came from running two solutions, not from the model's working. */
  verified: boolean;
}) {
  const active = cases[selected];
  const shown = result && result.caseIndex === selected ? result : null;
  const outputRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (shown) outputRef.current?.scrollTo({ top: 0 });
  }, [shown]);

  if (cases.length === 0) {
    return (
      <div className="border-t border-line px-4 py-3 text-caption text-ink-subtle">
        This problem came without test cases. Run is off; talk the interviewer through it instead.
      </div>
    );
  }

  return (
    <div className="max-h-[38%] min-h-0 shrink-0 overflow-y-auto border-t border-line" ref={outputRef}>
      <div className="flex items-center gap-1 px-4 pt-3" role="tablist" aria-label="Test cases">
        {cases.map((_, index) => (
          <button
            key={index}
            type="button"
            role="tab"
            aria-selected={selected === index}
            onClick={() => onSelect(index)}
            className={`rounded-md px-2.5 py-1 text-caption transition ${
              selected === index ? "bg-surface-sunken text-ink" : "text-ink-muted hover:bg-surface-sunken"
            }`}
          >
            Case {index + 1}
          </button>
        ))}
      </div>

      {/*
        Said plainly when it applies. A wrong expected output that the room presents as
        fact tells a candidate with correct code that they are wrong — the one thing this
        panel must never do without a warning.
      */}
      {!verified && (
        <p className="px-4 pt-2 text-micro leading-relaxed text-ink-subtle">
          These expected outputs were not checked by running a solution, so one may be wrong. If your
          output differs and you think you are right, say why — that is a good thing to argue.
        </p>
      )}

      <div className="grid gap-4 px-4 py-3 sm:grid-cols-2">
        <div>
          <Field label="Input" value={active?.input ?? ""} />
          <p className="mt-1 text-micro text-ink-subtle">{stdinFormat}</p>
          <Field label="Expected" value={active?.expected ?? ""} />
        </div>
        <div>
          {!shown && <p className="text-caption text-ink-subtle">Run to see what your code prints.</p>}
          {shown?.message && <p className="text-caption text-ink-muted">{shown.message}</p>}
          {shown && !shown.message && (
            <>
              <Field label="Your output" value={shown.stdout || "(nothing printed)"} />
              {shown.stderr && (
                <div className="mt-2">
                  <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">Error</p>
                  <pre className="mt-0.5 overflow-x-auto whitespace-pre-wrap font-mono text-caption text-danger">
                    {shown.stderr}
                  </pre>
                </div>
              )}
              {/*
                A statement of fact, not a verdict. What a passing case means is the
                interviewer's to say at the debrief, not this panel's.
              */}
              {shown.passed !== null && (
                <p className={`mt-2 text-caption ${shown.passed ? "text-positive" : "text-ink-muted"}`}>
                  {shown.passed ? "Matches the expected output." : "Does not match the expected output."}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
