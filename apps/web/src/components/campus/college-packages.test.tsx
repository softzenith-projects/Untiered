import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CollegePackagesView, StaffRole } from "@untiered/shared";

import { CampusGate } from "./campus-context";
import { SettingsPanel } from "./settings-panel";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchCampusOrg: vi.fn(),
  updateCampusOrg: vi.fn(),
  fetchAuditLog: vi.fn(),
  fetchReadinessWeights: vi.fn(),
  updateReadinessWeights: vi.fn(),
  fetchCollegePackages: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ ...api, ApiRequestError: class ApiRequestError extends Error {} }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/campus/settings",
  useRouter: () => ({ push: vi.fn() }),
}));

const current = { interviewsRemaining: 70, perStudentLimit: 4, endsOn: "2027-05-31" };

function signedInAs(role: StaffRole) {
  api.fetchMeCampus.mockResolvedValue({ student: null, staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role }] });
}

function renderSettings() {
  return render(
    <CampusGate title="Settings" allowedRoles={["college_admin", "tpo", "faculty"]}>
      <SettingsPanel />
    </CampusGate>,
  );
}

describe("The interview package on the Settings page", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    api.fetchReadinessWeights.mockResolvedValue({ coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 });
    api.fetchAuditLog.mockResolvedValue({ items: [], nextCursor: null });
    api.fetchCampusOrg.mockResolvedValue({
      id: "o1",
      name: "Alpha College",
      slug: "alpha",
      city: null,
      state: null,
      logoUrl: null,
      contactName: null,
      contactEmail: null,
      contactPhone: null,
      status: "active",
      interviewAllowance: 0,
      interviewsUsed: 0,
      createdAt: "2026-11-01T00:00:00Z",
    });
  });

  it.each(["tpo", "faculty"] as const)("shows a %s what is left, the limit and the end date, and nothing else", async (role) => {
    signedInAs(role);
    const view: CollegePackagesView = { fundedByPackages: true, current, packages: null };
    api.fetchCollegePackages.mockResolvedValue(view);
    renderSettings();

    const section = await screen.findByRole("region", { name: "Interview package" });
    expect(await within(section).findByText("70")).toBeInTheDocument();
    expect(within(section).getByText("Interviews remaining")).toBeInTheDocument();
    expect(within(section).getByText("4 per student")).toBeInTheDocument();
    expect(within(section).getByText("31 May 2027")).toBeInTheDocument();
    // No money, no invoices, and none of the college admin's settings.
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "College details" })).not.toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Audit log" })).not.toBeInTheDocument();
    expect(api.fetchCampusOrg).not.toHaveBeenCalled();
    expect(api.fetchAuditLog).not.toHaveBeenCalled();
  });

  it("shows a college admin every package with its invoice and amount", async () => {
    signedInAs("college_admin");
    api.fetchCollegePackages.mockResolvedValue({
      fundedByPackages: true,
      current,
      packages: [
        {
          id: "p1",
          interviews: 100,
          interviewsUsed: 30,
          interviewsRemaining: 70,
          perStudentLimit: 4,
          startsOn: "2026-08-01",
          endsOn: "2027-05-31",
          lastUsableOn: "2027-06-14",
          status: "paid",
          amountPaise: 9_900_000,
          invoiceNumber: "UT-2026-014",
          invoicedOn: "2026-08-02",
          paidOn: "2026-08-10",
        },
      ],
    } satisfies CollegePackagesView);
    renderSettings();

    const table = await screen.findByRole("table", { name: "Your college's packages and invoices" });
    const row = within(table).getByRole("row", { name: /1 Aug 2026 to 31 May 2027/ });
    for (const text of ["30 of 100 used", "70 remaining", "4 per student", "Paid", "UT-2026-014", "Paid 10 Aug 2026", "₹99,000"]) {
      expect(within(row).getByText(text)).toBeInTheDocument();
    }
    expect(screen.getByRole("heading", { name: "College details" })).toBeInTheDocument();
    expect(api.fetchCollegePackages).toHaveBeenCalledWith("o1", expect.objectContaining({ accessToken: "token" }));
  });

  it("says when no package is active, and when the allowance applies instead", async () => {
    signedInAs("tpo");
    api.fetchCollegePackages.mockResolvedValueOnce({ fundedByPackages: true, current: null, packages: null });
    const { unmount } = renderSettings();
    expect(await screen.findByText(/No package is active right now/)).toBeInTheDocument();
    unmount();

    api.fetchCollegePackages.mockResolvedValueOnce({ fundedByPackages: false, current: null, packages: null });
    renderSettings();
    expect(await screen.findByText(/interview allowance Untiered set up/)).toBeInTheDocument();
  });
});
