import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ImportPreview, InvitePreview, InviteView, MeCampusView } from "@untiered/shared";

import { CampusGate } from "./campus-context";
import { ImportPanel, PROBLEM_LABEL } from "./import-panel";
import { JoinCollege } from "./join-college";
import { LeaveCollegeSection } from "./leave-college-section";
import { StudentsPanel } from "./students-panel";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchDepartments: vi.fn(),
  fetchBatches: vi.fn(),
  fetchMembers: vi.fn(),
  fetchInvites: vi.fn(),
  createInvite: vi.fn(),
  resendInvite: vi.fn(),
  revokeInvite: vi.fn(),
  removeMember: vi.fn(),
  updateMember: vi.fn(),
  uploadImport: vi.fn(),
  commitImport: vi.fn(),
  discardImport: vi.fn(),
  fetchInvitePreview: vi.fn(),
  acceptInvite: vi.fn(),
  leaveCollege: vi.fn(),
}));
const nav = vi.hoisted(() => ({ search: "", replace: vi.fn(), push: vi.fn() }));
const flags = vi.hoisted(() => ({ campus: true }));

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
vi.mock("@/lib/flags", () => ({ campusEnabled: () => flags.campus }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(nav.search),
  usePathname: () => "/campus/students",
  useRouter: () => ({ push: nav.push, replace: nav.replace }),
}));

const { ApiRequestError } = await import("@/lib/api");

const invite = (overrides: Partial<InviteView> = {}): InviteView => ({
  id: "i1",
  email: "asha@college.edu",
  fullName: "Asha Verma",
  role: "student",
  batchId: "b1",
  batchName: "CSE 2027",
  rollNumber: "21CS001",
  status: "invited",
  sendStatus: "sent",
  sendCount: 1,
  lastSentAt: "2026-11-13T00:00:00Z",
  createdAt: "2026-11-13T00:00:00Z",
  expiresAt: "2026-11-27T00:00:00Z",
  joinedAt: null,
  ...overrides,
});

function gate(role: "college_admin" | "tpo" | "faculty", ui: React.ReactNode) {
  api.fetchMeCampus.mockResolvedValue({
    student: null,
    staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role }],
  } satisfies MeCampusView);
  return render(<CampusGate title="Page">{ui}</CampusGate>);
}

beforeEach(() => {
  vi.clearAllMocks();
  nav.search = "";
  flags.campus = true;
  api.fetchDepartments.mockResolvedValue([{ id: "d1", code: "CSE", name: "Computer Science", batchCount: 1 }]);
  api.fetchBatches.mockResolvedValue([
    { id: "b1", departmentId: "d1", departmentCode: "CSE", graduationYear: 2027, name: "CSE 2027", studentCount: 1 },
  ]);
  api.fetchMembers.mockResolvedValue({ items: [], nextCursor: null });
  api.fetchInvites.mockResolvedValue({ items: [invite()], nextCursor: null });
});

