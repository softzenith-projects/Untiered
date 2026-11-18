import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { StudentReadiness } from "@untiered/shared";

import { StaffStudentReadiness } from "./staff-student-views";

const api = vi.hoisted(() => ({
  fetchStaffStudentIntegrity: vi.fn(),
  fetchStaffStudentReport: vi.fn(),
  fetchStudentReadiness: vi.fn(),
  fetchStudentIntegrityTotals: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ ...api, ApiRequestError: class ApiRequestError extends Error {} }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("./staff-notes", () => ({ StaffNotesPanel: () => <p>Staff notes</p> }));
vi.mock("./campus-context", () => ({
  useCampusOrg: () => ({ orgId: "org1", orgName: "Alpha College", logoUrl: null, role: "faculty", accessToken: "token" }),
  campusHref: (path: string, orgId: string) => `${path}?org=${orgId}`,
}));

const readiness = (staff: StudentReadiness["staff"]): StudentReadiness => ({
  memberId: "m1",
  name: "Asha Rao",
  rollNumber: "A-001",
  batchName: "CSE 2027",
  departmentCode: "CSE",
  overall: 41,
  band: "needs_structured_prep",
  components: { coding: null, coreCs: 40, technicalInterview: 42, communication: null, aptitude: null },
  weights: { coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 },
  evidence: [],
  suggestedTopics: [],
  staff,
});

const totals = { rounds: 2, windowSwitches: 5, tabHidden: 3, windowBlur: 2, pastes: 1, fastAnswers: 4, longPauses: 0 };

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchStudentIntegrityTotals.mockResolvedValue(totals);
});

describe("the staff student page", () => {
  it("names why the student needs attention, when they were last active and the assigned work with its report", async () => {
    api.fetchStudentReadiness.mockResolvedValue(
      readiness({
        lastActiveAt: new Date(Date.now() - 20 * 86_400_000).toISOString(),
        attention: ["low_score", "inactive", "overdue"],
        assignedWork: [
          { assignmentId: "a1", title: "Technical round", kind: "interview", status: "completed", dueAt: "2026-11-20T10:00:00Z", sessionId: "s1" },
          { assignmentId: "a2", title: "Aptitude round", kind: "interview", status: "overdue", dueAt: "2026-11-10T10:00:00Z", sessionId: null },
          { assignmentId: "a3", title: "Core CS test", kind: "mcq_test", status: "completed", dueAt: "2026-11-21T10:00:00Z", mcqAttemptId: "q1" },
        ],
      }),
    );
    render(<StaffStudentReadiness memberId="m1" />);

    const callout = await screen.findByLabelText("Needs attention");
    expect(within(callout).getByText("Low score")).toBeInTheDocument();
    expect(within(callout).getByText("Inactive for 14 days")).toBeInTheDocument();
    expect(within(callout).getByText("Overdue work")).toBeInTheDocument();
    expect(screen.getByText("20 days ago")).toBeInTheDocument();

    const work = within(await screen.findByRole("heading", { name: "Assigned work" }).then((h) => h.closest("section")!));
    expect(work.getByText("Technical round")).toBeInTheDocument();
    expect(work.getByRole("link", { name: "Report: Technical round" })).toHaveAttribute("href", "/campus/readiness/m1/reports/s1?org=org1");
    // Not completed, so there is nothing to open.
    expect(work.queryByRole("link", { name: /Aptitude round/ })).not.toBeInTheDocument();
    expect(work.getByRole("link", { name: "View answers: Core CS test" })).toHaveAttribute("href", "/campus/readiness/m1/tests/q1?org=org1");
  });

  it("shows integrity counts as counts, never a verdict", async () => {
    api.fetchStudentReadiness.mockResolvedValue(readiness({ lastActiveAt: null, attention: [], assignedWork: [] }));
    render(<StaffStudentReadiness memberId="m1" />);

    const section = within((await screen.findByRole("heading", { name: "Integrity signals on assigned rounds" })).closest("section")!);
    expect(section.getByText("Window switches: 5")).toBeInTheDocument();
    expect(section.getByText("Pastes: 1")).toBeInTheDocument();
    expect(section.getByText("Unusually fast answers: 4")).toBeInTheDocument();
    expect(section.getByText(/never a verdict/)).toBeInTheDocument();
    expect(api.fetchStudentIntegrityTotals).toHaveBeenCalledWith("org1", "m1", expect.objectContaining({ accessToken: "token" }));
  });

  it("shows no needs-attention callout for a student who needs none, and says so plainly when no round was started", async () => {
    api.fetchStudentReadiness.mockResolvedValue(readiness({ lastActiveAt: new Date().toISOString(), attention: [], assignedWork: [] }));
    api.fetchStudentIntegrityTotals.mockResolvedValue({ ...totals, rounds: 0, windowSwitches: 0, pastes: 0, fastAnswers: 0 });
    render(<StaffStudentReadiness memberId="m1" />);

    expect(await screen.findByText(/No assigned round has been started yet/)).toBeInTheDocument();
    expect(screen.queryByLabelText("Needs attention")).not.toBeInTheDocument();
    expect(screen.queryByText(/Window switches/)).not.toBeInTheDocument();
    expect(screen.getByText("Nothing assigned yet.")).toBeInTheDocument();
  });

  it("leaves the integrity section out when the counts cannot be read", async () => {
    api.fetchStudentReadiness.mockResolvedValue(readiness({ lastActiveAt: null, attention: [], assignedWork: [] }));
    api.fetchStudentIntegrityTotals.mockRejectedValue(new Error("403"));
    render(<StaffStudentReadiness memberId="m1" />);

    expect(await screen.findByText("Nothing assigned yet.")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Integrity signals on assigned rounds" })).not.toBeInTheDocument();
  });
});
