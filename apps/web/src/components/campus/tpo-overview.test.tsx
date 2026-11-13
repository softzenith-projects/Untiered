import { render, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardPipeline, DashboardView } from "@untiered/shared";

import { CampusGate } from "./campus-context";
import { PlacementDashboard } from "./placement-dashboard";
import { ReadinessPanel } from "./readiness-panel";
import {
  BatchesCard,
  conversionRows,
  countChange,
  joinedSegments,
  KpiRow,
  pointsChange,
  scoreTone,
  SkillReadinessCard,
} from "./tpo-overview";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchBatches: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchDashboard: vi.fn(),
  fetchReadinessRows: vi.fn(),
  downloadStudentsCsv: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  ApiRequestError: class ApiRequestError extends Error {},
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/campus",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("org=o1&batchId=b1"),
}));

const pipeline = (over: Partial<DashboardPipeline> = {}): DashboardPipeline => ({
  invited: 40,
  joined: 30,
  active: 18,
  assigned: 25,
  attempted: 20,
  completed: 12,
  interviewReady: 6,
  ...over,
});

const weekly = ["2026-09-21", "2026-09-28", "2026-10-05", "2026-10-12", "2026-10-19", "2026-10-26", "2026-11-02", "2026-11-09"].map(
  (weekStart, index) => ({ weekStart, completed: index }),
);