describe("ImportPanel", () => {
  const preview: ImportPreview = {
    id: "imp1",
    status: "previewed",
    createdAt: "2026-11-13T00:00:00Z",
    expiresAt: "2026-11-14T00:00:00Z",
    summary: { total: 2, valid: 1, withProblems: 1 },
    rows: [
      { rowNumber: 1, fullName: "Asha Verma", email: "asha@college.edu", rollNumber: "21CS001", departmentCode: "CSE", batchName: "CSE 2027", graduationYear: 2027, problems: [] },
      { rowNumber: 2, fullName: null, email: "nope", rollNumber: null, departmentCode: "XYZ", batchName: null, graduationYear: null, problems: ["missing_name", "bad_email", "unknown_department"] },
    ],
  };

  async function uploadFile() {
    gate("tpo", <ImportPanel />);
    const input = await screen.findByLabelText(/Choose a CSV file/);
    await userEvent.upload(input, new File(["name,email\n"], "students.csv", { type: "text/csv" }));
  }

  it("shows each problem in plain English and says problem rows are skipped", async () => {
    api.uploadImport.mockResolvedValue(preview);
    await uploadFile();

    const table = await screen.findByRole("table", { name: "Rows in the uploaded file" });
    const problems = within(within(table).getByRole("list", { name: "Problems in row 2" }));
    expect(problems.getByText(PROBLEM_LABEL.missing_name)).toBeInTheDocument();
    expect(problems.getByText(PROBLEM_LABEL.bad_email)).toBeInTheDocument();
    expect(problems.getByText(PROBLEM_LABEL.unknown_department)).toBeInTheDocument();
    expect(within(table).getByText("Will be invited")).toBeInTheDocument();
    expect(screen.getByText(/Rows with problems are skipped/)).toBeInTheDocument();
  });

  it("has a plain-English label for every problem code", () => {
    for (const label of Object.values(PROBLEM_LABEL)) expect(label).not.toMatch(/_/);
    expect(Object.keys(PROBLEM_LABEL)).toHaveLength(11);
  });

  it("commits only the valid rows and reports the result", async () => {
    api.uploadImport.mockResolvedValue(preview);
    api.commitImport.mockResolvedValue({ invited: 1, skipped: 1 });
    await uploadFile();

    await userEvent.click(await screen.findByRole("button", { name: "Invite 1 student" }));

    await waitFor(() => expect(api.commitImport).toHaveBeenCalledWith("token", "o1", "imp1"));
    expect(await screen.findByText(/1 student was invited\. 1 row was skipped/)).toBeInTheDocument();
  });

  it("discards a preview without inviting anyone", async () => {
    api.uploadImport.mockResolvedValue(preview);
    api.discardImport.mockResolvedValue(undefined);
    await uploadFile();

    await userEvent.click(await screen.findByRole("button", { name: "Discard this file" }));

    await waitFor(() => expect(api.discardImport).toHaveBeenCalledWith("token", "o1", "imp1"));
    expect(api.commitImport).not.toHaveBeenCalled();
    expect(await screen.findByText("Upload a student list")).toBeInTheDocument();
  });

  it("explains a refused file", async () => {
    api.uploadImport.mockRejectedValue(new ApiRequestError(400, "csv_invalid", "Row 3 has too many columns."));
    await uploadFile();
    expect(await screen.findByText("Row 3 has too many columns.")).toBeInTheDocument();
  });

  it("offers a template built in the browser", async () => {
    gate("tpo", <ImportPanel />);
    const link = await screen.findByRole("link", { name: "Download a template" });
    expect(link.getAttribute("href")).toMatch(/^data:text\/csv/);
    expect(decodeURIComponent(link.getAttribute("href") ?? "")).toContain("name,email,roll_number,department,batch,graduation_year");
  });
});

describe("StudentsPanel", () => {
  async function openInvites() {
    await userEvent.click(await screen.findByRole("tab", { name: "Invites" }));
  }

  it("resends an invite", async () => {
    api.resendInvite.mockResolvedValue(invite({ sendCount: 2 }));
    gate("college_admin", <StudentsPanel />);
    await openInvites();

    await userEvent.click(await screen.findByRole("button", { name: "Resend invite to Asha Verma" }));

    await waitFor(() => expect(api.resendInvite).toHaveBeenCalledWith("token", "o1", "i1"));
    expect(await screen.findByText(/Sent 2 times/)).toBeInTheDocument();
  });

  it("explains the resend limit", async () => {
    api.resendInvite.mockRejectedValue(new ApiRequestError(429, "resend_limit", "x"));
    gate("college_admin", <StudentsPanel />);
    await openInvites();
    await userEvent.click(await screen.findByRole("button", { name: "Resend invite to Asha Verma" }));
    expect(await screen.findByText(/already been sent 10 times/)).toBeInTheDocument();
  });

  it("revokes only after confirmation", async () => {
    api.revokeInvite.mockResolvedValue(invite({ status: "revoked" }));
    gate("college_admin", <StudentsPanel />);
    await openInvites();

    await userEvent.click(await screen.findByRole("button", { name: "Revoke invite for Asha Verma" }));
    expect(api.revokeInvite).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, revoke" }));

    await waitFor(() => expect(api.revokeInvite).toHaveBeenCalledWith("token", "o1", "i1"));
    expect(await screen.findByText("Revoked the invite for Asha Verma.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Revoke invite for Asha Verma" })).not.toBeInTheDocument();
  });

  it("filters invites by status", async () => {
    gate("tpo", <StudentsPanel />);
    await openInvites();
    await userEvent.selectOptions(await screen.findByLabelText("Status"), "expired");
    await waitFor(() => expect(api.fetchInvites).toHaveBeenLastCalledWith("o1", expect.anything(), expect.objectContaining({ role: "student", status: "expired" })));
  });

  it("gives faculty a read-only list with no edit, remove, invite or import controls", async () => {
    api.fetchMembers.mockResolvedValue({
      items: [{ id: "m1", name: "Ravi", email: "ravi@college.edu", role: "student", batchId: "b1", batchName: "CSE 2027", departmentCode: "CSE", rollNumber: "21CS002", joinedAt: "2026-11-01T00:00:00Z", active: true }],
      nextCursor: null,
    });
    gate("faculty", <StudentsPanel />);

    expect(await screen.findByText("Ravi")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit|Remove/ })).not.toBeInTheDocument();
    expect(screen.queryByRole("tab", { name: "Invites" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /Import students/ })).not.toBeInTheDocument();
    expect(api.fetchInvites).not.toHaveBeenCalled();
  });

  it("removes a student after confirmation", async () => {
    api.fetchMembers.mockResolvedValue({
      items: [{ id: "m1", name: "Ravi", email: "ravi@college.edu", role: "student", batchId: "b1", batchName: "CSE 2027", departmentCode: "CSE", rollNumber: null, joinedAt: "2026-11-01T00:00:00Z", active: false }],
      nextCursor: null,
    });
    api.removeMember.mockResolvedValue(undefined);
    gate("college_admin", <StudentsPanel />);

    await userEvent.click(await screen.findByRole("button", { name: "Remove Ravi" }));
    await userEvent.click(screen.getByRole("button", { name: "Yes, remove" }));

    await waitFor(() => expect(api.removeMember).toHaveBeenCalledWith("token", "o1", "m1"));
    expect(await screen.findByText("Removed Ravi.")).toBeInTheDocument();
  });
});

