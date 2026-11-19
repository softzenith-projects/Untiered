import type { CodeRunResult } from "@untiered/shared";
import { describe, expect, it } from "vitest";

import { ApiRequestError } from "@/lib/api";
import { runOnServer } from "@/lib/server-code-runner";

const ran = (overrides: Partial<CodeRunResult> = {}): CodeRunResult => ({
  stdout: "",
  stderr: "",
  exitCode: 0,
  timedOut: false,
  available: true,
  message: null,
  outputLimited: false,
  wallTimeMillis: null,
  ...overrides,
});

describe("runOnServer", () => {
  it("passes output and errors through, with no message to hide them behind", async () => {
    const outcome = await runOnServer(() =>
      Promise.resolve(ran({ stdout: "4\n", stderr: "Main.java:3: error: ';' expected", exitCode: 1 })),
    );

    expect(outcome).toEqual({
      stdout: "4\n",
      stderr: "Main.java:3: error: ';' expected",
      available: true,
      timedOut: false,
      outputLimited: false,
      message: null,
    });
  });

  it("says a killed run was probably a loop that never ends", async () => {
    const outcome = await runOnServer(() => Promise.resolve(ran({ timedOut: true, exitCode: -1 })));

    expect(outcome.timedOut).toBe(true);
    expect(outcome.message).toMatch(/Stopped after 5 seconds/);
  });

  it("says a run stopped for printing too much was not a timeout", async () => {
    const outcome = await runOnServer(() =>
      Promise.resolve(
        ran({ stderr: "Exception in thread \"main\" java.lang.NullPointerException", exitCode: -1, outputLimited: true }),
      ),
    );

    expect(outcome.timedOut).toBe(false);
    expect(outcome.outputLimited).toBe(true);
    expect(outcome.message).toMatch(/printed more than the runner keeps/);
    expect(outcome.message).not.toMatch(/loop/);
    expect(outcome.stderr).toMatch(/NullPointerException/);
  });

  it("hands on the server's own words when no runner is configured", async () => {
    const outcome = await runOnServer(() =>
      Promise.resolve(ran({ available: false, exitCode: -1, message: "No runner is configured for this deployment." })),
    );

    expect(outcome.available).toBe(false);
    expect(outcome.message).toBe("No runner is configured for this deployment.");
  });

  it("shows the rate limit's message rather than a generic failure", async () => {
    const outcome = await runOnServer(() =>
      Promise.reject(new ApiRequestError(429, "rate_limited", "That has been asked for a lot in the last hour.")),
    );

    expect(outcome.available).toBe(false);
    expect(outcome.message).toBe("That has been asked for a lot in the last hour.");
  });

  it("never throws when the API cannot be reached", async () => {
    const outcome = await runOnServer(() => Promise.reject(new TypeError("Failed to fetch")));

    expect(outcome.available).toBe(false);
    expect(outcome.message).toMatch(/could not be reached/);
  });
});