const view = (over: Partial<DashboardView> = {}): DashboardView => ({
  filters: { batchId: null, departmentId: null },
  enrolled: 35,
  joined: 30,
  active: 18,
  completionRate: 0.5,
  bands: { strong: 2, interview_ready: 4, needs_improvement: 10, needs_structured_prep: 4, not_enough_evidence: 10 },
  heatmap: { columns: [], rows: [] },
  pipeline: pipeline(),
  componentAverages: {
    coding: { average: 74, students: 12 },
    coreCs: { average: 55, students: 9 },
    technicalInterview: { average: 41, students: 8 },
    communication: { average: null, students: 2 },
    aptitude: { average: null, students: 0 },
  },
  topGaps: [{ topic: "dbms", average: 48, students: 9 }],
  trend: { completedLast30: 14, completedPrev30: 11, averageScoreLast30: 63, averageScorePrev30: 59, weekly },
  batches: [
    { batchId: "b1", name: "CSE 2027", departmentCode: "CSE", joined: 20, completionRate: 0.6, averageOverall: 66, interviewReady: 5 },
    { batchId: "b2", name: "ECE 2027", departmentCode: "ECE", joined: 2, completionRate: null, averageOverall: null, interviewReady: 0 },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchMeCampus.mockResolvedValue({ student: null, staff: [{ orgId: "o1", orgName: "Test College", logoUrl: null, role: "tpo" }] });
  api.fetchBatches.mockResolvedValue([{ id: "b1", departmentId: "d1", departmentCode: "CSE", graduationYear: 2027, name: "CSE 2027", studentCount: 20 }]);
  api.fetchDepartments.mockResolvedValue([{ id: "d1", code: "CSE", name: "Computer Science", batchCount: 1 }]);
  api.fetchDashboard.mockResolvedValue(view());
  api.fetchReadinessRows.mockResolvedValue({ items: [], nextCursor: null });
});

describe("overview helpers", () => {
  it("shows a count's change as +n or −n and a score's as points, and nothing when a period has no value", () => {
    expect(countChange(14, 11)).toBe("+3");
    expect(countChange(9, 11)).toBe("−2");
    expect(countChange(5, 5)).toBe("No change");
    expect(pointsChange(63, 59)).toBe("+4 pts");
    expect(pointsChange(60, 61)).toBe("−1 pt");
    expect(pointsChange(63, null)).toBeNull();
    expect(pointsChange(null, 59)).toBeNull();
  });

  it("leaves out a conversion row whose first stage is empty, or that would pass 100%", () => {
    const rows = conversionRows(pipeline({ invited: 0, assigned: 0, attempted: 0, completed: 0, interviewReady: 0 }));
    expect(rows.map((row) => row.label)).toEqual(["Joined → Active"]);

    // More joined than were invited (some joined without an invite): not a conversion.
    expect(conversionRows(pipeline({ invited: 10 })).map((row) => row.from)).not.toContain("invited");
    expect(conversionRows(pipeline())).toContainEqual(
      expect.objectContaining({ from: "attempted", to: "completed", numerator: 12, denominator: 20, percent: 60 }),
    );
  });

  it("splits joined students into parts that add up to the number joined", () => {
    const parts = joinedSegments(pipeline());
    expect(parts.map((part) => part.count)).toEqual([5, 5, 8, 12]);
    expect(parts.reduce((sum, part) => sum + part.count, 0)).toBe(30);
  });

  it("colours scores green from 70, amber from 50, red below", () => {
    expect([scoreTone(70), scoreTone(69), scoreTone(50), scoreTone(49)]).toEqual(["positive", "highlight", "highlight", "danger"]);
  });
});

describe("KPI cards", () => {
  it("shows the four figures, with change chips against the previous 30 days", () => {
    render(<KpiRow view={view()} />);
    const cards = within(screen.getByRole("list", { name: "Key figures" })).getAllByRole("listitem");
    expect(cards).toHaveLength(4);
    expect(within(cards[0]!).getByText("of 40 invited")).toBeInTheDocument();
    expect(within(cards[2]!).getByText("+3")).toBeInTheDocument();
    expect(within(cards[2]!).getByText(/oldest first: 0, 1, 2, 3, 4, 5, 6, 7/)).toBeInTheDocument();
    expect(within(cards[3]!).getByText("63")).toBeInTheDocument();
    expect(within(cards[3]!).getByText("+4 pts")).toBeInTheDocument();
  });

  it("hides the change chip when a period has no average, and says when there is not enough data", () => {
    const { rerender } = render(
      <KpiRow view={view({ trend: { completedLast30: 3, completedPrev30: 0, averageScoreLast30: 63, averageScorePrev30: null, weekly } })} />,
    );
    const score = () => within(screen.getByRole("list", { name: "Key figures" })).getAllByRole("listitem")[3]!;
    expect(within(score()).getByText("63")).toBeInTheDocument();
    expect(within(score()).queryByText(/pts?$/)).not.toBeInTheDocument();

    rerender(<KpiRow view={view({ trend: { completedLast30: 1, completedPrev30: 0, averageScoreLast30: null, averageScorePrev30: 70, weekly } })} />);
    expect(within(score()).getByText("Not enough data yet")).toBeInTheDocument();
    expect(within(score()).queryByText(/pts?$/)).not.toBeInTheDocument();
    expect(within(score()).queryByText("0")).not.toBeInTheDocument();
  });
});

describe("readiness by skill", () => {
  it("shows a bar and its number for a known average, and Not enough data, with no bar, for a null one", () => {
    render(<SkillReadinessCard view={view()} />);
    expect(screen.getByText("20%")).toBeInTheDocument();
    expect(screen.getByText(/6 of 30/)).toBeInTheDocument();
    const communication = screen.getByText("Communication").closest("li")!;
    expect(within(communication).getByText("Not enough data")).toBeInTheDocument();
    expect(communication.querySelector("[aria-hidden='true']")).toBeNull();
    const coding = screen.getByText("Coding").closest("li")!;
    expect(within(coding).getByText("74")).toBeInTheDocument();
    expect(coding.querySelector("[aria-hidden='true']")).not.toBeNull();
  });

  it("lists the weakest topics in their box, and hides the box when there are none", () => {
    const { rerender } = render(<SkillReadinessCard view={view()} />);
    const box = screen.getByRole("list", { name: "Weakest topics" });
    expect(within(box).getByText(/DBMS · 48/)).toBeInTheDocument();

    rerender(<SkillReadinessCard view={view({ topGaps: [] })} />);
    expect(screen.queryByRole("list", { name: "Weakest topics" })).not.toBeInTheDocument();
    expect(screen.queryByText("Weakest topics")).not.toBeInTheDocument();
  });
});

describe("batches", () => {
  it("links each batch to the readiness table filtered by it, and says what is unknown", () => {
    render(<BatchesCard batches={view().batches!} orgId="o1" />);
    expect(screen.getByRole("link", { name: "CSE 2027" })).toHaveAttribute("href", "/campus/readiness?org=o1&batchId=b1");
    expect(screen.getByRole("link", { name: "ECE 2027" })).toHaveAttribute("href", "/campus/readiness?org=o1&batchId=b2");
    const ece = screen.getByRole("row", { name: /ECE 2027/ });
    expect(within(ece).getByText("Nothing due yet")).toBeInTheDocument();
    expect(within(ece).getByText("Not enough data")).toBeInTheDocument();
    expect(within(screen.getByRole("row", { name: /CSE 2027/ })).getByText("60%")).toBeInTheDocument();
  });

  it("opens the readiness table with the batch from the link already chosen", async () => {
    render(
      <CampusGate title="Readiness">
        <ReadinessPanel />
      </CampusGate>,
    );
    await waitFor(() => expect(api.fetchReadinessRows).toHaveBeenCalled());
    expect(api.fetchReadinessRows.mock.calls[0]?.[2]).toMatchObject({ batchId: "b1" });
  });
});

describe("the overview on the portal home", () => {
  it("renders the cards from the dashboard, with Export report opening the printable report", async () => {
    render(
      <CampusGate title="College portal">
        <PlacementDashboard />
      </CampusGate>,
    );
    expect(await screen.findByRole("heading", { name: "Practice pipeline" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Readiness by skill" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Batches" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Export report" })).toHaveAttribute("href", "/campus/reports/batch?org=o1");
    // The band chart and heatmap stay below.
    expect(screen.getByText("Readiness bands")).toBeInTheDocument();
  });

  it("falls back to the plain tiles when the server sends no overview fields", async () => {
    const older: DashboardView = view();
    for (const key of ["pipeline", "componentAverages", "topGaps", "trend", "batches"] as const) delete older[key];
    api.fetchDashboard.mockResolvedValue(older);
    render(
      <CampusGate title="College portal">
        <PlacementDashboard />
      </CampusGate>,
    );
    expect(await screen.findByText("Enrolled")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Practice pipeline" })).not.toBeInTheDocument();
  });
});
