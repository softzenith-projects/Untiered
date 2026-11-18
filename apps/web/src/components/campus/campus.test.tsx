import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminOrgSummary, BatchView, DepartmentView, MemberView, MeCampusView } from "@untiered/shared";

import { AdminColleges, slugify } from "./admin-colleges";
import { CampusGate } from "./campus-context";
import { StaffPanel } from "./staff-panel";
import { StructurePanel } from "./structure-panel";

const api = vi.hoisted(() => ({
  fetchAdminOrgs: vi.fn(),
  createAdminOrg: vi.fn(),
  fetchMeCampus: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchBatches: vi.fn(),
  createDepartment: vi.fn(),
  deleteDepartment: vi.fn(),
  updateDepartment: vi.fn(),
  createBatch: vi.fn(),
  deleteBatch: vi.fn(),
  updateBatch: vi.fn(),
  fetchMembers: vi.fn(),
  changeMemberRole: vi.fn(),
  removeMember: vi.fn(),
  fetchFacultyScopes: vi.fn(),
  saveFacultyScopes: vi.fn(),
  fetchInvites: vi.fn(),
  createInvite: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
}));
const nav = vi.hoisted(() => ({ search: "", push: vi.fn() }));

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
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => "/campus",
  useRouter: () => ({ push: nav.push }),
}));

const { ApiRequestError } = await import("@/lib/api");

const org = (overrides: Partial<AdminOrgSummary> = {}): AdminOrgSummary => ({
  id: "o1",
  name: "Alpha College",
  slug: "alpha-college",
  city: "Pune",
  state: "MH",
  logoUrl: null,
  contactName: null,
  contactEmail: null,
  contactPhone: null,
  status: "active",
  interviewAllowance: 50,
  interviewsUsed: 0,
  createdAt: "2026-11-01T00:00:00Z",
  staffCount: 2,
  studentCount: 10,
  ...overrides,
});

const dept = (id: string, code: string): DepartmentView => ({ id, code, name: `${code} dept`, batchCount: 1 });
const batch = (id: string): BatchView => ({
  id,
  departmentId: "d1",
  departmentCode: "CSE",
  graduationYear: 2027,
  name: "CSE 2027",
  studentCount: 3,
});

function me(staff: MeCampusView["staff"]): MeCampusView {
  return { student: null, staff };
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  api.fetchInvites.mockResolvedValue({ items: [], nextCursor: null });
});

describe("slugify", () => {
  it("suggests a url-safe slug", () => {
    expect(slugify("St. Xavier's College")).toBe("st-xaviers-college");
  });
});

describe("AdminColleges", () => {
  it("lists colleges and creates one with a slug suggested from the name", async () => {
    api.fetchAdminOrgs.mockResolvedValue([org()]);
    api.createAdminOrg.mockResolvedValue(org({ id: "o2", name: "Beta Institute", slug: "beta-institute" }));
    render(<AdminColleges />);

    expect(await screen.findByRole("link", { name: "Alpha College" })).toHaveAttribute("href", "/admin/campus/o1");
    expect(screen.getByRole("columnheader", { name: "Students" })).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText("College name"), "Beta Institute");
    expect(screen.getByLabelText("Slug")).toHaveValue("beta-institute");
    await userEvent.type(screen.getByLabelText("City"), "Delhi");
    await userEvent.click(screen.getByRole("button", { name: "Create college" }));

    await waitFor(() =>
      expect(api.createAdminOrg).toHaveBeenCalledWith(
        "token",
        expect.objectContaining({ name: "Beta Institute", slug: "beta-institute", city: "Delhi", interviewAllowance: 0 }),
      ),
    );
    expect(await screen.findByRole("link", { name: "Beta Institute" })).toBeInTheDocument();
  });

  it("shows not found when the API 404s a non-admin", async () => {
    api.fetchAdminOrgs.mockRejectedValue(new ApiRequestError(404, "not_found", "Not found"));
    render(<AdminColleges />);
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Create college" })).not.toBeInTheDocument();
  });
});

describe("CampusGate", () => {
  it("tells a non-staff user they are not staff anywhere", async () => {
    api.fetchMeCampus.mockResolvedValue(me([]));
    render(
      <CampusGate title="Overview">
        <p>secret</p>
      </CampusGate>,
    );
    expect(await screen.findByText("You are not staff at any college on Untiered")).toBeInTheDocument();
    expect(screen.queryByText("secret")).not.toBeInTheDocument();
  });

  it("asks which college when the person is staff at several", async () => {
    api.fetchMeCampus.mockResolvedValue(
      me([
        { orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "tpo" },
        { orgId: "o2", orgName: "Beta Institute", logoUrl: null, role: "faculty" },
      ]),
    );
    render(
      <CampusGate title="Overview">
        <p>content</p>
      </CampusGate>,
    );
    await userEvent.click(await screen.findByRole("button", { name: /Beta Institute/ }));
    expect(nav.push).toHaveBeenCalledWith("/campus?org=o2");
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });

  it("uses the only college, and hides links the role cannot use", async () => {
    api.fetchMeCampus.mockResolvedValue(me([{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "faculty" }]));
    render(
      <CampusGate title="Overview">
        <p>content</p>
      </CampusGate>,
    );
    expect(await screen.findByText("content")).toBeInTheDocument();
    const nav_ = screen.getByRole("navigation", { name: "College portal" });
    expect(within(nav_).getByRole("link", { name: "Overview" })).toBeInTheDocument();
    expect(within(nav_).queryByRole("link", { name: "Staff" })).not.toBeInTheDocument();
    expect(within(nav_).queryByRole("link", { name: "Departments and batches" })).not.toBeInTheDocument();
    // Settings is open to faculty since contract Module 14, for the interview package only.
    expect(within(nav_).getByRole("link", { name: "Settings" })).toBeInTheDocument();
  });

  it("does not render a page the role cannot use", async () => {
    api.fetchMeCampus.mockResolvedValue(me([{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "faculty" }]));
    render(
      <CampusGate title="Staff" allowedRoles={["college_admin"]}>
        <p>content</p>
      </CampusGate>,
    );
    expect(await screen.findByText(/not available for your role/)).toBeInTheDocument();
    expect(screen.queryByText("content")).not.toBeInTheDocument();
  });
});

