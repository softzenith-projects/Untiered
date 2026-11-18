import type { ReportCompetency } from "@untiered/shared";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { CompetencyBars, CompetencyHighlights, OverallScore, bandFor, overallScore, scoreToneForPercent } from "./report-charts";

const competency = (name: string, score: number, maxScore = 5): ReportCompetency => ({
  competency: name,
  score,
  maxScore,
  rationale: "Reached it, but only after the question was narrowed.",
  evidenceQuote: "I'd shard by user id so one wallet lands on one node.",
  turnIndex: 1,
});

describe("overallScore", () => {
  it("is the mean of the competency ratios", () => {
    expect(overallScore([competency("a", 2), competency("b", 3)])).toBe(50);
  });

  it("compares rubrics with different maxima", () => {
    expect(overallScore([competency("a", 2, 5), competency("b", 4, 10)])).toBe(40);
  });

  /**
   * Null rather than zero, and the distinction matters: a report with no scored
   * competencies has no overall score, and drawing 0% for it would be a claim about the
   * candidate rather than about the report.
   */
  it("has no score rather than a zero when nothing was scored", () => {
    expect(overallScore([])).toBeNull();
    expect(overallScore(undefined)).toBeNull();
    expect(overallScore([competency("broken", 3, 0)])).toBeNull();
  });
});

describe("bandFor", () => {
  /** The anchored scale the report prompt marks against, named for what it would do in a round. */
  it("names the band the way the marking scale does", () => {
    expect(bandFor(0).name).toBe("Start from the basics");
    expect(bandFor(19.9).name).toBe("Start from the basics");
    expect(bandFor(20).name).toBe("Not passed");
    expect(bandFor(30).name).toBe("Needs a lot of work");
    expect(bandFor(40).name).toBe("Not clearing yet");
    expect(bandFor(49.9).name).toBe("Not clearing yet");
    expect(bandFor(50).name).toBe("Average");
    expect(bandFor(60).name).toBe("Good enough");
    expect(bandFor(69.9).name).toBe("Good enough");
    expect(bandFor(70).name).toBe("Strong");
    expect(bandFor(100).name).toBe("Strong");
  });

  /** The report of 18 November 2026: 60% was named "Strong" and coloured "Getting there". */
  it("never names a score with a word its colour contradicts", () => {
    for (let percent = 0; percent <= 100; percent += 0.5) {
      const name = bandFor(percent).name;
      const tone = scoreToneForPercent(percent);
      if (name === "Strong" || name === "Good enough") expect(tone, `${percent}%`).toBe("positive");
      if (name === "Average") expect(tone, `${percent}%`).toBe("warning");
      if (percent < 50) expect(tone, `${percent}%`).toBe("danger");
    }
  });

  it("clamps rather than falling off either end", () => {
    expect(bandFor(-5).name).toBe("Start from the basics");
    expect(bandFor(140).name).toBe(bandFor(100).name);
  });
});

describe("scoreToneForPercent", () => {
  it("uses red below 50, amber from 50 to 60, and green from the clearing mark at 60", () => {
    expect(scoreToneForPercent(49.9)).toBe("danger");
    expect(scoreToneForPercent(50)).toBe("warning");
    expect(scoreToneForPercent(59.9)).toBe("warning");
    expect(scoreToneForPercent(60)).toBe("positive");
  });
});

/**
 * The number is never announced — to the eye or to a screen reader — without the word for
 * what it would mean in a real round.
 */
