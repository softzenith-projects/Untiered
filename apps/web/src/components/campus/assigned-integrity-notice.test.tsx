import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { AssignedItem } from "@untiered/shared";

import { ASSIGNED_INTEGRITY_NOTICE, NewInterviewForm } from "@/components/new-interview-form";

const api = vi.hoisted(() => ({
  fetchMyAssignments: vi.fn(),
  // "Assigned to you" also reads the student's programmes (module 10); none here.
  fetchMyProgrammes: vi.fn(() => Promise.resolve([])),
  startSession: vi.fn(),
  fetchEntitlement: vi.fn(),
  composeRound: vi.fn(),
  fetchLoopBrief: vi.fn(),
  fetchPrepPlan: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  ApiRequestError: class ApiRequestError extends Error {},
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const assigned: AssignedItem = {
  id: "a1",
  orgName: "Alpha College",
  title: "Mock technical round",
  instructions: null,
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
};

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
  api.fetchEntitlement.mockResolvedValue(null);
  api.fetchPrepPlan.mockResolvedValue({ items: [], unsimulatedStages: [] });
  api.fetchLoopBrief.mockResolvedValue(null);
});
afterEach(() => vi.unstubAllEnvs());

describe("what an assigned round counts, said before consent", () => {
  it("tells the student, in plain words, before the consent step of an assigned interview", async () => {
    api.fetchMyAssignments.mockResolvedValue([assigned]);
    render(<NewInterviewForm assignmentId="a1" />);

    const notice = await screen.findByText(ASSIGNED_INTEGRITY_NOTICE);
    expect(notice).toHaveTextContent(
      "Because your college assigned this interview, it will see how many times you switched tabs or windows or pasted text, and how your answer timing looked. Nothing else about your screen is recorded.",
    );
    expect(notice).toHaveTextContent("They are counts, never a verdict, and nobody is failed automatically.");
    const consent = screen.getByRole("checkbox", { name: /Record my voice/ });
    // Earlier in the document than the consent it qualifies.
    expect(notice.compareDocumentPosition(consent) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("is not on a personal round's start screen, which counts nothing", async () => {
    render(<NewInterviewForm />);
    await userEvent.click(screen.getByRole("button", { name: "Amazon" }));
    await userEvent.type(screen.getByRole("textbox", { name: /^role\b/i }), "Software Development Engineer");
    await userEvent.click(screen.getByRole("button", { name: /continue to interview setup/i }));

    expect(await screen.findByRole("checkbox", { name: /record my voice/i })).toBeInTheDocument();
    expect(screen.queryByText(/switched tabs or windows or pasted text/)).not.toBeInTheDocument();
    expect(api.fetchMyAssignments).not.toHaveBeenCalled();
  });
});
