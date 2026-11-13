import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardView, StudentReadiness } from "@untiered/shared";

import { SkillHeatmap, StatTiles, statTiles } from "./dashboard-widgets";
import { MyReadiness } from "./my-readiness";
import { NO_COURSE_TEXT, practiceLinks, scoreText, sumWeights } from "./readiness-model";
import { StudentReadinessView } from "./student-readiness-view";

const api = vi.hoisted(() => ({ fetchMyReadiness: vi.fn() }));
vi.mock("@/lib/api", () => ({
  ...api,
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      public status: number,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));

const dashboard = (overrides: Partial<DashboardView> = {}): DashboardView => ({
  filters: { batchId: null, departmentId: null },
  enrolled: 120,
  joined: 90,
  active: 40,
  completionRate: 0.5,
  bands: { strong: 5, interview_ready: 20, needs_improvement: 30, needs_structured_prep: 10, not_enough_evidence: 25 },
  heatmap: { columns: [], rows: [] },
  ...overrides,
});

const readiness = (overrides: Partial<StudentReadiness> = {}): StudentReadiness => ({
  memberId: "m1",
  name: "Asha Rao",
  rollNumber: "A-001",
  batchName: "CSE 2027",
  departmentCode: "CSE",
  overall: 72,
  band: "interview_ready",
  components: { coding: 80, coreCs: null, technicalInterview: 64, communication: null, aptitude: null },
  weights: { coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 },
  evidence: [],
  suggestedTopics: [],
  ...overrides,
});

describe("readiness numbers", () => {
  it("shows a missing component as Not attempted, never as 0", () => {
    expect(scoreText(null)).toBe("Not attempted");
    expect(scoreText(0)).toBe("0");

    render(<StudentReadinessView readiness={readiness()} />);
    const components = screen.getByRole("region", { name: "Components" });
    expect(within(components).getAllByText("Not attempted")).toHaveLength(3);
    expect(within(components).queryByText(/^0$/)).not.toBeInTheDocument();
  });

  it("names the band in words beside the overall score", () => {
    render(<StudentReadinessView readiness={readiness()} />);
    expect(screen.getByText("72 / 100")).toBeInTheDocument();
    expect(screen.getByText("Interview ready")).toBeInTheDocument();
  });

  it("says Not attempted for an overall score that does not exist yet", () => {
    render(<StudentReadinessView readiness={readiness({ overall: null, band: "not_enough_evidence" })} />);
    expect(screen.getByText("Not enough evidence")).toBeInTheDocument();
    expect(screen.getAllByText("Not attempted").length).toBeGreaterThan(0);
  });

  it("adds weights up for the editor's total", () => {
    expect(sumWeights({ coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 })).toBe(100);
  });
});

describe("practice links", () => {
  it("links a topic only to a course that exists, and never makes one up", () => {
    for (const link of practiceLinks("core_cs", "dsa")) expect(link.href).toMatch(/^\/(courses|arena)\/dsa$/);
    expect(practiceLinks("core_cs", "dbms")).toEqual([]);
    expect(practiceLinks("core_cs", "os")).toEqual([]);
    expect(practiceLinks("core_cs", "cn")).toEqual([]);
    expect(practiceLinks("aptitude", null)).toEqual([]);
  });

  it("says so in words when a suggested topic has no course", () => {
    render(
      <StudentReadinessView
        readiness={readiness({ suggestedTopics: [{ component: "core_cs", topic: "dbms", reason: "Average 58 across 2 DBMS assignments." }] })}
      />,
    );
    expect(screen.getByText("Average 58 across 2 DBMS assignments.")).toBeInTheDocument();
    expect(screen.getByText(NO_COURSE_TEXT)).toBeInTheDocument();
  });
});

describe("placement dashboard widgets", () => {
  it("leaves out a figure that is unknown rather than showing 0", () => {
    expect(statTiles(dashboard()).map((tile) => tile.label)).toContain("Assignment completion");
    expect(statTiles(dashboard({ completionRate: null })).map((tile) => tile.label)).not.toContain("Assignment completion");

    render(<StatTiles view={dashboard({ completionRate: 0.5 })} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("labels a heatmap cell with too few students as not enough data, with no number", () => {
    render(
      <SkillHeatmap
        heatmap={{
          columns: ["dbms", "dsa"],
          rows: [
            {
              departmentId: "d1",
              departmentCode: "CSE",
              cells: [
                { topic: "dbms", average: null, students: 2 },
                { topic: "dsa", average: 74, students: 12 },
              ],
            },
          ],
        }}
      />,
    );
    const table = screen.getByRole("table", { name: "Average score by department and topic" });
    const row = within(table).getByRole("row", { name: /CSE/ });
    expect(within(row).getByText("74")).toBeInTheDocument();
    expect(within(row).getAllByText(/not enough data/i).length).toBeGreaterThan(0);
  });

  it("says there is nothing to compare when no topic has evidence", () => {
    render(<SkillHeatmap heatmap={{ columns: [], rows: [] }} />);
    expect(screen.getByText(/nothing to compare/i)).toBeInTheDocument();
  });
});

describe("the student's own readiness", () => {
  beforeEach(() => vi.clearAllMocks());

  it("explains that a student not in a college has no readiness, instead of an error", async () => {
    const { ApiRequestError } = await import("@/lib/api");
    api.fetchMyReadiness.mockRejectedValue(new (ApiRequestError as unknown as new (status: number, message: string) => Error)(404, "Not found"));
    render(<MyReadiness />);
    expect(await screen.findByText("You are not in a college on Untiered")).toBeInTheDocument();
  });

  it("says only assigned work counts", async () => {
    api.fetchMyReadiness.mockResolvedValue(readiness());
    render(<MyReadiness />);
    expect(await screen.findByText(/only the work your college has assigned you/i)).toBeInTheDocument();
  });
});
