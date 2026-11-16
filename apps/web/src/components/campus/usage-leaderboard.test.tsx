import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { LeaderboardView, OrgUsageRow } from "@untiered/shared";

import { AdminUsage, currentMonthRange, USAGE_NOTE } from "./admin-usage";
import { MyLeaderboard } from "./my-leaderboard";

const api = vi.hoisted(() => ({
  fetchCampusUsage: vi.fn(),
  fetchMyLeaderboard: vi.fn(),
  setLeaderboardOptIn: vi.fn(),
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
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a>,
}));

beforeEach(() => vi.clearAllMocks());

const usageRows: OrgUsageRow[] = [
  {
    orgId: "o1",
    orgName: "College A",
    interviewAllowance: 100,
    interviewsUsed: 7,
    interviewsThisMonth: 4,
    aiCostUsd: 2.5,
    aiCostPerInterviewUsd: 0.625,
  },
  { orgId: "o2", orgName: "College B", interviewAllowance: 10, interviewsUsed: 0, interviewsThisMonth: 0, aiCostUsd: 0, aiCostPerInterviewUsd: null },
];

describe("campus usage", () => {
  it("defaults to the current month", () => {
    expect(currentMonthRange(new Date(2026, 10, 14))).toEqual({ from: "2026-11-01", to: "2026-11-30" });
  });

  it("shows cost in dollars, a clear cell when there are no interviews, and the estimate note", async () => {
    api.fetchCampusUsage.mockResolvedValue(usageRows);
    render(<AdminUsage />);

    const a = (await screen.findByText("College A")).closest("tr") as HTMLElement;
    expect(within(a).getByText("$2.50")).toBeInTheDocument();
    expect(within(a).getByText("$0.63")).toBeInTheDocument();
    const b = screen.getByText("College B").closest("tr") as HTMLElement;
    expect(within(b).getByText("No interviews")).toBeInTheDocument();
    expect(screen.getByText(USAGE_NOTE)).toBeInTheDocument();
    expect(USAGE_NOTE).toBe("Estimated from recorded model usage; excludes hosting and email costs.");
    expect(api.fetchCampusUsage.mock.calls[0]?.[0]).toEqual(currentMonthRange());
  });

  it("shows a not-found state to someone who is not the operator", async () => {
    const { ApiRequestError } = await import("@/lib/api");
    api.fetchCampusUsage.mockRejectedValue(new ApiRequestError(404, "not_found", "nope"));
    render(<AdminUsage />);
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });
});

const board = (overrides: Partial<LeaderboardView> = {}): LeaderboardView => ({
  scope: "batch",
  optedIn: false,
  myRank: 2,
  rows: [
    { rank: 1, displayName: "Anonymous student", overall: 90, isMe: false },
    { rank: 2, displayName: "Anonymous student", overall: 70, isMe: true },
  ],
  ...overrides,
});

describe("campus leaderboard", () => {
  it("renders anonymous names, the caller's rank and the opt-in sentence", async () => {
    api.fetchMyLeaderboard.mockResolvedValue(board());
    render(<MyLeaderboard />);

    expect(await screen.findByText("You are #2")).toBeInTheDocument();
    expect(screen.getAllByText("Anonymous student")).toHaveLength(2);
    expect(screen.getByText("Your name is hidden unless you turn this on.")).toBeInTheDocument();
    expect(screen.getByRole("switch")).not.toBeChecked();
    expect(api.fetchMyLeaderboard.mock.calls[0]?.[0]).toBe("batch");
  });

  it("asks for the college board when toggled", async () => {
    api.fetchMyLeaderboard.mockResolvedValue(board());
    render(<MyLeaderboard />);
    await screen.findByText("You are #2");
    await userEvent.click(screen.getByRole("button", { name: "My college" }));
    await waitFor(() => expect(api.fetchMyLeaderboard.mock.calls.at(-1)?.[0]).toBe("college"));
  });

  it("says so when the student is not ranked yet", async () => {
    api.fetchMyLeaderboard.mockResolvedValue(board({ myRank: null, rows: [] }));
    render(<MyLeaderboard />);
    expect(await screen.findByText(/You are not ranked yet/)).toBeInTheDocument();
  });

  it("turning the switch on calls the API and reflects the saved value", async () => {
    api.fetchMyLeaderboard.mockResolvedValue(board());
    api.setLeaderboardOptIn.mockResolvedValue({ optIn: true });
    render(<MyLeaderboard />);

    await userEvent.click(await screen.findByRole("switch"));
    expect(api.setLeaderboardOptIn).toHaveBeenCalledWith("token", true);
    await waitFor(() => expect(screen.getByRole("switch")).toBeChecked());
  });

  it("renders nothing for someone who is not a student", async () => {
    const { ApiRequestError } = await import("@/lib/api");
    api.fetchMyLeaderboard.mockRejectedValue(new ApiRequestError(404, "not_found", "nope"));
    const { container } = render(<MyLeaderboard />);
    await waitFor(() => expect(api.fetchMyLeaderboard).toHaveBeenCalled());
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });
});
