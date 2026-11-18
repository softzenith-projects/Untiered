import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AttentionRow, StaffComment } from "@untiered/shared";

import { AttentionPanel } from "./attention-panel";
import { CampusGate } from "./campus-context";
import { StaffNotesPanel } from "./staff-notes";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchAttention: vi.fn(),
  fetchStaffComments: vi.fn(),
  createStaffComment: vi.fn(),
  updateStaffComment: vi.fn(),
  deleteStaffComment: vi.fn(),
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
vi.mock("next/navigation", () => ({
  usePathname: () => "/campus/attention",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("org=o1"),
}));

function attention(overrides: Partial<AttentionRow> = {}): AttentionRow {
  return {
    memberId: "m1",
    name: "Asha",
    rollNumber: "A-001",
    batchName: "CSE 2027",
    reasons: ["low_score", "overdue"],
    overall: 41,
    band: "needs_structured_prep",
    overdue: 2,
    lastActiveAt: "2026-11-10T10:00:00Z",
    ...overrides,
  };
}

function note(overrides: Partial<StaffComment> = {}): StaffComment {
  return {
    id: "n1",
    memberId: "m1",
    sessionId: null,
    authorName: "Ms Rao",
    isMine: true,
    body: "Revisit normal forms.",
    createdAt: "2026-11-12T10:00:00Z",
    editedAt: null,
    ...overrides,
  };
}

function staffAs(role: "college_admin" | "tpo" | "faculty") {
  api.fetchMeCampus.mockResolvedValue({ student: null, staff: [{ orgId: "o1", orgName: "Test College", logoUrl: null, role }] });
}

beforeEach(() => {
  vi.clearAllMocks();
  staffAs("faculty");
});

describe("students needing attention", () => {
  it("lists reasons in words, links to the drill-down and filters by reason on the server", async () => {
    const user = userEvent.setup();
    api.fetchAttention.mockResolvedValueOnce([attention(), attention({ memberId: "m2", name: "Bilal", reasons: ["inactive"], overall: null, band: "not_enough_evidence", overdue: 0 })]);
    render(
      <CampusGate title="Students needing attention">
        <AttentionPanel />
      </CampusGate>,
    );

    const table = await screen.findByRole("table", { name: "Students needing attention" });
    const asha = within(table).getByRole("row", { name: /Asha/ });
    expect(within(asha).getByText("Low score")).toBeInTheDocument();
    expect(within(asha).getByText("Overdue work")).toBeInTheDocument();
    expect(within(asha).getByRole("link", { name: "Asha" })).toHaveAttribute("href", "/campus/readiness/m1?org=o1");
    expect(within(table).getByText("Inactive for 14 days")).toBeInTheDocument();
    expect(api.fetchAttention.mock.calls[0]?.[2]).toBeUndefined();

    api.fetchAttention.mockResolvedValueOnce([]);
    await user.selectOptions(screen.getByLabelText("Reason"), "inactive");
    await waitFor(() => expect(api.fetchAttention.mock.calls.at(-1)?.[2]).toBe("inactive"));
    expect(await screen.findByText('No students with "Inactive for 14 days"')).toBeInTheDocument();
    expect(screen.getByLabelText("Reason")).toHaveAccessibleDescription(/14 days/);
  });

  it("marks a student who has a staff note, and only that student", async () => {
    api.fetchAttention.mockResolvedValueOnce([
      attention({ hasStaffNote: true }),
      attention({ memberId: "m2", name: "Bilal", reasons: ["inactive"], hasStaffNote: false }),
    ]);
    render(
      <CampusGate title="Students needing attention">
        <AttentionPanel />
      </CampusGate>,
    );

    const table = await screen.findByRole("table", { name: "Students needing attention" });
    expect(within(within(table).getByRole("row", { name: /Asha/ })).getByText("Has a staff note")).toBeInTheDocument();
    expect(within(within(table).getByRole("row", { name: /Bilal/ })).queryByText("Has a staff note")).not.toBeInTheDocument();
  });

  it("is in the portal navigation for every staff role", async () => {
    api.fetchAttention.mockResolvedValue([]);
    render(
      <CampusGate title="Students needing attention">
        <AttentionPanel />
      </CampusGate>,
    );
    const nav = await screen.findByRole("navigation", { name: "College portal" });
    expect(within(nav).getByRole("link", { name: "Needs attention" })).toHaveAttribute("aria-current", "page");
  });
});