describe("JoinCollege", () => {
  const studentPreview: InvitePreview = {
    orgName: "Alpha College",
    logoUrl: null,
    role: "student",
    batchName: "CSE 2027",
    invitedEmailMasked: "a***@college.edu",
    signedInEmail: "asha@college.edu",
    emailMatches: true,
    expiresAt: "2026-11-27T00:00:00Z",
    consentVersion: "campus-2026-11-14",
    shared: ["Your practice scores and reports."],
    notShared: ["Your audio recordings."],
    aiNotice: "An AI interviewer evaluates your answers.",
  };
  const joined: MeCampusView = { student: { orgId: "o1", orgName: "Alpha College", logoUrl: null, batchId: "b1", batchName: "CSE 2027", rollNumber: null }, staff: [] };

  beforeEach(() => {
    nav.search = "token=tok123";
  });

  it("shows the server's copy and keeps Join disabled until both boxes are ticked", async () => {
    api.fetchInvitePreview.mockResolvedValue(studentPreview);
    api.acceptInvite.mockResolvedValue(joined);
    render(<JoinCollege />);

    expect(await screen.findByText("Your practice scores and reports.")).toBeInTheDocument();
    expect(screen.getByText("Your audio recordings.")).toBeInTheDocument();
    expect(screen.getByText("An AI interviewer evaluates your answers.")).toBeInTheDocument();
    expect(api.fetchInvitePreview).toHaveBeenCalledWith("tok123", expect.objectContaining({ accessToken: "token" }));

    const join = screen.getByRole("button", { name: "Join Alpha College" });
    expect(join).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /can see the information/ }));
    expect(join).toBeDisabled();
    await userEvent.click(screen.getByRole("checkbox", { name: /AI interviewer evaluates/ }));
    expect(join).toBeEnabled();

    await userEvent.click(join);
    await waitFor(() =>
      expect(api.acceptInvite).toHaveBeenCalledWith("token", "tok123", {
        consentVersion: "campus-2026-11-14",
        agreeDataSharing: true,
        agreeAiEvaluation: true,
      }),
    );
    expect(nav.replace).toHaveBeenCalledWith("/dashboard");
  });

  it("never mentions or asks for recording consent", async () => {
    api.fetchInvitePreview.mockResolvedValue(studentPreview);
    render(<JoinCollege />);
    await screen.findByRole("button", { name: "Join Alpha College" });
    expect(screen.queryByRole("checkbox", { name: /record/i })).not.toBeInTheDocument();
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });

  it("needs an explicit confirmation when the email does not match", async () => {
    api.fetchInvitePreview.mockResolvedValue({ ...studentPreview, emailMatches: false, signedInEmail: "other@gmail.com" });
    api.acceptInvite.mockResolvedValue(joined);
    render(<JoinCollege />);

    await userEvent.click(await screen.findByRole("checkbox", { name: /can see the information/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /AI interviewer evaluates/ }));
    const join = screen.getByRole("button", { name: "Join Alpha College" });
    expect(join).toBeDisabled();
    expect(screen.getByRole("checkbox", { name: /joining as other@gmail\.com; this invite was sent to a\*\*\*@college\.edu/ })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /joining as other@gmail\.com/ }));
    await userEvent.click(join);
    await waitFor(() =>
      expect(api.acceptInvite).toHaveBeenCalledWith("token", "tok123", expect.objectContaining({ confirmDifferentEmail: true })),
    );
  });

  it("skips the consent boxes for a staff invite and lands in the portal", async () => {
    api.fetchInvitePreview.mockResolvedValue({ ...studentPreview, role: "tpo", batchName: null, shared: [], notShared: [] });
    api.acceptInvite.mockResolvedValue({ student: null, staff: [{ orgId: "o9", orgName: "Alpha College", logoUrl: null, role: "tpo" }] });
    render(<JoinCollege />);

    const join = await screen.findByRole("button", { name: "Join Alpha College" });
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(join).toBeEnabled();
    await userEvent.click(join);
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/campus?org=o9"));
  });

  it("lands in the college named by joinedOrgId, not the one matching by name", async () => {
    api.fetchInvitePreview.mockResolvedValue({ ...studentPreview, role: "tpo", batchName: null, shared: [], notShared: [] });
    api.acceptInvite.mockResolvedValue({
      student: null,
      staff: [
        { orgId: "o2", orgName: "Alpha College", logoUrl: null, role: "tpo" },
        { orgId: "o3", orgName: "Beta College", logoUrl: null, role: "tpo" },
      ],
      joinedOrgId: "o2",
    });
    render(<JoinCollege />);
    await userEvent.click(await screen.findByRole("button", { name: "Join Alpha College" }));
    await waitFor(() => expect(nav.replace).toHaveBeenCalledWith("/campus?org=o2"));
  });

  it.each([
    ["invite_not_found", 404, /no longer valid|not valid any more/],
    ["already_in_college", 409, /already a student at another college/],
  ])("explains %s", async (code, status, text) => {
    api.fetchInvitePreview.mockResolvedValue(studentPreview);
    api.acceptInvite.mockRejectedValue(new ApiRequestError(status, code, "server text"));
    render(<JoinCollege />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /can see the information/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /AI interviewer evaluates/ }));
    await userEvent.click(screen.getByRole("button", { name: "Join Alpha College" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(text);
    expect(nav.replace).not.toHaveBeenCalled();
  });

  it("reloads the terms and clears the ticks when the consent version is stale", async () => {
    api.fetchInvitePreview.mockResolvedValue(studentPreview);
    api.acceptInvite.mockRejectedValue(new ApiRequestError(409, "consent_version_stale", "stale"));
    render(<JoinCollege />);
    await userEvent.click(await screen.findByRole("checkbox", { name: /can see the information/ }));
    await userEvent.click(screen.getByRole("checkbox", { name: /AI interviewer evaluates/ }));
    await userEvent.click(screen.getByRole("button", { name: "Join Alpha College" }));
    expect(await screen.findByText(/terms were updated/)).toBeInTheDocument();
    await waitFor(() => expect(api.fetchInvitePreview).toHaveBeenCalledTimes(2));
    expect(screen.getByRole("checkbox", { name: /can see the information/ })).not.toBeChecked();
  });

  it("shows an expired or unknown link as an error with no join button", async () => {
    api.fetchInvitePreview.mockRejectedValue(new ApiRequestError(404, "invite_not_found", "nope"));
    render(<JoinCollege />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/not valid any more/);
    expect(screen.queryByRole("button", { name: /Join/ })).not.toBeInTheDocument();
  });

  it("asks for the link when there is no token", async () => {
    nav.search = "";
    render(<JoinCollege />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/link from your invite email/);
    expect(api.fetchInvitePreview).not.toHaveBeenCalled();
  });
});

