import { render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssignedItem, MyProgrammeView, StudentReadiness } from "@untiered/shared";

import { MeCampus } from "./me-campus";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchMyAssignments: vi.fn(),
  fetchMyProgrammes: vi.fn(),
  fetchMyReadiness: vi.fn(),
  fetchMyLeaderboard: vi.fn(),
  setLeaderboardOptIn: vi.fn(),
  leaveCollege: vi.fn(),
  startMcqAttempt: vi.fn(),
}));

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
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const assigned: AssignedItem = {
  id: "a1",
  orgName: "Alpha College",
  title: "Technical interview: week 3",
  instructions: null,
  kind: "interview",
  roundType: "technical_fundamentals",
  durationMinutes: 30,
  companyName: null,
  roleTitle: null,
  candidateStage: "student",
  language: "english",
  focusTopic: null,
  scenarios: [],
  opensAt: "2026-11-01T00:00:00Z",
  dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  allowLate: false,
  status: "not_started",
  attemptsUsed: 0,
  attemptLimit: 1,
  canStart: true,
  blockedReason: null,
  sessionIds: [],
};

const programme: MyProgrammeView = {
  id: "p1",
  templateId: "t1",
  title: "6-week Placement Accelerator",
  startsOn: "2026-11-02",
  weeks: 6,
  targetBatches: [{ id: "b1", name: "CSE 2027" }],
  assignmentIds: ["a1"],
  status: "active",
  completedModules: 2,
  totalModules: 6,
  certificateId: null,
};

const readiness: StudentReadiness = {
  memberId: "m1",
  name: "Ananya Iyer",
  rollNumber: "R1",
  batchName: "CSE 2027",
  departmentCode: "CSE",
  overall: 74,
  band: "interview_ready",
  components: { coding: null, coreCs: 78, technicalInterview: 71, communication: null, aptitude: 80 },
  weights: { coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 },
  evidence: [],
  suggestedTopics: [],
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
  api.fetchMeCampus.mockResolvedValue({
    student: { orgId: "o1", orgName: "Alpha College", logoUrl: null, batchId: "b1", batchName: "CSE 2027", rollNumber: "R1" },
    staff: [],
  });
  api.fetchMyAssignments.mockResolvedValue([assigned]);
  api.fetchMyProgrammes.mockResolvedValue([programme]);
  api.fetchMyReadiness.mockResolvedValue(readiness);
  api.fetchMyLeaderboard.mockResolvedValue({ scope: "batch", optedIn: false, myRank: 3, rows: [{ rank: 3, displayName: "Anonymous student", overall: 74, isMe: true }] });
});
afterEach(() => vi.unstubAllEnvs());

describe("a student's campus page", () => {
  it("puts what the college assigned, the readiness, the leaderboard, the programme and leaving on one page", async () => {
    render(<MeCampus />);

    expect(await screen.findByText("Alpha College · CSE 2027")).toBeInTheDocument();
    const assignedSection = within((await screen.findByRole("heading", { name: "Assigned to you" })).closest("section")!);
    expect(assignedSection.getByRole("heading", { name: "Technical interview: week 3" })).toBeInTheDocument();
    expect(assignedSection.getByText("6-week Placement Accelerator")).toBeInTheDocument();
    expect(assignedSection.getByText(/2 of 6 modules completed/)).toBeInTheDocument();
    // We are already on the readiness page, so the link back to it is left out.
    expect(screen.queryByRole("link", { name: "See your readiness" })).not.toBeInTheDocument();

    const mine = within((await screen.findByRole("heading", { name: "My readiness" })).closest("section")!);
    expect(await mine.findByText("74 / 100")).toBeInTheDocument();
    expect(mine.getByTestId("score-ring")).toBeInTheDocument();
    // A part with no evidence says so, and is never drawn as 0.
    expect(mine.getAllByText("Not attempted").length).toBeGreaterThan(0);

    expect(await screen.findByRole("heading", { name: "Leaderboard" })).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: /Show my name on the leaderboard/ })).not.toBeChecked();
    expect(await screen.findByRole("button", { name: "Leave college" })).toBeInTheDocument();
  });

  it("draws no filled ring for a student with no score yet", async () => {
    api.fetchMyReadiness.mockResolvedValue({ ...readiness, overall: null, band: "not_enough_evidence" });
    render(<MeCampus />);

    const ring = await screen.findByTestId("score-ring");
    expect(ring.querySelectorAll("circle")).toHaveLength(1);
    expect(screen.getByText("Not attempted", { selector: "p.text-display" })).toBeInTheDocument();
  });
});
