import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssignmentView, RecipientProgress } from "@untiered/shared";

import { AssignmentDetail, sortProgress } from "./assignment-detail";
import { defaultComponent, emptyForm, toInput, validateForm } from "./assignment-model";
import { AssignmentsPanel } from "./assignments-panel";
import { CampusGate } from "./campus-context";
import { NewAssignment } from "./new-assignment";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchArenaScenarios: vi.fn(),
  fetchBatches: vi.fn(),
  fetchMembers: vi.fn(),
  fetchAssignments: vi.fn(),
  createAssignment: vi.fn(),
  publishAssignment: vi.fn(),
  archiveAssignment: vi.fn(),
  updateAssignment: vi.fn(),
  fetchAssignment: vi.fn(),
  fetchAssignmentProgress: vi.fn(),
  fetchCampusOrg: vi.fn(),
}));
const nav = vi.hoisted(() => ({ push: vi.fn() }));

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
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/campus/assignments",
  useRouter: () => ({ push: nav.push }),
}));

const { ApiRequestError } = await import("@/lib/api");

const view = (over: Partial<AssignmentView> = {}): AssignmentView => ({
  id: "a1",
  kind: "interview",
  title: "Mock technical round",
  instructions: null,
  roundType: "technical_fundamentals",
  durationMinutes: 30,
  companyName: null,
  roleTitle: null,
  candidateStage: "student",
  focusTopic: null,
  language: "english",
  dueAt: "2027-01-10T10:00:00Z",
  allowLate: false,
  attemptLimit: 2,
  interviewCap: null,
  targets: { batchIds: ["b1"], memberIds: [] },
  component: "technical_interview",
  topic: null,
  status: "draft",
  createdAt: "2026-11-01T00:00:00Z",
  publishedAt: null,
  createdByName: "Priya",
  targetBatches: [{ id: "b1", name: "CSE 2027" }],
  targetStudents: [],
  counts: { recipients: 3, notStarted: 1, inProgress: 1, completed: 1, overdue: 0 },
  ...over,
});

const progress = (over: Partial<RecipientProgress>): RecipientProgress => ({
  memberId: "m1",
  name: "Asha",
  email: "asha@x.edu",
  rollNumber: "R1",
  batchName: "CSE 2027",
  status: "not_started",
  attemptsUsed: 0,
  lastActivityAt: null,
  sessionIds: [],
  scenarioScore: null,
  mcqScore: null,
  ...over,
});

function gated(child: React.ReactNode) {
  return render(<CampusGate title="Assignments">{child}</CampusGate>);
}

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchMeCampus.mockResolvedValue({
    student: null,
    staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "tpo" }],
  });
  api.fetchArenaScenarios.mockResolvedValue([
    { id: "sc1", courseTitle: "Java", title: "Slow checkout", tier: "core", estimatedMinutes: 10 },
  ]);
  api.fetchBatches.mockResolvedValue([
    { id: "b1", departmentId: "d1", departmentCode: "CSE", graduationYear: 2027, name: "CSE 2027", studentCount: 40 },
  ]);
  api.fetchMembers.mockResolvedValue({ items: [], nextCursor: null });
  api.fetchCampusOrg.mockResolvedValue({ id: "o1", name: "Alpha College", interviewAllowance: 200, interviewsUsed: 37 });
});

