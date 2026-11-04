import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { InterviewerPresence, type PresenceState } from "./interviewer-presence";

/**
 * What the figure opposite has to get right is not how it looks — it is that somebody
 * who cannot see it is told exactly what somebody who can see it is being told.
 */
describe("InterviewerPresence", () => {
  const states: Array<[PresenceState, RegExp]> = [
    ["speaking", /asking you a question/i],
    ["listening", /listening/i],
    ["thinking", /considering your answer/i],
    ["waiting", /ready when you are/i],
  ];

  it.each(states)("says out loud what it is doing while %s", (state, expected) => {
    render(<InterviewerPresence state={state} />);

    expect(screen.getByRole("status")).toHaveTextContent(expected);
  });

  /**
   * The portrait is decorative. It was briefly labelled as well as captioned, which makes
   * a screen reader read the same sentence twice on every turn of the interview.
   */
  it("is announced once, not twice", () => {
    render(<InterviewerPresence state="speaking" />);

    expect(screen.getAllByRole("status")).toHaveLength(1);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  /** It has no name, and never acquires one — the same rule the opening prompt follows. */
  // The owner named the interviewer Krivih on 4 November 2026; it used to be nameless.
  // It is still labelled as an AI, so nobody takes it for a person.
  it("is Krivih, and says plainly that it is an AI", () => {
    render(<InterviewerPresence state="waiting" />);

    expect(screen.getByText("Krivih · your AI interviewer")).toBeInTheDocument();
  });

  /**
   * Listening is the one state driven by real data — the microphone meter the room
   * already has — so a loud answer visibly moves it and silence does not.
   */
  it("leans in with the candidate's voice, and only while listening", () => {
    const { container, rerender } = render(<InterviewerPresence state="listening" level={1} />);
    const ring = () => container.querySelector("span[aria-hidden]") as HTMLElement;

    expect(ring().style.transform).toBe("scale(1.06)");

    rerender(<InterviewerPresence state="listening" level={0} />);
    expect(ring().style.transform).toBe("scale(1)");

    rerender(<InterviewerPresence state="speaking" level={1} />);
    expect(ring().style.transform).toBe("");
  });

  /** A meter that overshoots must not make the interviewer balloon. */
  it("does not let a clipped meter distort it", () => {
    const { container } = render(<InterviewerPresence state="listening" level={9} />);

    expect((container.querySelector("span[aria-hidden]") as HTMLElement).style.transform).toBe(
      "scale(1.06)",
    );
  });
});