describe("OverallScore", () => {
  it("never announces the number without the band it falls in", () => {
    render(<OverallScore competencies={[competency("a", 2)]} />);

    const meter = screen.getByRole("meter", { name: /overall score/i });
    expect(meter).toHaveAttribute("aria-valuenow", "40");
    expect(meter.getAttribute("aria-valuetext")).toMatch(/not clearing yet/i);
  });

  /** A screen-reader user must be told where clearing sits, not left to guess. */
  it("tells a screen reader where the scale sits, not just where they sit", () => {
    render(<OverallScore competencies={[competency("a", 2)]} />);

    expect(screen.getByRole("meter", { name: /overall score/i }).getAttribute("aria-valuetext")).toMatch(
      /60% would likely clear a round/i,
    );
  });

  it("shows the band name beside the number", () => {
    render(<OverallScore competencies={[competency("a", 3)]} />);

    expect(screen.getByText(/^Good enough$/)).toBeInTheDocument();
  });

  /** No score is not a score of nothing, so no instrument is drawn at all. */
  it("draws nothing when there is no score to draw", () => {
    render(<OverallScore competencies={[]} />);

    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

describe("CompetencyBars", () => {
  it("reports each competency's own score, not the overall one", () => {
    render(<CompetencyBars competencies={[competency("Scale estimation", 1), competency("Data modelling", 4)]} />);

    expect(screen.getByRole("meter", { name: "Scale estimation" })).toHaveAttribute("aria-valuenow", "1");
    expect(screen.getByRole("meter", { name: "Data modelling" })).toHaveAttribute("aria-valuenow", "4");
  });

  it("carries the maximum, so a rubric out of ten is not read as out of five", () => {
    render(<CompetencyBars competencies={[competency("Depth", 4, 10)]} />);

    expect(screen.getByRole("meter", { name: "Depth" })).toHaveAttribute("aria-valuemax", "10");
  });

  /**
   * Reports are composed once and stored, so one written before this page existed comes
   * back without these keys. That exact shape has crashed the report before.
   */
  it("survives a stored report that predates competencies", () => {
    expect(() => render(<CompetencyBars competencies={undefined} />)).not.toThrow();
    expect(screen.queryByRole("meter")).not.toBeInTheDocument();
  });
});

/**
 * Task 053 — the score-scale theory moves behind a disclosure. Every word survives
 * underneath it; the only change is whether it is open by default.
 */
describe("OverallScore's score-scale disclosure", () => {
  it("keeps the calibration theory closed by default", () => {
    render(<OverallScore competencies={[competency("a", 2)]} />);

    const summary = screen.getByText(/how this is scored/i);
    expect(summary.closest("details")).not.toHaveAttribute("open");
    expect(screen.getByText(/each score is named for what it would do in a real round/i)).not.toBeVisible();
  });

  it("opens on click, and the summary is reachable as a label", async () => {
    const user = userEvent.setup();
    render(<OverallScore competencies={[competency("a", 2)]} />);

    await user.click(screen.getByText(/how this is scored/i));

    expect(screen.getByText(/each score is named for what it would do in a real round/i)).toBeVisible();
  });

  /**
   * jsdom does not model the browser's built-in "Enter/Space activates a focused
   * `<summary>`" behaviour, so the toggle itself is only exercised via click above. What
   * this checks is the thing that actually makes Enter/Space work in a real browser: a
   * native `<summary>` inside a native `<details>`, tabbable with no explicit `tabIndex`
   * needed — not a `<div onClick>` standing in for one.
   */
  it("is a native summary/details pair, not a div pretending to be one", () => {
    render(<OverallScore competencies={[competency("a", 2)]} />);

    const summary = screen.getByText(/how this is scored/i).closest("summary");
    expect(summary?.tagName).toBe("SUMMARY");
    expect(summary?.parentElement?.tagName).toBe("DETAILS");
  });
});

/**
 * Task 053 — "how did I do" in about five seconds: the strongest and weakest
 * competencies as a visual, not a paragraph, for the owner's brief.
 */
describe("CompetencyHighlights", () => {
  it("splits into strongest and weakest once there are enough to split", () => {
    render(
      <CompetencyHighlights
        competencies={[
          competency("Coding", 5),
          competency("System design", 4),
          competency("Communication", 1),
          competency("Ownership", 1),
        ]}
      />,
    );

    const strongest = within(screen.getByText("Strongest").closest("div") as HTMLElement);
    expect(strongest.getByText("Coding")).toBeInTheDocument();
    expect(strongest.getByText("System design")).toBeInTheDocument();

    const weakest = within(screen.getByText("Weakest").closest("div") as HTMLElement);
    expect(weakest.getByText("Communication")).toBeInTheDocument();
    expect(weakest.getByText("Ownership")).toBeInTheDocument();
  });

  it("ranks by score ratio, not raw score, so rubrics of different maxima compare fairly", () => {
    render(
      <CompetencyHighlights
        competencies={[
          competency("Low max, aced", 5, 5), // 100%
          competency("Mid A", 4, 5), // 80%
          competency("Mid B", 3, 5), // 60%
          competency("High max, mediocre", 5, 10), // 50% — higher raw score than Mid B, lower ratio
          competency("Mid C", 2, 5), // 40%
          competency("Low max, poor", 1, 5), // 20%
        ]}
      />,
    );

    const strongest = within(screen.getByText("Strongest").closest("div") as HTMLElement);
    expect(strongest.getByText("Low max, aced")).toBeInTheDocument();
    expect(strongest.queryByText("High max, mediocre")).not.toBeInTheDocument();

    const weakest = within(screen.getByText("Weakest").closest("div") as HTMLElement);
    expect(weakest.getByText("Low max, poor")).toBeInTheDocument();
  });

  it("does not split a short list into two empty-feeling halves", () => {
    render(<CompetencyHighlights competencies={[competency("Coding", 5), competency("Ownership", 1)]} />);

    expect(screen.queryByText("Strongest")).not.toBeInTheDocument();
    expect(screen.queryByText("Weakest")).not.toBeInTheDocument();
    expect(screen.getByText("Coding")).toBeInTheDocument();
    expect(screen.getByText("Ownership")).toBeInTheDocument();
  });

  it("renders nothing when there is nothing scored", () => {
    const { container } = render(<CompetencyHighlights competencies={[]} />);
    expect(container).toBeEmptyDOMElement();
  });
});
