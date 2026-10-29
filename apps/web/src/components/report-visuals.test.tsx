import type { ReportCompetency, ReportSpokenEnglish, SessionReport } from "@untiered/shared";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PaceGauge, ReportVisuals, RingMeter, SkillRadar, Spotlight } from "./report-visuals";

function competency(name: string, score: number, maxScore = 5): ReportCompetency {
  return { competency: name, score, maxScore, rationale: "", evidenceQuote: "", turnIndex: null };
}

const competencies = [
  competency("Problem solving", 3),
  competency("Communication", 2),
  competency("System design trade-offs", 4),
];

function spoken(overrides: Partial<ReportSpokenEnglish> = {}): ReportSpokenEnglish {
  return {
    languageAssessed: true,
    scope: "",
    answersTotal: 3,
    answersTimed: 3,
    timingNote: null,
    wordCount: 300,
    wordsPerMinute: 138,
    paceBand: "within",
    paceNote: "",
    pauseCount: 2,
    longestPauseSeconds: 1.5,
    pauseSharePercent: 4,
    medianFirstWordSeconds: 1.2,
    hesitationCount: 3,
    hesitationsPer100Words: 1,
    answers: [
      { turnIndex: 1, words: 120, wordsPerMinute: 130, pauseCount: 1, longestPauseSeconds: 1.2, firstWordSeconds: 1 },
      { turnIndex: 2, words: 80, wordsPerMinute: 145, pauseCount: 1, longestPauseSeconds: 1.5, firstWordSeconds: 1.4 },
    ],
    observations: [],
    ...overrides,
  };
}

function report(overrides: Partial<SessionReport> = {}): SessionReport {
  return {
    answeredTurns: 4,
    assessableTurns: 3,
    competencies,
    assistance: { totalAnswers: 4, unaidedAnswers: 3, assistedAnswers: 1, headline: "", narrative: null, breakdown: [], moments: [] },
    spokenEnglish: spoken(),
    ...overrides,
  } as SessionReport;
}

describe("ReportVisuals", () => {
  it("draws the skill shape, both meters, the pace gauge and the answer lengths from the report's own figures", () => {
    render(<ReportVisuals report={report()} />);

    expect(screen.getByRole("img", { name: /Skill shape: Problem solving 3 of 5/ })).toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Answered without help" })).toHaveAttribute("aria-valuenow", "3");
    expect(screen.getByRole("meter", { name: "Answers deep enough to score" })).toHaveAttribute("aria-valuemax", "4");
    expect(screen.getByRole("meter", { name: "Speaking pace" })).toHaveAttribute("aria-valuenow", "138");
    expect(screen.getByRole("list", { name: "Words per answer" })).toBeInTheDocument();
  });

  it("leaves out a chart whose figures were not measured rather than drawing it at zero", () => {
    render(<ReportVisuals report={report({ spokenEnglish: spoken({ wordsPerMinute: null, answers: [] }) })} />);

    expect(screen.queryByRole("meter", { name: "Speaking pace" })).not.toBeInTheDocument();
    expect(screen.queryByRole("list", { name: "Words per answer" })).not.toBeInTheDocument();
  });

  it("does not draw pace for a round where English was not assessed", () => {
    render(<ReportVisuals report={report({ spokenEnglish: spoken({ languageAssessed: false }) })} />);

    expect(screen.queryByRole("meter", { name: "Speaking pace" })).not.toBeInTheDocument();
  });

  it("skips the radar with fewer than three competencies, where a shape says nothing", () => {
    render(<ReportVisuals report={report({ competencies: competencies.slice(0, 2) })} />);

    expect(screen.queryByRole("img", { name: /Skill shape/ })).not.toBeInTheDocument();
    expect(screen.getByRole("meter", { name: "Answered without help" })).toBeInTheDocument();
  });
});

describe("SkillRadar", () => {
  it("shows a competency's exact score when its point is focused", () => {
    render(<SkillRadar competencies={competencies} />);

    fireEvent.focus(screen.getByRole("button", { name: "Communication: 2 out of 5" }));

    expect(screen.getByRole("status")).toHaveTextContent("Communication2 / 5 · 40%");
  });
});

describe("RingMeter", () => {
  it("reports its value against its total", () => {
    render(<RingMeter title="Answered without help" value={2} total={5} caption="2 of 5 answers" />);

    const meter = screen.getByRole("meter", { name: "Answered without help" });
    expect(meter).toHaveAttribute("aria-valuetext", "2 of 5 answers");
  });
});

describe("PaceGauge", () => {
  it.each([
    [100, "Below"],
    [140, "Within"],
    [190, "Above"],
  ])("places %i words a minute %s the conversational range", (wpm, where) => {
    render(<PaceGauge wordsPerMinute={wpm} />);

    expect(screen.getByText(new RegExp(`^${where} the shaded conversational range`))).toBeInTheDocument();
  });
});

describe("Spotlight", () => {
  it("names the strongest and weakest competency, each with its colour's word", () => {
    render(<Spotlight competencies={competencies} />);

    expect(screen.getByText("Your strongest").parentElement).toHaveTextContent("System design trade-offs4/5 · The ceiling");
    expect(screen.getByText("Needs most work").parentElement).toHaveTextContent("Communication2/5 · Ordinary");
  });

  it("is left out when every competency is the same one", () => {
    const { container } = render(<Spotlight competencies={competencies.slice(0, 1)} />);

    expect(container).toBeEmptyDOMElement();
  });
});

describe("tone labels", () => {
  it("says in words what a ring's colour means", () => {
    render(<RingMeter title="Answered without help" value={1} total={4} caption="1 of 4" />);

    expect(screen.getByText("Needs work")).toBeInTheDocument();
  });

  it("never marks a pace outside the range as needing work", () => {
    render(<PaceGauge wordsPerMinute={200} />);

    expect(screen.getByText("A little fast")).toBeInTheDocument();
    expect(screen.queryByText("Needs work")).not.toBeInTheDocument();
  });
});