describe("assignment model", () => {
  it("derives the readiness component from the round type", () => {
    expect(defaultComponent("interview", "coding_practical")).toBe("coding");
    expect(defaultComponent("interview", "aptitude")).toBe("aptitude");
    expect(defaultComponent("interview", "hr_fit_closing")).toBe("communication");
    expect(defaultComponent("interview", "behavioural_competency")).toBe("communication");
    expect(defaultComponent("interview", "technical_fundamentals")).toBe("technical_interview");
    expect(defaultComponent("interview", "project_deep_dive")).toBe("technical_interview");
    expect(defaultComponent("interview", "custom_topic")).toBe("core_cs");
    expect(defaultComponent("arena_scenarios", undefined)).toBe("core_cs");
    expect(
      defaultComponent("arena_scenarios", undefined, [{ id: "1", courseTitle: "DSA", title: "t", tier: "c", estimatedMinutes: 5 }]),
    ).toBe("coding");
  });

  it("validates a custom topic, the cap and the targets, and sends 30 minutes for a topic round", () => {
    const form = { ...emptyForm(), title: "T", dueAt: "2027-01-10T10:00", batchIds: ["b1"] };
    expect(validateForm(form)).toEqual([]);
    expect(validateForm({ ...form, roundType: "custom_topic" })).toContain("A topic round needs a focus topic.");
    expect(validateForm({ ...form, attemptLimit: "2", interviewCap: "3" })).toContain(
      "The interview cap cannot be more than the attempts per student.",
    );
    expect(validateForm({ ...form, batchIds: [] })).toContain("Choose at least one batch or student.");
    const body = toInput({ ...form, roundType: "custom_topic", durationMinutes: 60, focusTopic: " DBMS " });
    expect(body.durationMinutes).toBe(30);
    expect(body.focusTopic).toBe("DBMS");
    expect(body.dueAt).toMatch(/Z$/);
  });
});

describe("assignment builder", () => {
  it("forces 30 minutes and requires a focus topic for a topic round, enforces the cap, and publishes", async () => {
    api.createAssignment.mockResolvedValue(view({ id: "a9" }));
    api.publishAssignment.mockResolvedValue(view({ id: "a9", status: "published" }));
    gated(<NewAssignment />);

    await userEvent.type(await screen.findByLabelText("Title"), "Topic check");
    await userEvent.selectOptions(screen.getByLabelText("Round type"), "custom_topic");
    expect(screen.getByLabelText("Length")).toBeDisabled();
    expect(screen.getByLabelText("Length")).toHaveValue("30");

    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("A topic round needs a focus topic.")).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText("Focus topic"), "DBMS normalisation");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    await userEvent.click(await screen.findByRole("checkbox", { name: /CSE 2027/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));

    fireEvent.change(await screen.findByLabelText("Deadline"), { target: { value: "2027-01-10T10:00" } });
    expect(screen.getByLabelText("Readiness component")).toHaveValue("core_cs");
    await userEvent.clear(screen.getByLabelText("Attempts per student"));
    await userEvent.type(screen.getByLabelText("Attempts per student"), "2");
    await userEvent.type(screen.getByLabelText(/Interview cap/), "3");
    await userEvent.click(screen.getByRole("button", { name: "Save and publish" }));
    expect(await screen.findByText("The interview cap cannot be more than the attempts per student.")).toBeInTheDocument();
    expect(api.createAssignment).not.toHaveBeenCalled();

    await userEvent.clear(screen.getByLabelText(/Interview cap/));
    await userEvent.type(screen.getByLabelText(/Interview cap/), "2");
    await userEvent.click(screen.getByRole("button", { name: "Save and publish" }));
    await waitFor(() => expect(api.publishAssignment).toHaveBeenCalledWith("token", "o1", "a9"));
    expect(api.createAssignment).toHaveBeenCalledWith(
      "token",
      "o1",
      expect.objectContaining({
        kind: "interview",
        roundType: "custom_topic",
        durationMinutes: 30,
        focusTopic: "DBMS normalisation",
        attemptLimit: 2,
        interviewCap: 2,
        component: "core_cs",
        targets: { batchIds: ["b1"], memberIds: [] },
      }),
    );
    expect(nav.push).toHaveBeenCalledWith("/campus/assignments/a9?org=o1");
  });

  it("defaults the readiness component from the round until the user changes it", async () => {
    gated(<NewAssignment />);
    await userEvent.type(await screen.findByLabelText("Title"), "Aptitude check");
    await userEvent.selectOptions(screen.getByLabelText("Round type"), "aptitude");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /CSE 2027/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByLabelText("Readiness component")).toHaveValue("aptitude");
  });

  it("shows the API validation message when saving fails", async () => {
    api.createAssignment.mockRejectedValue(new ApiRequestError(400, "assignment_invalid", "dueAt must be in the future"));
    gated(<NewAssignment />);
    await userEvent.type(await screen.findByLabelText("Title"), "Round");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /CSE 2027/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Deadline"), { target: { value: "2020-01-01T10:00" } });
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));
    expect(await screen.findByText("dueAt must be in the future")).toBeInTheDocument();
  });

  it("lists scenarios for an Arena assignment and requires at least one", async () => {
    gated(<NewAssignment />);
    await userEvent.click(await screen.findByRole("radio", { name: /Arena scenario set/ }));
    await userEvent.type(screen.getByLabelText("Title"), "Arena");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("Choose between 1 and 20 scenarios.")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Slow checkout/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByRole("group", { name: "Batches" })).toBeInTheDocument();
  });
});

