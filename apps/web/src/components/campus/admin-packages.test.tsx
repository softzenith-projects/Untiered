import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import type { AdminPackageView, CollegeBillingRow } from "@untiered/shared";

import { AdminBilling, AdminPackagesSection } from "./admin-packages";
import { formatInr, rupeesToPaise } from "./package-format";

const api = vi.hoisted(() => ({
  fetchAdminPackages: vi.fn(),
  createAdminPackage: vi.fn(),
  updateAdminPackage: vi.fn(),
  invoiceAdminPackage: vi.fn(),
  payAdminPackage: vi.fn(),
  voidAdminPackage: vi.fn(),
  deleteAdminPackage: vi.fn(),
  fetchCampusBilling: vi.fn(),
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

beforeAll(() => {
  // jsdom has no modal dialogs; the component only needs open and close to toggle.
  HTMLDialogElement.prototype.showModal ??= function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  HTMLDialogElement.prototype.close ??= function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

const pkg = (overrides: Partial<AdminPackageView> = {}): AdminPackageView => ({
  id: "p1",
  orgId: "o1",
  interviews: 100,
  interviewsUsed: 30,
  interviewsRemaining: 70,
  perStudentLimit: 4,
  startsOn: "2026-08-01",
  endsOn: "2027-05-31",
  graceDays: 14,
  lastUsableOn: "2027-06-14",
  amountPaise: 9_900_000,
  invoiceNumber: "UT-2026-014",
  status: "invoiced",
  invoicedOn: "2026-08-02",
  paidOn: null,
  paymentReference: null,
  notes: null,
  inWindow: true,
  remindersSent: [],
  createdAt: "2026-07-20T10:00:00Z",
  updatedAt: "2026-07-20T10:00:00Z",
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("package formatting", () => {
  it("shows rupees in the Indian style and reads typed amounts as paise", () => {
    expect(formatInr(9_900_000)).toBe("₹99,000");
    expect(formatInr(12_345_678)).toBe("₹1,23,456.78");
    expect(rupeesToPaise("99,000")).toBe(9_900_000);
    expect(rupeesToPaise("99000.5")).toBe(9_900_050);
    expect(rupeesToPaise("ninety")).toBeNull();
  });
});

describe("Packages and payments on the college page", () => {
  it("lists each package with its term, use, limit, amount and status", async () => {
    api.fetchAdminPackages.mockResolvedValue([pkg()]);
    render(<AdminPackagesSection orgId="o1" />);

    const section = screen.getByRole("region", { name: "Packages and payments" });
    const table = await within(section).findByRole("table", { name: "Packages, newest term first" });
    const row = within(table).getByRole("row", { name: /1 Aug 2026 to 31 May 2027/ });
    expect(within(row).getByText("30 of 100 used")).toBeInTheDocument();
    expect(within(row).getByText("70 remaining")).toBeInTheDocument();
    expect(within(row).getByText("4 per student")).toBeInTheDocument();
    expect(within(row).getByText("₹99,000")).toBeInTheDocument();
    expect(within(row).getByText("Invoiced, unpaid")).toBeInTheDocument();
    // An invoiced package that funded interviews can be paid, never voided or deleted.
    expect(within(row).getByRole("button", { name: "Mark paid: 1 Aug 2026 to 31 May 2027 package" })).toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /^Void/ })).not.toBeInTheDocument();
    expect(within(row).queryByRole("button", { name: /^Delete/ })).not.toBeInTheDocument();
    expect(api.fetchAdminPackages).toHaveBeenCalledWith("o1", expect.objectContaining({ accessToken: "token" }));
  });

  it("records a package from the form, sending the amount in paise and a blank limit as none", async () => {
    const user = userEvent.setup();
    api.fetchAdminPackages.mockResolvedValue([]);
    api.createAdminPackage.mockResolvedValue(pkg({ id: "p2", status: "draft", interviewsUsed: 0, interviewsRemaining: 100 }));
    render(<AdminPackagesSection orgId="o1" />);

    expect(await screen.findByText("No packages yet")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Record a package" }));
    const dialog = screen.getByRole("dialog", { name: "Record a package" });
    await user.type(within(dialog).getByLabelText("Interviews in the pool"), "100");
    await user.type(within(dialog).getByLabelText("Term starts"), "2026-08-01");
    await user.type(within(dialog).getByLabelText("Term ends"), "2027-05-31");
    await user.type(within(dialog).getByLabelText("Amount (₹, tax inclusive)"), "99,000");
    await user.type(within(dialog).getByLabelText("Invoice number"), "UT-2026-014");
    expect(within(dialog).getByLabelText("Interviews per student")).toHaveAccessibleDescription("Leave blank for no limit.");
    await user.click(within(dialog).getByRole("button", { name: "Record package" }));

    await waitFor(() =>
      expect(api.createAdminPackage).toHaveBeenCalledWith("token", "o1", {
        interviews: 100,
        perStudentLimit: 0,
        startsOn: "2026-08-01",
        endsOn: "2027-05-31",
        graceDays: 14,
        amountPaise: 9_900_000,
        invoiceNumber: "UT-2026-014",
        notes: "",
      }),
    );
    expect(await screen.findByText("Draft")).toBeInTheDocument();
  });

  it("refuses an amount that is not a number before calling the API", async () => {
    const user = userEvent.setup();
    api.fetchAdminPackages.mockResolvedValue([]);
    render(<AdminPackagesSection orgId="o1" />);

    await user.click(await screen.findByRole("button", { name: "Record a package" }));
    const dialog = screen.getByRole("dialog", { name: "Record a package" });
    await user.type(within(dialog).getByLabelText("Interviews in the pool"), "100");
    await user.type(within(dialog).getByLabelText("Term starts"), "2026-08-01");
    await user.type(within(dialog).getByLabelText("Term ends"), "2027-05-31");
    await user.type(within(dialog).getByLabelText("Amount (₹, tax inclusive)"), "ninety thousand");
    await user.click(within(dialog).getByRole("button", { name: "Record package" }));

    expect(within(dialog).getByText(/Enter the amount in rupees/)).toBeInTheDocument();
    expect(api.createAdminPackage).not.toHaveBeenCalled();
  });

  it("marks an invoiced package paid with its reference, and shows the server's refusal when there is one", async () => {
    const user = userEvent.setup();
    api.fetchAdminPackages.mockResolvedValue([pkg()]);
    api.payAdminPackage
      .mockRejectedValueOnce(new ApiRequestError(409, "package_status_conflict", "Only a draft or invoiced package can be marked paid."))
      .mockResolvedValueOnce(pkg({ status: "paid", paidOn: "2026-11-10", paymentReference: "NEFT 4471" }));
    render(<AdminPackagesSection orgId="o1" />);

    await user.click(await screen.findByRole("button", { name: "Mark paid: 1 Aug 2026 to 31 May 2027 package" }));
    const dialog = screen.getByRole("dialog", { name: "Mark paid" });
    await user.type(within(dialog).getByLabelText("Paid on"), "2026-11-10");
    await user.type(within(dialog).getByLabelText("Payment reference"), "NEFT 4471");
    await user.click(within(dialog).getByRole("button", { name: "Mark paid" }));
    expect(await within(dialog).findByText("Only a draft or invoiced package can be marked paid.")).toBeInTheDocument();

    await user.click(within(dialog).getByRole("button", { name: "Mark paid" }));
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(api.payAdminPackage).toHaveBeenLastCalledWith("token", "o1", "p1", { paidOn: "2026-11-10", paymentReference: "NEFT 4471" });
    expect(screen.getByText("Paid")).toBeInTheDocument();
    expect(screen.getByText("Ref. NEFT 4471")).toBeInTheDocument();
  });

  it("offers delete only for a draft and void only for an unused issued package", async () => {
    const user = userEvent.setup();
    api.fetchAdminPackages.mockResolvedValue([
      pkg({ id: "d1", status: "draft", interviewsUsed: 0, startsOn: "2027-06-01", endsOn: "2027-11-30" }),
      pkg({ id: "i1", status: "invoiced", interviewsUsed: 0 }),
    ]);
    api.deleteAdminPackage.mockResolvedValue(undefined);
    render(<AdminPackagesSection orgId="o1" />);

    expect(await screen.findByRole("button", { name: "Void: 1 Aug 2026 to 31 May 2027 package" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete: 1 Jun 2027 to 30 Nov 2027 package" }));
    await user.click(within(screen.getByRole("dialog", { name: "Delete this draft?" })).getByRole("button", { name: "Yes, delete it" }));

    await waitFor(() => expect(api.deleteAdminPackage).toHaveBeenCalledWith("token", "o1", "d1"));
    await waitFor(() => expect(screen.queryByText("1 Jun 2027 to 30 Nov 2027")).not.toBeInTheDocument());
  });
});

describe("The billing page", () => {
  const row = (overrides: Partial<CollegeBillingRow> = {}): CollegeBillingRow => ({
    orgId: "o1",
    orgName: "Demo College",
    orgStatus: "active",
    fundedByPackages: true,
    current: {
      id: "p1",
      status: "paid",
      interviews: 100,
      interviewsUsed: 30,
      interviewsRemaining: 70,
      perStudentLimit: 4,
      startsOn: "2026-08-01",
      endsOn: "2027-05-31",
      lastUsableOn: "2027-06-14",
      daysLeft: 45,
    },
    outstandingInvoices: 1,
    outstandingPaise: 5_000_000,
    totalPaidPaise: 9_900_000,
    aiCostUsd: 4.5,
    nextReminderOn: "2027-05-01",
    ...overrides,
  });

  it("shows every college's package, money, cost and next reminder in one table", async () => {
    api.fetchCampusBilling.mockResolvedValue([
      row(),
      row({
        orgId: "o2",
        orgName: "Allowance College",
        fundedByPackages: false,
        current: null,
        outstandingInvoices: 0,
        outstandingPaise: 0,
        totalPaidPaise: 0,
        aiCostUsd: null,
        nextReminderOn: null,
      }),
    ]);
    render(<AdminBilling />);

    const table = await screen.findByRole("table", { name: "Packages, payments and estimated AI cost per college" });
    const demo = within(table).getByRole("row", { name: /Demo College/ });
    expect(within(demo).getByRole("link", { name: "Demo College" })).toHaveAttribute("href", "/admin/campus/o1");
    for (const text of ["45 days left", "30 used, 70 remaining", "4 per student", "Paid", "₹50,000", "1 invoice", "₹99,000", "$4.50", "1 May 2027"]) {
      expect(within(demo).getByText(text)).toBeInTheDocument();
    }
    const other = within(table).getByRole("row", { name: /Allowance College/ });
    expect(within(other).getByText("No packages: interview allowance applies")).toBeInTheDocument();
    expect(within(other).getByText("None due")).toBeInTheDocument();
    expect(within(table).getAllByRole("columnheader").map((header) => header.textContent)).toContain("Next reminder");
  });

  it("tells someone off the allow-list there is nothing here", async () => {
    api.fetchCampusBilling.mockRejectedValue(new ApiRequestError(404, "not_found", "That resource does not exist."));
    render(<AdminBilling />);
    expect(await screen.findByText("Page not found")).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });
});