describe("private staff notes", () => {
  function renderNotes() {
    return render(
      <CampusGate title="Student readiness">
        <StaffNotesPanel memberId="m1" sessions={[{ id: "s1", label: "Technical round, 12 Nov 2026" }]} />
      </CampusGate>,
    );
  }

  it("says plainly who can see the notes", async () => {
    api.fetchStaffComments.mockResolvedValue([]);
    renderNotes();
    expect(await screen.findByRole("heading", { name: "Private staff notes" })).toBeInTheDocument();
    expect(screen.getByText("Only staff at Test College can see these notes. The student never sees them.")).toBeInTheDocument();
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
  });

  it("adds a note, optionally about a round, and refuses an empty one", async () => {
    const user = userEvent.setup();
    api.fetchStaffComments.mockResolvedValue([]);
    api.createStaffComment.mockResolvedValue(note({ id: "n2", body: "Good on indexes.", sessionId: "s1" }));
    renderNotes();

    await user.click(await screen.findByRole("button", { name: "Save note" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Write a note before saving it.");
    expect(api.createStaffComment).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Add a note")).toHaveAttribute("aria-invalid", "true");

    await user.type(screen.getByLabelText("Add a note"), "Good on indexes.");
    await user.selectOptions(screen.getByLabelText("About a round (optional)"), "s1");
    await user.click(screen.getByRole("button", { name: "Save note" }));

    await waitFor(() =>
      expect(api.createStaffComment).toHaveBeenCalledWith("token", "o1", "m1", { body: "Good on indexes.", sessionId: "s1" }),
    );
    const list = await screen.findByRole("list", { name: "Notes" });
    expect(within(list).getByText("Good on indexes.")).toBeInTheDocument();
    expect(within(list).getByText(/Technical round, 12 Nov 2026/)).toBeInTheDocument();
    expect(screen.getByLabelText("Add a note")).toHaveValue("");
  });

  it("lets the author edit their own note", async () => {
    const user = userEvent.setup();
    api.fetchStaffComments.mockResolvedValue([note()]);
    api.updateStaffComment.mockResolvedValue(note({ body: "Revisit 3NF and BCNF.", editedAt: "2026-11-13T10:00:00Z" }));
    renderNotes();

    await user.click(await screen.findByRole("button", { name: "Edit" }));
    const editor = screen.getByLabelText("Edit note");
    await user.clear(editor);
    await user.type(editor, "Revisit 3NF and BCNF.");
    await user.click(screen.getByRole("button", { name: "Save changes" }));

    await waitFor(() => expect(api.updateStaffComment).toHaveBeenCalledWith("token", "o1", "n1", "Revisit 3NF and BCNF."));
    expect(await screen.findByText("Revisit 3NF and BCNF.")).toBeInTheDocument();
    expect(screen.getByText(/edited/)).toBeInTheDocument();
  });

  it("offers no edit or delete on someone else's note to faculty", async () => {
    api.fetchStaffComments.mockResolvedValue([note({ isMine: false, authorName: "Mr Iyer" })]);
    renderNotes();
    expect(await screen.findByText(/Mr Iyer/)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Edit" })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Delete" })).not.toBeInTheDocument();
  });

  it("lets a college admin delete anyone's note after confirming", async () => {
    const user = userEvent.setup();
    staffAs("college_admin");
    api.fetchStaffComments.mockResolvedValue([note({ isMine: false, authorName: "Mr Iyer" })]);
    api.deleteStaffComment.mockResolvedValue(undefined);
    renderNotes();

    await user.click(await screen.findByRole("button", { name: "Delete" }));
    expect(screen.getByText("Delete this note for every staff member?")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Yes, delete" }));

    await waitFor(() => expect(api.deleteStaffComment).toHaveBeenCalledWith("token", "o1", "n1"));
    expect(await screen.findByText("No notes yet.")).toBeInTheDocument();
    expect(screen.queryByText("Revisit normal forms.")).not.toBeInTheDocument();
  });
});
