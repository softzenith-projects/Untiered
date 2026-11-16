import { render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardView } from "@/components/dashboard-panel";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchMyAssignments: vi.fn(() => Promise.resolve([])),
  fetchMyProgrammes: vi.fn(() => Promise.resolve([])),
  fetchEntitlement: vi.fn(() => Promise.resolve(null)),
}));

vi.mock("@/lib/api", () => ({
  ...api,
  ApiRequestError: class ApiRequestError extends Error {},
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

const dashboard = () => render(<DashboardView entitlement={null} sessions={[]} readiness={[]} loaded />);

beforeEach(() => {
  vi.clearAllMocks();
});
afterEach(() => vi.unstubAllEnvs());

describe("the college portal card on the student dashboard", () => {
  it("links a staff member to their college's portal", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMeCampus.mockResolvedValue({
      student: null,
      staff: [{ orgId: "org-1", orgName: "Alpha College", logoUrl: null, role: "tpo" }],
    });
    dashboard();
    expect(await screen.findByText("Alpha College")).toBeInTheDocument();
    expect(screen.getByText(/You.re staff at/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open the college portal for Alpha College" })).toHaveAttribute(
      "href",
      "/campus?org=org-1",
    );
  });

  it("shows nothing to a student or anyone without a staff membership", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMeCampus.mockResolvedValue({
      student: { orgId: "org-1", orgName: "Alpha College", logoUrl: null, batchId: "b1", batchName: "CSE 2027", rollNumber: null },
      staff: [],
    });
    dashboard();
    await waitFor(() => expect(api.fetchMeCampus).toHaveBeenCalled());
    expect(screen.queryByText(/You.re staff at/)).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /college portal/i })).not.toBeInTheDocument();
  });

  it("stays silent when the read fails", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    api.fetchMeCampus.mockRejectedValue(new Error("down"));
    dashboard();
    await waitFor(() => expect(api.fetchMeCampus).toHaveBeenCalled());
    expect(screen.queryByRole("link", { name: /college portal/i })).not.toBeInTheDocument();
  });

  it("makes no request when the campus switch is off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "false");
    dashboard();
    expect(api.fetchMeCampus).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /college portal/i })).not.toBeInTheDocument();
  });
});
