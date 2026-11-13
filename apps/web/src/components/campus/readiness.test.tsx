import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { DashboardView, StudentReadiness, StudentReadinessRow } from "@untiered/shared";

import { BatchReport } from "./batch-report";
import { CampusGate } from "./campus-context";
import { BandChart, SkillHeatmap, StatTiles } from "./dashboard-widgets";
import { MyReadiness } from "./my-readiness";
import { NO_COURSE_TEXT, practiceLinks } from "./readiness-model";
import { ReadinessPanel } from "./readiness-panel";
import { StudentReadinessView } from "./student-readiness-view";
import { WeightsEditor } from "./weights-editor";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchBatches: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchDashboard: vi.fn(),
  fetchReadinessRows: vi.fn(),
  downloadStudentsCsv: vi.fn(),
  recordBatchReportViewed: vi.fn(),
  fetchReadinessWeights: vi.fn(),
  updateReadinessWeights: vi.fn(),
  fetchMyReadiness: vi.fn(),
}));
const saveBlob = vi.hoisted(() => vi.fn());

vi.mock("@/lib/api", () => ({
  ...api,
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("./download", () => ({ saveBlob }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({
  usePathname: () => "/campus/readiness",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("org=o1&batchId=b1"),
}));

const bands = { strong: 1, interview_ready: 2, needs_improvement: 0, needs_structured_prep: 3, not_enough_evidence: 4 };
const dashboard: DashboardView = {
  filters: { batchId: null, departmentId: null },
  enrolled: 20,
  joined: 10,
  active: 6,
  completionRate: null,
  bands,
  heatmap: {
    columns: ["dsa", "dbms"],
    rows: [
      {
        departmentId: "d1",
        departmentCode: "CSE",
        cells: [
          { topic: "dsa", average: 72, students: 5 },
          { topic: "dbms", average: null, students: 2 },
        ],
      },
    ],
  },
};

const row = (over: Partial<StudentReadinessRow> = {}): StudentReadinessRow => ({
  memberId: "m1",
  name: "Asha",
  rollNumber: "R1",
  batchName: "CSE 2027",
  departmentCode: "CSE",
  overall: 64,
  band: "needs_improvement",
  components: { coding: 70, coreCs: null, technicalInterview: 60, communication: null, aptitude: null },
  assignmentsCompleted: 2,
  assignmentsOverdue: 1,
  lastActiveAt: null,
  ...over,
});

const readiness = (over: Partial<StudentReadiness> = {}): StudentReadiness => ({
  memberId: "m1",
  name: "Asha",
  rollNumber: "R1",
  batchName: "CSE 2027",
  departmentCode: "CSE",
  overall: 64,
  band: "interview_ready",
  components: { coding: 70, coreCs: null, technicalInterview: 60, communication: null, aptitude: null },
  weights: { coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 },
  evidence: [
    { assignmentId: "a2", assignmentTitle: "Mock round", component: "technical_interview", topic: null, kind: "interview", sessionId: "s1", score: 60, completedAt: "2026-11-02T00:00:00Z" },
    { assignmentId: "a1", assignmentTitle: "Arrays", component: "coding", topic: "dsa", kind: "arena_scenarios", sessionId: null, score: 70, completedAt: "2026-10-01T00:00:00Z" },
  ],
  suggestedTopics: [
    { component: "core_cs", topic: "dbms", reason: "Average 58 across 2 DBMS assignments." },
    { component: "coding", topic: "dsa", reason: "Average 62 across 2 DSA assignments." },
  ],
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchMeCampus.mockResolvedValue({ staff: [{ orgId: "o1", orgName: "Test College", logoUrl: null, role: "tpo" }] });
  api.fetchBatches.mockResolvedValue([{ id: "b1", departmentId: "d1", departmentCode: "CSE", graduationYear: 2027, name: "CSE 2027", studentCount: 3 }]);
  api.fetchDepartments.mockResolvedValue([{ id: "d1", code: "CSE", name: "Computer Science", batchCount: 1 }]);
  api.fetchDashboard.mockResolvedValue(dashboard);
  api.fetchReadinessRows.mockResolvedValue({ items: [row()], nextCursor: null });
  api.recordBatchReportViewed.mockResolvedValue(undefined);
});

describe("readiness display", () => {
  it("shows Not attempted for a null component, never 0, and the band pill text", () => {
    render(<StudentReadinessView readiness={readiness()} />);
    expect(screen.getAllByText("Not attempted").length).toBeGreaterThanOrEqual(3);
    expect(screen.getByText("Interview ready")).toBeInTheDocument();
    expect(screen.getByText(/Core CS · weight 25%/)).toBeInTheDocument();
    expect(screen.queryByText("0")).not.toBeInTheDocument();
  });

  it("links an interview item to its staff report and offers an accessible score table", () => {
    render(<StudentReadinessView readiness={readiness()} reportHref={(item) => `/campus/readiness/m1/reports/${item.sessionId}` as never} />);
    expect(screen.getByRole("link", { name: /View report/ })).toHaveAttribute("href", "/campus/readiness/m1/reports/s1");
    expect(screen.getByRole("img", { name: /Evidence scores over time/ })).toBeInTheDocument();
  });

  it("gives a topic with no course plain text instead of a link", () => {
    render(<StudentReadinessView readiness={readiness()} />);
    expect(screen.getAllByText(NO_COURSE_TEXT)).toHaveLength(1);
    expect(screen.getByRole("link", { name: /Data Structures.*course/ })).toHaveAttribute("href", "/courses/dsa");
  });

  it("the practice map never links a topic without a course", () => {
    for (const topic of ["dbms", "os", "cn", "aptitude", "communication"] as const) {
      expect(practiceLinks("core_cs", topic)).toEqual([]);
    }
    expect(practiceLinks("aptitude", null)).toEqual([]);
    for (const link of practiceLinks("coding", "dsa")) expect(link.href).toMatch(/dsa$/);
  });
});

describe("dashboard widgets", () => {
  it("hides the completion tile when the rate is null", () => {
    const { rerender } = render(<StatTiles view={dashboard} />);
    expect(screen.getByText("Enrolled")).toBeInTheDocument();
    expect(screen.queryByText("Assignment completion")).not.toBeInTheDocument();
    rerender(<StatTiles view={{ ...dashboard, completionRate: 0.5 }} />);
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  it("labels a null heatmap cell as not enough data and every bar with its count", () => {
    render(
      <>
        <SkillHeatmap heatmap={dashboard.heatmap} />
        <BandChart bands={bands} />
      </>,
    );
    expect(screen.getByText("Not enough data")).toBeInTheDocument();
    expect(screen.getByText("72")).toBeInTheDocument();
    const table = screen.getByRole("table", { name: "Students by readiness band", hidden: true });
    expect(within(table).getByRole("row", { name: /Needs structured prep 3/, hidden: true })).toBeInTheDocument();
  });
});

describe("student table", () => {
  it("requests server sorting and filtering and loads the next page by cursor", async () => {
    const user = userEvent.setup();
    api.fetchReadinessRows.mockResolvedValueOnce({ items: [row()], nextCursor: "c1" });
    render(
      <CampusGate title="Readiness">
        <ReadinessPanel />
      </CampusGate>,
    );
    await screen.findByText("Asha");
    expect(api.fetchReadinessRows.mock.calls[0]?.[2]).toMatchObject({ sort: "name", order: "asc" });

    await user.click(screen.getByRole("button", { name: /^Overall/ }));
    await waitFor(() => expect(api.fetchReadinessRows.mock.calls.at(-1)?.[2]).toMatchObject({ sort: "overall", order: "desc" }));

    await user.selectOptions(screen.getByLabelText("Band"), "strong");
    await waitFor(() => expect(api.fetchReadinessRows.mock.calls.at(-1)?.[2]).toMatchObject({ band: "strong" }));
    expect(screen.getAllByText("Not attempted").length).toBeGreaterThan(0);
  });

  it("pages with the cursor", async () => {
    const user = userEvent.setup();
    api.fetchReadinessRows.mockResolvedValueOnce({ items: [row()], nextCursor: "c1" });
    api.fetchReadinessRows.mockResolvedValueOnce({ items: [row({ memberId: "m2", name: "Bela" })], nextCursor: null });
    render(
      <CampusGate title="Readiness">
        <ReadinessPanel />
      </CampusGate>,
    );
    await user.click(await screen.findByRole("button", { name: "Load more" }));
    await screen.findByText("Bela");
    expect(api.fetchReadinessRows.mock.calls[1]?.[2]).toMatchObject({ cursor: "c1" });
  });

  it("exports the CSV with the token and triggers a download", async () => {
    const user = userEvent.setup();
    const blob = new Blob(["a,b"]);
    api.downloadStudentsCsv.mockResolvedValue(blob);
    render(
      <CampusGate title="Readiness">
        <ReadinessPanel />
      </CampusGate>,
    );
    await screen.findByText("Asha");
    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    await waitFor(() => expect(saveBlob).toHaveBeenCalledWith(blob, "students-readiness.csv"));
    expect(api.downloadStudentsCsv).toHaveBeenCalledWith("o1", "token", expect.any(Object));
  });
});

describe("downloadStudentsCsv", () => {
  it("fetches with the bearer token", async () => {
    const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
    const fetchMock = vi.fn().mockResolvedValue(new Response("x", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    await actual.downloadStudentsCsv("o1", "tok", { batchId: "b1" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/campus/orgs/o1/exports/students.csv?batchId=b1");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    vi.unstubAllGlobals();
    // importActual cold-loads the real API module and its Supabase client, which is slow under
    // full-suite load; the time is the import, not the behaviour under test.
  }, 20_000);
});

describe("weights editor", () => {
  it("blocks saving unless the weights sum to 100, and shows the server error", async () => {
    const user = userEvent.setup();
    api.fetchReadinessWeights.mockResolvedValue({ coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 });
    const { ApiRequestError } = await import("@/lib/api");
    api.updateReadinessWeights.mockRejectedValue(new ApiRequestError(400, "weights_invalid", "Weights must add up to 100."));
    render(
      <CampusGate title="Settings">
        <WeightsEditor />
      </CampusGate>,
    );
    const coding = await screen.findByLabelText("Coding");
    const save = screen.getByRole("button", { name: "Save weights" });
    expect(save).toBeEnabled();
    await user.clear(coding);
    await user.type(coding, "40");
    expect(screen.getByText(/Total 110 of 100/)).toBeInTheDocument();
    expect(save).toBeDisabled();
    await user.clear(coding);
    await user.type(coding, "30");
    expect(save).toBeEnabled();
    await user.click(save);
    expect(await screen.findByText("Weights must add up to 100.")).toBeInTheDocument();
  });
});

describe("batch report", () => {
  it("audits the view once and offers a print button", async () => {
    const print = vi.fn();
    vi.stubGlobal("print", print);
    const user = userEvent.setup();
    render(
      <CampusGate title="Batch report">
        <BatchReport />
      </CampusGate>,
    );
    await screen.findByText("Placement readiness report");
    expect(api.recordBatchReportViewed).toHaveBeenCalledTimes(1);
    expect(api.recordBatchReportViewed).toHaveBeenCalledWith("token", "o1", { batchId: "b1" });
    const button = await screen.findByRole("button", { name: "Print / Save as PDF" });
    await waitFor(() => expect(button).toBeEnabled());
    await user.click(button);
    expect(print).toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});

describe("student view", () => {
  it("shows a friendly state when the student is not in a college", async () => {
    const { ApiRequestError } = await import("@/lib/api");
    api.fetchMyReadiness.mockRejectedValue(new ApiRequestError(404, "not_found", "nope"));
    render(<MyReadiness />);
    expect(await screen.findByText("You are not in a college on Untiered")).toBeInTheDocument();
  });

  it("renders their own readiness", async () => {
    api.fetchMyReadiness.mockResolvedValue(readiness());
    render(<MyReadiness />);
    expect(await screen.findByText("Interview ready")).toBeInTheDocument();
  });
});
