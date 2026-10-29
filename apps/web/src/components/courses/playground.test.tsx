import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChangeEvent } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { Playground } from "@/components/courses/playground";
import type { Block } from "@/content/courses/types";
import type { CodeRunner } from "@/lib/course-code-runner";

/**
 * `getRunner` is the one seam between the playground and an actual interpreter (task 049)
 * — mocking it here is what "no test may hit a live third-party API or download Pyodide"
 * means for this component. Nothing in this file imports `browser-python.ts` or touches a
 * real Worker.
 */
const prepare = vi.fn<CodeRunner["prepare"]>();
const run = vi.fn<CodeRunner["run"]>();

vi.mock("@/lib/course-code-runner", () => ({
  getRunner: () => ({ prepare, run }),
}));

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));

/**
 * CodeMirror's real view does its own text measurement (`getClientRects`, animation-frame
 * layout passes) that jsdom does not implement, which makes simulated typing into the real
 * editor flaky and occasionally throws async, unrelated to anything this component does.
 * Standing in a plain, controlled textarea tests exactly what this component owns — that
 * it wires `value`/`onChange` correctly and reacts to Reset — without re-testing
 * CodeMirror's own (separately maintained) editing behaviour.
 */
vi.mock("@uiw/react-codemirror", () => ({
  default: ({
    value,
    onChange,
    ["aria-label"]: ariaLabel,
  }: {
    value: string;
    onChange: (next: string) => void;
    "aria-label": string;
  }) => <textarea aria-label={ariaLabel} value={value} onChange={(e: ChangeEvent<HTMLTextAreaElement>) => onChange(e.target.value)} />,
}));

type PlaygroundBlock = Extract<Block, { kind: "playground" }>;

const pythonBlock: PlaygroundBlock = {
  kind: "playground",
  language: "python",
  starter: "print('hi')",
  prompt: "Say hi back.",
  expectedOutput: "hi",
};

const javaBlock: PlaygroundBlock = {
  kind: "playground",
  language: "java",
  starter: "System.out.println(\"hi\");",
};

describe("Playground", () => {
  beforeEach(() => {
    prepare.mockReset();
    run.mockReset();
  });

  it("never loads the interpreter merely by rendering — only a Run does", () => {
    render(<Playground block={pythonBlock} />);
    expect(prepare).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it("shows a loading state while preparing, then runs, then shows output", async () => {
    let resolvePrepare: (ready: boolean) => void = () => {};
    prepare.mockReturnValue(new Promise((resolve) => (resolvePrepare = resolve)));
    run.mockResolvedValue({
      stdout: "hi",
      stderr: "",
      available: true,
      timedOut: false,
      message: null,
    });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);

    await user.click(screen.getByRole("button", { name: "Run" }));
    expect(await screen.findByRole("button", { name: "Loading Python…" })).toBeInTheDocument();

    resolvePrepare(true);
    // The expected output ("hi") is on screen before the run, so wait for the run's own result.
    expect(await screen.findByText("Matches the expected output.")).toBeInTheDocument();
    expect(screen.getByText("Output")).toBeInTheDocument();
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("shows what the starter should print before anything has run", () => {
    render(<Playground block={pythonBlock} />);
    expect(screen.getByText("Expected output")).toBeInTheDocument();
    expect(screen.queryByText("Run to see what this prints.")).not.toBeInTheDocument();
  });

  it("says when it has mounted, so the static copy of its code can be taken away", () => {
    const onReady = vi.fn();
    render(<Playground block={pythonBlock} onReady={onReady} />);
    expect(onReady).toHaveBeenCalled();
  });

  it("shows stderr distinctly and does not claim a match when the run errored", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({
      stdout: "",
      stderr: "NameError: name 'x' is not defined",
      available: true,
      timedOut: false,
      message: null,
    });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/NameError/)).toBeInTheDocument();
    expect(screen.queryByText("Matches the expected output.")).not.toBeInTheDocument();
    expect(screen.queryByText("Does not match the expected output.")).not.toBeInTheDocument();
  });

  it("shows the timeout message plainly rather than silently failing", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({
      stdout: "",
      stderr: "",
      available: true,
      timedOut: true,
      message: "Stopped after 6 seconds — that usually means a loop that never ends.",
    });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/Stopped after 6 seconds/)).toBeInTheDocument();
  });

  it("edits the source in the editor and Reset restores the original starter", async () => {
    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);

    const editor = screen.getByLabelText("Editable python code") as HTMLTextAreaElement;
    expect(editor.value).toBe(pythonBlock.starter);

    await user.type(editor, "!");
    expect(editor.value).toBe(`${pythonBlock.starter}!`);

    await user.click(screen.getByRole("button", { name: "Reset to original" }));
    expect(editor.value).toBe(pythonBlock.starter);
  });

  it("Run uses whatever is currently in the editor, not the original starter", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({ stdout: "hi!", stderr: "", available: true, timedOut: false, message: null });

    const user = userEvent.setup();
    render(<Playground block={pythonBlock} />);

    const editor = screen.getByLabelText("Editable python code") as HTMLTextAreaElement;
    await user.type(editor, "!");
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText("hi!")).toBeInTheDocument();
    expect(run).toHaveBeenCalledWith(`${pythonBlock.starter}!`);
  });

  it("labels the editor and the output region accessibly", () => {
    render(<Playground block={pythonBlock} />);
    expect(screen.getByLabelText("Editable python code")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("is keyboard reachable: Copy, Reset and Run are all real buttons", () => {
    render(<Playground block={pythonBlock} />);
    expect(screen.getByRole("button", { name: "Copy" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Reset to original" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("for Java, says before Run that the code goes to our server", () => {
    render(<Playground block={javaBlock} />);
    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
    expect(screen.getByText("Java runs on our server — only this code is sent.")).toBeInTheDocument();
    expect(screen.getByText(/This runs Java 15, so features from Java 16 on/)).toBeInTheDocument();
    expect(prepare).not.toHaveBeenCalled();
  });

  it("for Java, runs on the server and shows what it printed, with no Python loading state", async () => {
    prepare.mockResolvedValue(true);
    run.mockResolvedValue({ stdout: "hi\n", stderr: "", available: true, timedOut: false, message: null });

    const user = userEvent.setup();
    render(<Playground block={{ ...javaBlock, expectedOutput: "hi" }} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(screen.queryByRole("button", { name: "Loading Python…" })).not.toBeInTheDocument();
    expect(await screen.findByText("Matches the expected output.")).toBeInTheDocument();
    expect(run).toHaveBeenCalledWith(javaBlock.starter);
  });

  it("for Java with no sign-in, asks the reader to sign in rather than blaming Python", async () => {
    prepare.mockResolvedValue(false);

    const user = userEvent.setup();
    render(<Playground block={javaBlock} />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(await screen.findByText(/you need to be signed in/)).toBeInTheDocument();
    expect(screen.queryByText(/Python could not be loaded/)).not.toBeInTheDocument();
    expect(run).not.toHaveBeenCalled();
  });
});