describe("LeaveCollegeSection", () => {
  const student = { orgId: "o1", orgName: "Alpha College", logoUrl: null, batchId: "b1", batchName: "CSE 2027", rollNumber: null };

  it("renders nothing for a person who is not a campus student", async () => {
    api.fetchMeCampus.mockResolvedValue({ student: null, staff: [] });
    const { container } = render(<LeaveCollegeSection />);
    await waitFor(() => expect(api.fetchMeCampus).toHaveBeenCalled());
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing, and makes no call, while the campus flag is off", () => {
    flags.campus = false;
    const { container } = render(<LeaveCollegeSection />);
    expect(container).toBeEmptyDOMElement();
    expect(api.fetchMeCampus).not.toHaveBeenCalled();
  });

  it("lets a student leave after confirming", async () => {
    api.fetchMeCampus.mockResolvedValue({ student, staff: [] });
    api.leaveCollege.mockResolvedValue(undefined);
    render(<LeaveCollegeSection />);

    await userEvent.click(await screen.findByRole("button", { name: "Leave college" }));
    expect(api.leaveCollege).not.toHaveBeenCalled();
    await userEvent.click(screen.getByRole("button", { name: "Yes, leave" }));

    await waitFor(() => expect(api.leaveCollege).toHaveBeenCalledWith("token"));
    expect(await screen.findByText(/You left Alpha College/)).toBeInTheDocument();
  });
});
