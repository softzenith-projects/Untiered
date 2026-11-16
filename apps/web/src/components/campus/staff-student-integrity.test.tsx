import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { StaffStudentReport } from "./staff-student-views";

const api = vi.hoisted(() => ({
  fetchStaffStudentIntegrity: vi.fn(),
  fetchStaffStudentReport: vi.fn(),
  fetchStudentReadiness: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ ...api, ApiRequestError: class ApiRequestError extends Error {} }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("@/components/report-view", () => ({ ReportView: () => <p>The report</p> }));
vi.mock("./campus-context", () => ({
  useCampusOrg: () => ({ orgId: "org1", orgName: "Alpha College", logoUrl: null, role: "tpo", accessToken: "token" }),
  campusHref: (path: string, orgId: string) => `${path}?org=${orgId}`,
}));

beforeEach(() => vi.clearAllMocks());

describe("the staff report page", () => {
  it("shows an assigned round's integrity signals beneath the report, from the staff route", async () => {
    api.fetchStaffStudentIntegrity.mockResolvedValue({
      recorded: true,
      tabHidden: 2,
      windowBlur: 0,
      pastes: 0,
      pastedChars: 0,
      fastAnswers: 0,
      longPauses: 0,
      notes: ["Switched away from the interview tab twice."],
    });
    render(<StaffStudentReport memberId="m1" sessionId="s1" />);

    expect(await screen.findByRole("heading", { name: "Integrity signals" })).toBeInTheDocument();
    expect(screen.getByText("Switched away from the interview tab twice.")).toBeInTheDocument();
    expect(screen.getByText("These are counts, not conclusions. They never change a score.")).toBeInTheDocument();
    expect(api.fetchStaffStudentIntegrity).toHaveBeenCalledWith("org1", "m1", "s1", expect.objectContaining({ accessToken: "token" }));
  });

  it("shows no section when nothing was recorded", async () => {
    api.fetchStaffStudentIntegrity.mockResolvedValue({
      recorded: false,
      tabHidden: 0,
      windowBlur: 0,
      pastes: 0,
      pastedChars: 0,
      fastAnswers: 0,
      longPauses: 0,
      notes: [],
    });
    render(<StaffStudentReport memberId="m1" sessionId="s1" />);
    await waitFor(() => expect(api.fetchStaffStudentIntegrity).toHaveBeenCalled());
    expect(screen.getByText("The report")).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Integrity signals" })).not.toBeInTheDocument();
  });
});