describe("assignments list", () => {
  it("filters by status and shows counts", async () => {
    api.fetchAssignments.mockResolvedValue([view({ status: "published" })]);
    gated(<AssignmentsPanel />);
    expect(await screen.findByRole("link", { name: "Mock technical round" })).toHaveAttribute("href", "/campus/assignments/a1?org=o1");
    await userEvent.selectOptions(screen.getByLabelText("Status"), "published");
    await waitFor(() => expect(api.fetchAssignments).toHaveBeenLastCalledWith("o1", expect.anything(), "published"));
  });
});

describe("assignments header tiles", () => {
  it("shows the college's allowance, published and draft counts and overdue tasks to any staff role", async () => {
    api.fetchMeCampus.mockResolvedValue({
      student: null,
      staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "faculty" }],
    });
    api.fetchAssignments.mockResolvedValue([
      view({ id: "a1", status: "published", counts: { recipients: 5, notStarted: 1, inProgress: 1, completed: 1, overdue: 2 } }),
      view({ id: "a2", status: "published", counts: { recipients: 2, notStarted: 0, inProgress: 0, completed: 1, overdue: 1 } }),
      view({ id: "a3", status: "draft", counts: { recipients: 0, notStarted: 0, inProgress: 0, completed: 0, overdue: 0 } }),
    ]);
    gated(<AssignmentsPanel />);

    const tiles = within(await screen.findByRole("list", { name: "Assignment totals" }));
    const used = within(tiles.getByRole("heading", { name: "College interviews used" }).closest("li")!);
    expect(used.getByText("37")).toBeInTheDocument();
    expect(used.getByText(/of 200 in the allowance/)).toBeInTheDocument();
    const published = within(tiles.getByRole("heading", { name: "Published assignments" }).closest("li")!);
    expect(published.getByText("2")).toBeInTheDocument();
    expect(published.getByText("1 draft")).toBeInTheDocument();
    expect(within(tiles.getByRole("heading", { name: "Overdue student tasks" }).closest("li")!).getByText("3")).toBeInTheDocument();
    expect(api.fetchCampusOrg).toHaveBeenCalledWith("o1", expect.anything());
  });

  it("leaves out the allowance tile when the college could not be read, and keeps the rest", async () => {
    api.fetchCampusOrg.mockRejectedValue(new Error("nope"));
    api.fetchAssignments.mockResolvedValue([view({ status: "published" })]);
    gated(<AssignmentsPanel />);
    const tiles = within(await screen.findByRole("list", { name: "Assignment totals" }));
    expect(tiles.queryByRole("heading", { name: "College interviews used" })).not.toBeInTheDocument();
    expect(tiles.getByRole("heading", { name: "Published assignments" })).toBeInTheDocument();
  });
});

