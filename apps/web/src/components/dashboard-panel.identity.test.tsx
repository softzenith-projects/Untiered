import type { SessionSummary } from "@untiered/shared";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardPanel, forgetDashboard, RoundHistoryPanel } from "./dashboard-panel";

const auth = vi.hoisted(() => ({ token: "account-a" as string | null | undefined }));
const api = vi.hoisted(() => ({
  SESSION_PAGE_SIZE: 20,
  fetchEntitlement: vi.fn(),
  fetchMe: vi.fn(),
  fetchProfile: vi.fn(),
  fetchSessions: vi.fn(),
  fetchReadiness: vi.fn(),
  deleteSession: vi.fn(),
}));

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => auth.token }));
vi.mock("@/lib/api", () => api);

const session = (id: string, companyName: string): SessionSummary => ({
  id,
  companyName,
  roleTitle: "Engineer",
  roundType: "technical_fundamentals",
  status: "completed",
  startedAt: "2026-09-01T10:00:00Z",
  endedAt: "2026-09-01T10:40:00Z",
  hasReport: true,
  reportExpired: false,
  reportExpiresAt: null,
  reportRetentionDays: 28,
});

describe("DashboardPanel account isolation", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forgetDashboard();
    auth.token = "account-a";
    api.fetchEntitlement.mockResolvedValue({ allowed: true, remainingFree: null });
    api.fetchMe.mockResolvedValue({
      id: "candidate-a",
      email: "candidate@example.com",
      displayName: "Candidate",
      preferredLanguage: "english",
      createdAt: "2026-09-01T00:00:00Z",
      profile: {},
    });
    api.fetchReadiness.mockResolvedValue([]);
  });

  it("hides the previous account's interviews as soon as the identity changes", async () => {
    api.fetchSessions.mockResolvedValueOnce([session("a", "Private A interview")]);
    const view = render(<DashboardPanel />);
    expect((await screen.findAllByText(/Private A interview/)).length).toBeGreaterThan(0);

    api.fetchSessions.mockRejectedValueOnce(new Error("account B request failed"));
    auth.token = "account-b";
    view.rerender(<DashboardPanel />);

    expect(screen.queryAllByText(/Private A interview/)).toHaveLength(0);
    await waitFor(() => expect(api.fetchSessions).toHaveBeenCalledWith({ accessToken: "account-b" }));
    expect(screen.queryAllByText(/Private A interview/)).toHaveLength(0);
  });

  it("ignores a slow response from the account that has signed out", async () => {
    let resolveA!: (sessions: SessionSummary[]) => void;
    api.fetchSessions.mockImplementationOnce(
      () => new Promise<SessionSummary[]>((resolve) => (resolveA = resolve)),
    );
    const view = render(<DashboardPanel />);

    auth.token = null;
    view.rerender(<DashboardPanel />);
    await act(async () => resolveA([session("a", "Late private interview")]));

    expect(screen.queryAllByText(/Late private interview/)).toHaveLength(0);
  });

  it("shows the primary action while readiness is still loading", async () => {
    api.fetchSessions.mockResolvedValue([]);
    api.fetchReadiness.mockReturnValue(new Promise(() => undefined));

    render(<DashboardPanel />);

    await waitFor(() => expect(api.fetchMe).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("link", { name: /start an interview/i })).toBeInTheDocument();
  });

  it("loads another bounded page on the history screen", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => session(`${index}`, `Company ${index}`));
    api.fetchSessions.mockResolvedValueOnce(firstPage).mockResolvedValueOnce([session("20", "Later company")]);

    render(<RoundHistoryPanel />);
    const more = await screen.findByRole("button", { name: "Load more rounds" });
    expect(screen.getAllByRole("listitem")).toHaveLength(20);

    fireEvent.click(more);
    expect(api.fetchSessions).toHaveBeenLastCalledWith(
      { accessToken: "account-a" },
      { limit: 20, offset: 20 },
    );
    expect(await screen.findByText(/Later company/)).toBeInTheDocument();
    expect(screen.getAllByRole("listitem")).toHaveLength(21);
    expect(screen.queryByRole("button", { name: "Load more rounds" })).not.toBeInTheDocument();
  });

  it("does not show a late history page after the account changes", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => session(`${index}`, `Private ${index}`));
    let resolvePage!: (sessions: SessionSummary[]) => void;
    api.fetchSessions.mockResolvedValueOnce(firstPage).mockImplementationOnce(
      () => new Promise<SessionSummary[]>((resolve) => (resolvePage = resolve)),
    ).mockResolvedValueOnce([]);

    const view = render(<RoundHistoryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more rounds" }));
    auth.token = "account-b";
    view.rerender(<RoundHistoryPanel />);
    await act(async () => resolvePage([session("late", "Late private company")]));

    expect(screen.queryByText(/Late private company/)).not.toBeInTheDocument();
    expect(screen.queryByText(/Private 0/)).not.toBeInTheDocument();
  });

  it("keeps the page available for retry after a load failure", async () => {
    const firstPage = Array.from({ length: 20 }, (_, index) => session(`${index}`, `Company ${index}`));
    api.fetchSessions.mockResolvedValueOnce(firstPage)
      .mockRejectedValueOnce(new Error("temporary outage"))
      .mockResolvedValueOnce([session("20", "Recovered company")]);

    render(<RoundHistoryPanel />);
    fireEvent.click(await screen.findByRole("button", { name: "Load more rounds" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(/please try again/i);
    fireEvent.click(screen.getByRole("button", { name: "Load more rounds" }));

    expect(await screen.findByText(/Recovered company/)).toBeInTheDocument();
    expect(api.fetchSessions).toHaveBeenLastCalledWith(
      { accessToken: "account-a" },
      { limit: 20, offset: 20 },
    );
  });
});

describe("DashboardPanel return visits", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    forgetDashboard();
    auth.token = "account-a";
    api.fetchEntitlement.mockResolvedValue({ allowed: true, remainingFree: null });
    api.fetchMe.mockResolvedValue(null);
    api.fetchReadiness.mockResolvedValue([]);
  });

  it("paints the last dashboard immediately when the page is opened again", async () => {
    api.fetchSessions.mockResolvedValueOnce([session("a", "Remembered interview")]);
    const first = render(<DashboardPanel />);
    expect((await screen.findAllByText(/Remembered interview/)).length).toBeGreaterThan(0);
    first.unmount();

    api.fetchSessions.mockReturnValueOnce(new Promise(() => {}));
    render(<DashboardPanel />);
    expect(screen.getAllByText(/Remembered interview/).length).toBeGreaterThan(0);
    expect(screen.queryByRole("status", { name: "Loading your dashboard" })).not.toBeInTheDocument();
  });

  it("never paints another account's remembered dashboard", async () => {
    api.fetchSessions.mockResolvedValueOnce([session("a", "Account A interview")]);
    const first = render(<DashboardPanel />);
    expect((await screen.findAllByText(/Account A interview/)).length).toBeGreaterThan(0);
    first.unmount();

    auth.token = "account-b";
    api.fetchSessions.mockReturnValueOnce(new Promise(() => {}));
    render(<DashboardPanel />);
    expect(screen.queryAllByText(/Account A interview/)).toHaveLength(0);
  });

  it("forgets the remembered dashboard on sign-out", async () => {
    api.fetchSessions.mockResolvedValueOnce([session("a", "Forgotten interview")]);
    const first = render(<DashboardPanel />);
    expect((await screen.findAllByText(/Forgotten interview/)).length).toBeGreaterThan(0);
    first.unmount();

    forgetDashboard();
    api.fetchSessions.mockReturnValueOnce(new Promise(() => {}));
    render(<DashboardPanel />);
    expect(screen.queryAllByText(/Forgotten interview/)).toHaveLength(0);
  });
});
