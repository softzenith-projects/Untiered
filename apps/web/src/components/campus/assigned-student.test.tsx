import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssignedItem } from "@untiered/shared";

import { DashboardView } from "@/components/dashboard-panel";
import { NewInterviewForm } from "@/components/new-interview-form";

const api = vi.hoisted(() => ({
  fetchMyAssignments: vi.fn(),
  // "Assigned to you" also reads the student's programmes (module 10); none here.
  fetchMyProgrammes: vi.fn(() => Promise.resolve([])),
  startSession: vi.fn(),
  fetchEntitlement: vi.fn(),
  composeRound: vi.fn(),
}));
const push = vi.hoisted(() => vi.fn());

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
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

const { ApiRequestError } = await import("@/lib/api");

const item = (over: Partial<AssignedItem> = {}): AssignedItem => ({
  id: "a1",
  orgName: "Alpha College",
  title: "Mock technical round",
  instructions: "Speak clearly.",
  kind: "interview",
  roundType: "technical_fundamentals",
  durationMinutes: 30,
  companyName: "Infosys",
  roleTitle: "Systems Engineer",
  scenarios: [],
  opensAt: "2026-11-01T00:00:00Z",
  dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  allowLate: false,
  status: "not_started",
  attemptsUsed: 0,
  attemptLimit: 2,
  canStart: true,
  blockedReason: null,
  sessionIds: [],
  ...over,
});

const dashboard = () => render(<DashboardView entitlement={null} sessions={[]} readiness={[]} loaded />);

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchEntitlement.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("Assigned to you on the dashboard", () => {
  it("makes no request and shows nothing when the campus flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "false");
    dashboard();
    expect(api.fetchMyAssignments).not.toHaveBeenCalled();
    expect(screen.queryByRole("heading", { name: "Assigned to you" })).not.toBeInTheDocument();
  });

  it("shows no section when the list is empty", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([]);
    dashboard();
    await waitFor(() => expect(api.fetchMyAssignments).toHaveBeenCalled());
    expect(screen.queryByRole("heading", { name: "Assigned to you" })).not.toBeInTheDocument();
  });

  it("lists an assignment with a Start link to the assigned interview", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([item()]);
    dashboard();
    expect(await screen.findByRole("heading", { name: "Assigned to you" })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Mock technical round" })).toBeInTheDocument();
    expect(screen.getByText(/Alpha College · Technical interview, 30 minutes/)).toBeInTheDocument();
    expect(screen.getByText("Not started")).toBeInTheDocument();
    expect(screen.getByText(/0 of 2 attempts used/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /^Start Mock technical round/ })).toHaveAttribute("href", "/interview/new?assignment=a1");
  });

  it("explains in plain English why an interview cannot be started", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([
      item({ canStart: false, blockedReason: "attempt_limit", status: "overdue", attemptsUsed: 2 }),
    ]);
    dashboard();
    expect(await screen.findByText("You have used all the attempts allowed for this assignment.")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /^Start Mock technical round/ })).not.toBeInTheDocument();
  });

  it("links each unfinished scenario to its course in the Arena", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([
      item({
        kind: "arena_scenarios",
        roundType: null,
        durationMinutes: null,
        scenarios: [
          { id: "s1", title: "Slow checkout", courseSlug: "java", completed: false },
          { id: "s2", title: "Deadlock", courseSlug: "dsa", completed: true },
        ],
      }),
    ]);
    dashboard();
    expect(await screen.findByText(/2 Arena scenarios/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Open in the Arena.*Slow checkout/ })).toHaveAttribute("href", "/arena/java");
    expect(screen.getByText("Done")).toBeInTheDocument();
  });
});

describe("assigned interview form", () => {
  it("shows the locked round, keeps the consent gate and sends assignmentId", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([item()]);
    api.startSession.mockResolvedValue({ id: "sess1" });
    render(<NewInterviewForm assignmentId="a1" />);

    expect(await screen.findByRole("heading", { name: /Assigned by Alpha College: Mock technical round/ })).toBeInTheDocument();
    expect(screen.getByText("Infosys")).toBeInTheDocument();
    expect(screen.getByText("Systems Engineer")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();

    const begin = screen.getByRole("button", { name: "Begin interview" });
    expect(begin).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /Record my voice/ }));
    expect(begin).toBeEnabled();
    await userEvent.click(begin);

    await waitFor(() =>
      expect(api.startSession).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ assignmentId: "a1", consentAudio: true, roundType: "technical_fundamentals", durationMinutes: 30 }),
      ),
    );
    expect(push).toHaveBeenCalledWith("/interview/sess1");
  });

  it("does not let a blocked assignment start", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([item({ canStart: false, blockedReason: "past_due" })]);
    render(<NewInterviewForm assignmentId="a1" />);
    expect(await screen.findByText(/deadline has passed/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("checkbox", { name: /Record my voice/ }));
    expect(screen.getByRole("button", { name: "Begin interview" })).toBeDisabled();
  });

  it("says so when the assignment is not one of the student's", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([]);
    render(<NewInterviewForm assignmentId="zzz" />);
    expect(await screen.findByText(/not available to you/)).toBeInTheDocument();
  });

  it.each([
    ["assignment_not_found", 404, /no longer available/],
    ["assignment_not_open", 409, /not opened yet/],
    ["assignment_past_due", 409, /deadline has passed/],
    ["assignment_attempt_limit", 409, /used all the attempts/],
    ["assignment_student_cap", 409, /number of interviews your college allows/],
    ["college_allowance_exhausted", 402, /interview allowance/],
    ["session_in_progress", 409, /already have an interview in progress/],
  ])("maps %s to a clear message", async (code, status, text) => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMyAssignments.mockResolvedValue([item()]);
    api.startSession.mockRejectedValue(new ApiRequestError(status, code, "raw server text"));
    render(<NewInterviewForm assignmentId="a1" />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /Record my voice/ }));
    await userEvent.click(screen.getByRole("button", { name: "Begin interview" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
  });

  it("ignores the parameter when the campus flag is off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "false");
    render(<NewInterviewForm assignmentId="a1" />);
    expect(api.fetchMyAssignments).not.toHaveBeenCalled();
    expect(screen.getByRole("heading", { name: /Practise the interview you actually want/ })).toBeInTheDocument();
  });
});
