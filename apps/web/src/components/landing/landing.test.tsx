import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { LOOPS, LoopPicker } from "@/components/landing/loop-picker";
import { COMPETENCIES, ReportPreview } from "@/components/landing/report-preview";
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
  it("reveals the quote a score was based on", () => {
    render(<ReportPreview />);
    const target = COMPETENCIES[1];
    const button = screen.getByRole("button", { name: new RegExp(target.name) });

    fireEvent.click(button);
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText(`“${target.quote}”`)).toBeInTheDocument();
  });
});