function renderInGate(ui: React.ReactNode, role: "college_admin" | "tpo" = "college_admin") {
  api.fetchMeCampus.mockResolvedValue(me([{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role }]));
  return render(<CampusGate title="Page">{ui}</CampusGate>);
}

describe("StructurePanel", () => {
  beforeEach(() => {
    api.fetchDepartments.mockResolvedValue([dept("d1", "CSE")]);
    api.fetchBatches.mockResolvedValue([batch("b1")]);
  });

  it("creates a department", async () => {
    api.createDepartment.mockResolvedValue(dept("d2", "ECE"));
    renderInGate(<StructurePanel />);
    await screen.findByRole("heading", { name: "Departments" });

    await userEvent.type(screen.getByLabelText("Department code"), "ece");
    await userEvent.type(screen.getByLabelText("Department name"), "Electronics");
    await userEvent.click(screen.getByRole("button", { name: "Add department" }));

    await waitFor(() =>
      expect(api.createDepartment).toHaveBeenCalledWith("token", "o1", { code: "ECE", name: "Electronics" }),
    );
  });

  it("deletes after confirmation and shows the API's 409 message", async () => {
    api.deleteDepartment.mockRejectedValue(
      new ApiRequestError(409, "department_has_batches", "This department still has batches. Delete them first."),
    );
    renderInGate(<StructurePanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete CSE" }));

    expect(api.deleteDepartment).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(api.deleteDepartment).toHaveBeenCalledWith("token", "o1", "d1"));
    expect(await screen.findByText("This department still has batches. Delete them first.")).toBeInTheDocument();
  });

  it("can cancel a delete", async () => {
    renderInGate(<StructurePanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Delete CSE 2027" }));
    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(api.deleteBatch).not.toHaveBeenCalled();
    expect(screen.queryByRole("button", { name: "Yes, delete" })).not.toBeInTheDocument();
  });
});

describe("StaffPanel", () => {
  const member = (overrides: Partial<MemberView>): MemberView => ({
    id: "m1",
    name: "Asha Rao",
    email: "asha@alpha.edu",
    role: "faculty",
    batchId: null,
    batchName: null,
    departmentCode: null,
    rollNumber: null,
    joinedAt: "2026-11-01T00:00:00Z",
    active: true,
    ...overrides,
  });

  beforeEach(() => {
    api.fetchMembers.mockImplementation(async (_org: string, _opts: unknown, filter: { role: string }) => ({
      items: filter.role === "faculty" ? [member({})] : [],
      nextCursor: null,
    }));
    api.fetchDepartments.mockResolvedValue([dept("d1", "CSE"), dept("d2", "ECE")]);
    api.fetchBatches.mockResolvedValue([batch("b1")]);
  });

  it("changes a role", async () => {
    api.changeMemberRole.mockResolvedValue(member({ role: "tpo" }));
    renderInGate(<StaffPanel />);
    await userEvent.selectOptions(await screen.findByLabelText("Role for Asha Rao"), "tpo");
    await waitFor(() => expect(api.changeMemberRole).toHaveBeenCalledWith("token", "o1", "m1", "tpo"));
  });

  it("shows the last-admin refusal from the API", async () => {
    api.changeMemberRole.mockRejectedValue(new ApiRequestError(409, "last_admin", "A college needs at least one admin."));
    renderInGate(<StaffPanel />);
    await userEvent.selectOptions(await screen.findByLabelText("Role for Asha Rao"), "tpo");
    expect(await screen.findByText("A college needs at least one admin.")).toBeInTheDocument();
  });

  it("edits and saves a faculty member's scope", async () => {
    api.fetchFacultyScopes.mockResolvedValue({ departmentIds: ["d1"], batchIds: [] });
    api.saveFacultyScopes.mockResolvedValue({ departmentIds: ["d1", "d2"], batchIds: ["b1"] });
    renderInGate(<StaffPanel />);
    await userEvent.click(await screen.findByRole("button", { name: "Edit scope for Asha Rao" }));

    const cse = await screen.findByRole("checkbox", { name: "CSE - CSE dept" });
    expect(cse).toBeChecked();
    await userEvent.click(screen.getByRole("checkbox", { name: "ECE - ECE dept" }));
    await userEvent.click(screen.getByRole("checkbox", { name: "CSE 2027" }));
    await userEvent.click(screen.getByRole("button", { name: "Save scope" }));

    await waitFor(() =>
      expect(api.saveFacultyScopes).toHaveBeenCalledWith("token", "o1", "m1", { departmentIds: ["d1", "d2"], batchIds: ["b1"] }),
    );
    expect(await screen.findByText("Scope saved.")).toBeInTheDocument();
  });
});