describe("assignment detail", () => {
  it("shows completed, in progress, not started and overdue tiles, and links a completed interview to its report", async () => {
    api.fetchAssignment.mockResolvedValue(
      view({ status: "published", counts: { recipients: 4, notStarted: 1, inProgress: 1, completed: 2, overdue: 0 } }),
    );
    api.fetchAssignmentProgress.mockResolvedValue([
      progress({ memberId: "m1", name: "Asha", status: "completed", completedSessionId: "s9", sessionIds: ["s8", "s9"] }),
      progress({ memberId: "m2", name: "Ben", status: "in_progress", sessionIds: ["s7"] }),
    ]);
    gated(<AssignmentDetail id="a1" />);

    const tiles = within(await screen.findByRole("list", { name: "Completion" }));
    expect(within(tiles.getByRole("heading", { name: "Completed" }).closest("li")!).getByText("50% of 4 students")).toBeInTheDocument();
    expect(tiles.getByRole("heading", { name: "In progress" })).toBeInTheDocument();
    expect(tiles.getByRole("heading", { name: "Not started" })).toBeInTheDocument();
    expect(tiles.getByRole("heading", { name: "Overdue" })).toBeInTheDocument();

    expect(await screen.findByRole("link", { name: "Report for Asha" })).toHaveAttribute(
      "href",
      "/campus/readiness/m1/reports/s9?org=o1",
    );
    // Not finished: no report to open, only the student.
    expect(screen.queryByRole("link", { name: "Report for Ben" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Student: Ben" })).toHaveAttribute("href", "/campus/readiness/m2?org=o1");
  });

  it("asks for confirmation before publishing a draft", async () => {
    api.fetchAssignment.mockResolvedValue(view());
    api.publishAssignment.mockResolvedValue(view({ status: "published" }));
    api.fetchAssignmentProgress.mockResolvedValue([]);
    gated(<AssignmentDetail id="a1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Publish" }));
    expect(api.publishAssignment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, publish" }));
    await waitFor(() => expect(api.publishAssignment).toHaveBeenCalledWith("token", "o1", "a1"));
    expect(await screen.findByText("Published. Students can see it now.")).toBeInTheDocument();
  });

  it("limits edits of a published assignment to deadline, late setting and instructions", async () => {
    api.fetchAssignment.mockResolvedValue(view({ status: "published" }));
    api.fetchAssignmentProgress.mockResolvedValue([]);
    api.updateAssignment.mockResolvedValue(view({ status: "published", allowLate: true }));
    gated(<AssignmentDetail id="a1" />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit" }));
    expect(screen.queryByLabelText("Round type")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: "Allow late attempts" }));
    await userEvent.click(screen.getByRole("button", { name: "Save changes" }));
    await waitFor(() =>
      expect(api.updateAssignment).toHaveBeenCalledWith("token", "o1", "a1", {
        dueAt: expect.stringMatching(/Z$/),
        allowLate: true,
        instructions: null,
      }),
    );
  });

  it("filters and sorts the progress table and shows scenario scores as percentages", async () => {
    api.fetchAssignment.mockResolvedValue(view({ status: "published", kind: "arena_scenarios", scenarioIds: ["sc1"] }));
    api.fetchAssignmentProgress.mockResolvedValue([
      progress({ memberId: "m2", name: "Zed", status: "completed", scenarioScore: 0.75, lastActivityAt: "2026-12-01T10:00:00Z" }),
      progress({ memberId: "m1", name: "Asha", status: "not_started" }),
    ]);
    gated(<AssignmentDetail id="a1" />);

    expect(await screen.findByText("75%")).toBeInTheDocument();
    const rows = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("cell")[0]!.textContent);
    expect(rows()[0]).toMatch(/Asha/);

    await userEvent.click(screen.getByRole("button", { name: "Last activity" }));
    await userEvent.click(screen.getByRole("button", { name: "Last activity" }));
    expect(rows()[0]).toMatch(/Zed/);

    await userEvent.selectOptions(screen.getByLabelText("Status"), "completed");
    await waitFor(() =>
      expect(api.fetchAssignmentProgress).toHaveBeenLastCalledWith("o1", "a1", expect.anything(), { status: "completed" }),
    );
    await userEvent.selectOptions(screen.getByLabelText("Batch"), "b1");
    await waitFor(() =>
      expect(api.fetchAssignmentProgress).toHaveBeenLastCalledWith("o1", "a1", expect.anything(), { batchId: "b1", status: "completed" }),
    );
  });

  it("shows attempts used out of the limit for interviews", async () => {
    api.fetchAssignment.mockResolvedValue(view({ status: "published", attemptLimit: 3 }));
    api.fetchAssignmentProgress.mockResolvedValue([progress({ status: "in_progress", attemptsUsed: 2 })]);
    gated(<AssignmentDetail id="a1" />);
    expect(await screen.findByText("2 of 3")).toBeInTheDocument();
  });
});

describe("sortProgress", () => {
  it("orders by status with overdue first", () => {
    const sorted = sortProgress(
      [progress({ memberId: "a", status: "completed" }), progress({ memberId: "b", status: "overdue" })],
      "status",
      "asc",
    );
    expect(sorted.map((row) => row.memberId)).toEqual(["b", "a"]);
  });
});
