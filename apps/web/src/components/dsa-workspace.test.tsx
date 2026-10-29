import type { CodeRunResult, CodingProblem } from "@untiered/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChangeEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DsaWorkspace } from "@/components/dsa-workspace";

const { runPython } = vi.hoisted(() => ({ runPython: vi.fn() }));

// No Worker and no Pyodide: Python is the browser's business, and this file is about Java.
vi.mock("@/lib/browser-python", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/browser-python")>()),
  loadPython: () => Promise.resolve(true),
  runPython,
}));

// CodeMirror measures layout jsdom does not have; a plain textarea tests the wiring.
vi.mock("@uiw/react-codemirror", () => ({
  default: ({ value, onChange, ["aria-label"]: ariaLabel }: { value: string; onChange: (next: string) => void; "aria-label": string }) => (
    <textarea aria-label={ariaLabel} value={value} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} />
  ),
}));

const problem: CodingProblem = {
  title: "Double it",
  topic: "warm-up",
  difficulty: "easy",
  statement: "Print twice the number.",
  examples: [],
  constraints: [],
  starterPython: "print(int(input()) * 2)",
  starterJava: "public class Main { /* read n, print 2n */ }",
  stdinFormat: "One integer.",
  testCases: [{ input: "21", expected: "42" }],
  testsVerified: true,
};

const result = (overrides: Partial<CodeRunResult> = {}): CodeRunResult => ({
  stdout: "42\n",
  stderr: "",
  exitCode: 0,
  timedOut: false,
  available: true,
  message: null,
  ...overrides,
});

async function runJavaWith(runJava: (source: string, stdin: string) => Promise<CodeRunResult>) {
  const user = userEvent.setup();
  render(<DsaWorkspace problem={problem} board={{ kind: "dsa", sources: {}, language: "java" }} onBoardChange={() => {}} runJava={runJava} />);
  await user.click(screen.getByRole("button", { name: "Run" }));
}

describe("DsaWorkspace, Java", () => {
  beforeEach(() => {
    runPython.mockReset();
    // jsdom has no layout, so no element scrolling; the output panel scrolls to its top on a result.
    Element.prototype.scrollTo = vi.fn();
  });

  it("says before Run that the code goes to our server", () => {
    render(<DsaWorkspace problem={problem} board={{ kind: "dsa", sources: {}, language: "java" }} onBoardChange={() => {}} runJava={vi.fn()} />);

    expect(screen.getByText(/Runs on our server — only your code and the test input are sent/)).toBeInTheDocument();
    expect(screen.getByText(/This runs Java 15, so features from Java 16 on/)).toBeInTheDocument();
  });

  it("runs the editor's Java against the selected case on the server and compares the output", async () => {
    const runJava = vi.fn().mockResolvedValue(result());

    await runJavaWith(runJava);

    expect(runJava).toHaveBeenCalledWith(problem.starterJava, "21");
    expect(await screen.findByText("Matches the expected output.")).toBeInTheDocument();
    expect(runPython).not.toHaveBeenCalled();
  });

  it("shows a compile error as an error, never as a match", async () => {
    await runJavaWith(() =>
      Promise.resolve(result({ stdout: "", stderr: "Main.java:1: error: ';' expected", exitCode: 1 })),
    );

    expect(await screen.findByText(/';' expected/)).toBeInTheDocument();
    expect(screen.queryByText("Matches the expected output.")).not.toBeInTheDocument();
  });

  it("says plainly when the server has no runner", async () => {
    await runJavaWith(() => Promise.resolve(result({ stdout: "", available: false, message: "No runner is configured." })));

    expect(await screen.findByText("No runner is configured.")).toBeInTheDocument();
  });
});
