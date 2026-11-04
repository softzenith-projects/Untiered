import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOOPS, LoopPicker } from "@/components/landing/loop-picker";
import { ReportPreview } from "@/components/landing/report-preview";
import { SAMPLE_REPORT } from "@/content/sample-report";
import { SAMPLES, SampleTurn } from "@/components/landing/sample-turn";

const service = SAMPLES[0];
const product = SAMPLES.find((s) => s.id === "product")!;

function mockReducedMotion(reduce: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: reduce && query.includes("reduce"), media: query }));
}

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("SampleTurn", () => {
  it("shows the question first and holds the follow-up until the answer is played", () => {
    render(<SampleTurn />);
    expect(screen.getByText(service.question)).toBeInTheDocument();
    expect(screen.queryByText(service.followUp)).not.toBeInTheDocument();
  });

  it("plays the answer, then the interviewer's follow-up", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    render(<SampleTurn />);

    fireEvent.click(screen.getByRole("button", { name: "Play the answer" }));
    expect(screen.getByRole("button", { name: "Play the answer" })).toBeDisabled();
    expect(screen.queryByText(service.followUp)).not.toBeInTheDocument();

    act(() => {
      vi.runAllTimers();
    });
    expect(screen.getByText(service.followUp)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Play again" })).toBeEnabled();
  });

  it("skips the animation when reduced motion is requested", () => {
    mockReducedMotion(true);
    render(<SampleTurn />);
    fireEvent.click(screen.getByRole("button", { name: "Play the answer" }));
    expect(screen.getByText(service.followUp)).toBeInTheDocument();
  });

  it("keeps the full answer available to screen readers while it animates", () => {
    vi.useFakeTimers();
    mockReducedMotion(false);
    render(<SampleTurn />);
    fireEvent.click(screen.getByRole("button", { name: "Play the answer" }));
    expect(screen.getByText(service.answer)).toBeInTheDocument();
  });

  it("switches interview type with arrow keys and resets the turn", () => {
    mockReducedMotion(true);
    render(<SampleTurn />);
    fireEvent.click(screen.getByRole("button", { name: "Play the answer" }));

    const first = screen.getByRole("tab", { name: service.tab });
    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    const next = screen.getByRole("tab", { name: product.tab });
    expect(next).toHaveAttribute("aria-selected", "true");
    expect(next).toHaveFocus();
    expect(screen.getByText(product.question)).toBeInTheDocument();
    expect(screen.queryByText(product.followUp)).not.toBeInTheDocument();
  });

  it("says which exchanges are real and which are illustrative", () => {
    render(<SampleTurn />);
    expect(screen.getByText("From a real session.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: product.tab }));
    expect(screen.getByText(/not taken from a session/)).toBeInTheDocument();
  });
});

describe("LoopPicker", () => {
  it("shows the rounds of the chosen loop in order", () => {
    render(<LoopPicker />);
    const product = LOOPS.find((l) => l.id === "product")!;
    fireEvent.click(screen.getByRole("tab", { name: product.tab }));

    const panel = screen.getByRole("tabpanel");
    const rounds = within(panel).getAllByRole("listitem").map((li) => li.textContent);
    expect(rounds).toEqual(product.rounds.map((round, i) => `${i + 1}${round}`));
  });

  it("keeps a single tab in the tab order", () => {
    render(<LoopPicker />);
    const focusable = screen.getAllByRole("tab").filter((tab) => tab.tabIndex === 0);
    expect(focusable).toHaveLength(1);
  });
});

describe("ReportPreview", () => {
  it("draws each report section from the report's own components", () => {
    render(<ReportPreview />);

    expect(screen.getByRole("img", { name: /overall score [\d.]+ percent/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "At a glance" }));
    expect(screen.getByRole("button", { name: "At a glance" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Answered without help")).toBeInTheDocument();
  });

  it("shows each score next to the sentence it was scored on", () => {
    render(<ReportPreview />);

    fireEvent.click(screen.getByRole("button", { name: "Evidence" }));
    const first = SAMPLE_REPORT.competencies[0]!;
    expect(screen.getByText(`“${first.evidenceQuote}”`)).toBeInTheDocument();
  });

  it("says the round is a demo, not a real candidate", () => {
    render(<ReportPreview />);

    expect(screen.getByText(/a demo round, drawn by the report itself\. no real candidate/i)).toBeInTheDocument();
  });
});

describe("LoopPicker round lists", () => {
  it("says on every loop that the rounds are typical, not a fixed list", () => {
    render(<LoopPicker />);
    for (const loop of LOOPS) {
      fireEvent.click(screen.getByRole("tab", { name: loop.tab }));
      expect(within(screen.getByRole("tabpanel")).getByText(/not a fixed list/)).toBeInTheDocument();
    }
  });

  it("does not give Big Four technical hiring a case-interview loop", () => {
    const rounds = LOOPS.flatMap((loop) => loop.rounds);
    expect(rounds).not.toContain("Case discussion");
  });
});
