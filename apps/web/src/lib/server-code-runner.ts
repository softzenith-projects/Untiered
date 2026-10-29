import type { CodeRunResult } from "@untiered/shared";

import { ApiRequestError } from "@/lib/api";

/** The API's run limit (`interviewos.code-runner.run-timeout-millis`), in seconds, for the message. */
const SERVER_RUN_TIMEOUT_SECONDS = 5;

export interface ServerRunOutcome {
  stdout: string;
  stderr: string;
  /** False when nothing ran — no runner configured, rate-limited, or unreachable. */
  available: boolean;
  timedOut: boolean;
  /** Set whenever the output alone would not say what happened. */
  message: string | null;
}

/**
 * Java, run on our server. Shared by the interview room and the course playground so a
 * candidate hears the same thing from both when the runner is busy, absent or refuses.
 *
 * Never throws: a failed run is something to say to the candidate, not an error screen.
 */
export async function runOnServer(call: () => Promise<CodeRunResult>): Promise<ServerRunOutcome> {
  try {
    const result = await call();
    if (!result.available) {
      return unavailable(result.message ?? "The code runner is not available right now.");
    }
    return {
      stdout: result.stdout,
      stderr: result.stderr,
      available: true,
      timedOut: result.timedOut,
      message: result.timedOut
        ? `Stopped after ${SERVER_RUN_TIMEOUT_SECONDS} seconds — that usually means a loop that never ends. ` +
          "Your code is untouched."
        : null,
    };
  } catch (error) {
    if (error instanceof ApiRequestError && error.status === 429) return unavailable(error.message);
    return unavailable("The code runner could not be reached. Your code is untouched — try again in a moment.");
  }
}

function unavailable(message: string): ServerRunOutcome {
  return { stdout: "", stderr: "", available: false, timedOut: false, message };
}
