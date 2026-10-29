import { describe, expect, it, vi } from "vitest";

const loadPython = vi.fn();
const runPython = vi.fn();
const runCourseCode = vi.fn();

// The boundaries this whole abstraction exists to sit behind — no Worker, no Pyodide, no
// network fetch is ever touched by this test (task 049).
vi.mock("@/lib/browser-python", () => ({ loadPython, runPython }));
vi.mock("@/lib/api", () => ({ runCourseCode, ApiRequestError: class extends Error {} }));

describe("getRunner", () => {
  it("returns a python runner whose prepare() delegates to loadPython", async () => {
    loadPython.mockResolvedValueOnce(true);
    const { getRunner } = await import("@/lib/course-code-runner");
    const runner = getRunner("python");

    const ready = await runner.prepare();

    expect(ready).toBe(true);
    expect(loadPython).toHaveBeenCalledTimes(1);
    expect(runPython).not.toHaveBeenCalled();
  });

  it("run() delegates to runPython with empty stdin, and does not call loadPython itself", async () => {
    runPython.mockResolvedValueOnce({
      stdout: "42",
      stderr: "",
      available: true,
      timedOut: false,
      message: null,
    });
    const { getRunner } = await import("@/lib/course-code-runner");
    const runner = getRunner("python");
    loadPython.mockClear();

    const outcome = await runner.run("print(42)");

    expect(runPython).toHaveBeenCalledWith("print(42)", "");
    expect(outcome.stdout).toBe("42");
    expect(loadPython).not.toHaveBeenCalled();
  });

  it("runs java on the server with the reader's token, never loading Python", async () => {
    runCourseCode.mockResolvedValueOnce({
      stdout: "Namaste, Java!\n",
      stderr: "",
      exitCode: 0,
      timedOut: false,
      available: true,
      message: null,
    });
    const { getRunner } = await import("@/lib/course-code-runner");
    const runner = getRunner("java", "token-1");
    loadPython.mockClear();

    expect(await runner.prepare()).toBe(true);
    const outcome = await runner.run("public class Hello {}");

    expect(runCourseCode).toHaveBeenCalledWith("token-1", { source: "public class Hello {}", language: "java", stdin: "" });
    expect(outcome.stdout).toBe("Namaste, Java!\n");
    expect(loadPython).not.toHaveBeenCalled();
  });

  it("is not ready for java until there is a token to send", async () => {
    const { getRunner } = await import("@/lib/course-code-runner");
    expect(await getRunner("java", null).prepare()).toBe(false);
    expect(await getRunner("java", undefined).prepare()).toBe(false);
  });
});
