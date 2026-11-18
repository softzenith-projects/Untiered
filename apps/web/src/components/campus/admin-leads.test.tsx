import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { InviteView, LeadView, OrgView } from "@untiered/shared";

import { AdminLeads } from "./admin-leads";

const api = vi.hoisted(() => ({
  fetchAdminLeads: vi.fn(),
  fetchAdminLead: vi.fn(),
  updateAdminLead: vi.fn(),
  deleteAdminLead: vi.fn(),
  convertAdminLead: vi.fn(),
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

const { ApiRequestError } = await import("@/lib/api");

const lead = (overrides: Partial<LeadView> = {}): LeadView => ({
  id: "l1",
  status: "new",
  collegeName: "St. Xavier's College",
  city: "Pune",
  state: "Maharashtra",
  contactName: "Asha Rao",
  contactRole: "tpo",
  email: "asha@college.edu",
  phone: "+91 98765 43210",
  approxStudents: 1200,
  message: "Start with CSE 2027.",
  notes: null,
  orgId: null,
  createdAt: "2026-11-14T10:00:00Z",
  updatedAt: "2026-11-14T10:00:00Z",
  statusChangedBy: null,
  ...overrides,
});

const org: OrgView = {
  id: "o1",
  name: "St. Xavier's College",
  slug: "st-xaviers-college",
  city: "Pune",
  state: "Maharashtra",
  logoUrl: null,
  contactName: "Asha Rao",
  contactEmail: "asha@college.edu",
  contactPhone: "+91 98765 43210",
  status: "active",
  interviewAllowance: 0,
  interviewsUsed: 0,
  createdAt: "2026-11-14T11:00:00Z",
};

const invite = { id: "i1", email: "asha@college.edu", role: "college_admin" } as InviteView;

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchAdminLeads.mockResolvedValue({ items: [lead()], nextCursor: null });
});

describe("admin lead review", () => {
  it("lists leads and filters them by status and search", async () => {
    const user = userEvent.setup();
    render(<AdminLeads />);

    const table = await screen.findByRole("table", { name: "College leads, newest first" });
    expect(within(table).getByRole("button", { name: "St. Xavier's College" })).toBeInTheDocument();
    expect(within(table).getByText("New")).toBeInTheDocument();
    expect(api.fetchAdminLeads).toHaveBeenLastCalledWith({}, expect.objectContaining({ accessToken: "token" }));

    await user.selectOptions(screen.getByLabelText("Status"), "not_a_fit");
    await waitFor(() =>
      expect(api.fetchAdminLeads).toHaveBeenLastCalledWith({ status: "not_a_fit" }, expect.objectContaining({ accessToken: "token" })),
    );
    await user.type(screen.getByLabelText("Search"), "pune");
    await user.click(screen.getByRole("button", { name: "Search" }));
    await waitFor(() =>
      expect(api.fetchAdminLeads).toHaveBeenLastCalledWith(
        { status: "not_a_fit", q: "pune" },
        expect.objectContaining({ accessToken: "token" }),
      ),
    );
  });

  it("shows every field of a lead, and saves a status change with private notes", async () => {
    const user = userEvent.setup();
    api.updateAdminLead.mockResolvedValue(lead({ status: "contacted", notes: "Called Monday" }));
    render(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "St. Xavier's College" }));
    const detail = screen.getByRole("region", { name: "St. Xavier's College" });
    for (const value of ["asha@college.edu", "+91 98765 43210", "Placement officer (TPO)", "Start with CSE 2027.", "1,200"]) {
      expect(within(detail).getByText(value)).toBeInTheDocument();
    }

    await user.selectOptions(within(detail).getByLabelText("Status"), "contacted");
    await user.type(within(detail).getByLabelText("Private notes"), "Called Monday");
    await user.click(within(detail).getByRole("button", { name: "Save changes" }));

    await waitFor(() =>
      expect(api.updateAdminLead).toHaveBeenCalledWith("token", "l1", { status: "contacted", notes: "Called Monday" }),
    );
    expect(await within(detail).findByText("Saved.")).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Contacted")).toBeInTheDocument();
  });

  it("converts a lead with the create-college form prefilled, and shows the invite that was sent", async () => {
    const user = userEvent.setup();
    api.convertAdminLead.mockResolvedValue({ org, invite });
    render(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "St. Xavier's College" }));
    await user.click(screen.getByRole("button", { name: "Convert to college" }));
    const form = screen.getByRole("region", { name: "Create a college from this lead" });
    expect(within(form).getByLabelText("College name")).toHaveValue("St. Xavier's College");
    expect(within(form).getByLabelText("Slug")).toHaveValue("st-xaviers-college");
    expect(within(form).getByLabelText("City")).toHaveValue("Pune");
    expect(within(form).getByLabelText("State")).toHaveValue("Maharashtra");

    await user.clear(within(form).getByLabelText("Interview allowance"));
    await user.type(within(form).getByLabelText("Interview allowance"), "200");
    await user.click(within(form).getByRole("button", { name: "Create college and send invite" }));

    await waitFor(() =>
      expect(api.convertAdminLead).toHaveBeenCalledWith("token", "l1", {
        name: "St. Xavier's College",
        slug: "st-xaviers-college",
        city: "Pune",
        state: "Maharashtra",
        interviewAllowance: 200,
      }),
    );
    expect(await screen.findByText(/a college admin invite is queued for asha@college.edu/)).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open the college" })[0]).toHaveAttribute("href", "/admin/campus/o1");
    expect(screen.queryByRole("button", { name: "Convert to college" })).not.toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("Converted")).toBeInTheDocument();
  });

  it("shows the roughly-how-many-students figure in the list and acts on a lead from its row", async () => {
    const user = userEvent.setup();
    api.fetchAdminLeads.mockResolvedValue({ items: [lead(), lead({ id: "l2", collegeName: "Fergusson", approxStudents: null, status: "contacted" })], nextCursor: null });
    api.updateAdminLead.mockResolvedValue(lead({ status: "contacted" }));
    render(<AdminLeads />);

    const table = await screen.findByRole("table", { name: "College leads, newest first" });
    expect(within(table).getByRole("columnheader", { name: "Students" })).toBeInTheDocument();
    expect(within(table).getByText("1,200")).toBeInTheDocument();
    expect(within(table).getByText("Not given")).toBeInTheDocument();
    // Only a new lead can be marked contacted; any lead that is not converted can be converted.
    expect(within(table).getAllByRole("button", { name: /^Mark contacted/ })).toHaveLength(1);

    await user.click(within(table).getByRole("button", { name: /^Mark contacted/ }));
    await waitFor(() => expect(api.updateAdminLead).toHaveBeenCalledWith("token", "l1", { status: "contacted" }));
    await waitFor(() => expect(within(table).queryByRole("button", { name: /^Mark contacted/ })).not.toBeInTheDocument());
  });

  it("opens the create-college form from the row's Convert button, prefilled, and sends the same request", async () => {
    const user = userEvent.setup();
    api.convertAdminLead.mockResolvedValue({ org, invite });
    render(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "Convert St. Xavier's College" }));
    const form = screen.getByRole("region", { name: "Create a college from this lead" });
    expect(within(form).getByLabelText("College name")).toHaveValue("St. Xavier's College");
    // The allowance is an explicit choice, never a guess from the lead's size.
    expect(within(form).getByLabelText("Interview allowance")).toHaveValue(0);

    await user.click(within(form).getByRole("button", { name: "Create college and send invite" }));
    await waitFor(() => expect(api.convertAdminLead).toHaveBeenCalledTimes(1));
    expect(await screen.findByText(/a college admin invite is queued for asha@college.edu/)).toBeInTheDocument();
    expect(within(screen.getByRole("table")).getByText("College created")).toBeInTheDocument();
  });

  it("shows why a conversion was refused", async () => {
    const user = userEvent.setup();
    api.convertAdminLead.mockRejectedValue(new ApiRequestError(409, "slug_taken", "Another college already uses that slug."));
    render(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "St. Xavier's College" }));
    await user.click(screen.getByRole("button", { name: "Convert to college" }));
    await user.click(screen.getByRole("button", { name: "Create college and send invite" }));

    expect(await screen.findByText("Another college already uses that slug.")).toBeInTheDocument();
  });

  it("deletes a lead only after it is confirmed", async () => {
    const user = userEvent.setup();
    api.deleteAdminLead.mockResolvedValue(undefined);
    render(<AdminLeads />);

    await user.click(await screen.findByRole("button", { name: "St. Xavier's College" }));
    await user.click(screen.getByRole("button", { name: "Delete lead" }));
    expect(api.deleteAdminLead).not.toHaveBeenCalled();
    const confirm = screen.getByRole("alertdialog");
    await user.click(within(confirm).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Delete lead" }));
    await user.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(api.deleteAdminLead).toHaveBeenCalledWith("token", "l1"));
    expect(await screen.findByText("No leads")).toBeInTheDocument();
  });

  it("opens a lead from its link even when the list does not show it", async () => {
    api.fetchAdminLeads.mockResolvedValue({ items: [], nextCursor: null });
    api.fetchAdminLead.mockResolvedValue(lead({ id: "l9", collegeName: "Linked College" }));
    render(<AdminLeads initialLeadId="l9" />);

    expect(await screen.findByRole("region", { name: "Linked College" })).toBeInTheDocument();
    expect(api.fetchAdminLead).toHaveBeenCalledWith("l9", expect.objectContaining({ accessToken: "token" }));
  });

  it("shows nothing to someone off the allow-list", async () => {
    api.fetchAdminLeads.mockRejectedValue(new ApiRequestError(404, "not_found", "Not found"));
    render(<AdminLeads />);

    expect(await screen.findByText("Page not found")).toBeInTheDocument();
  });
});
