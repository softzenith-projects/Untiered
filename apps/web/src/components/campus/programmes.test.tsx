import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { CertificateView, MyProgrammeView, ProgrammeTemplate } from "@untiered/shared";

import { AdminProgrammes } from "./admin-programmes";
import { ProgrammesBlock } from "./assigned-to-you";
import { CampusGate } from "./campus-context";
import { ProgrammeCertificate } from "./certificate";
import { formatIst, todayInIndia, weeklySchedule } from "./programme-model";
import { ProgrammesPanel } from "./programmes-panel";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchProgrammes: vi.fn(),
  fetchProgrammeTemplates: vi.fn(),
  fetchBatches: vi.fn(),
  startProgramme: vi.fn(),
  fetchMyCertificate: vi.fn(),
  fetchAdminProgrammeTemplates: vi.fn(),
  createProgrammeTemplate: vi.fn(),
  updateProgrammeTemplate: vi.fn(),
  deleteProgrammeTemplate: vi.fn(),
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
  usePathname: () => "/campus/programmes",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("org=o1"),
}));

const { ApiRequestError } = await import("@/lib/api");

const template: ProgrammeTemplate = {
  id: "t1",
  title: "Placement Accelerator",
  description: "Six weeks of rounds.",
  weeks: 6,
  createdAt: "2026-11-13T00:00:00Z",
  modules: [
    {
      week: 2,
      assignment: { kind: "interview", title: "HR round", roundType: "hr_fit_closing", durationMinutes: 30, allowLate: false, attemptLimit: 1 },
    },
    {
      week: 1,
      assignment: {
        kind: "interview",
        title: "DBMS round",
        roundType: "technical_fundamentals",
        durationMinutes: 45,
        allowLate: false,
        attemptLimit: 2,
      },
    },
  ],
};

function staffAs(role: "college_admin" | "tpo" | "faculty") {
  api.fetchMeCampus.mockResolvedValue({ student: null, staff: [{ orgId: "o1", orgName: "Test College", logoUrl: null, role }] });
}

beforeEach(() => {
  vi.clearAllMocks();
  staffAs("tpo");
  api.fetchProgrammes.mockResolvedValue([]);
  api.fetchProgrammeTemplates.mockResolvedValue([template]);
  api.fetchBatches.mockResolvedValue([
    { id: "b1", departmentId: "d1", departmentCode: "CSE", graduationYear: 2027, name: "CSE 2027", studentCount: 60 },
    { id: "b2", departmentId: "d2", departmentCode: "ECE", graduationYear: 2027, name: "ECE 2027", studentCount: 40 },
  ]);
});

describe("the weekly schedule", () => {
  it("opens each week at 09:00 IST, a week apart, and is due 7 days later", () => {
    const rows = weeklySchedule("2026-12-07", template.modules);
    expect(rows.map((r) => r.week)).toEqual([1, 2]);
    expect(rows[0]).toMatchObject({ title: "DBMS round", opensAt: "2026-12-07T03:30:00.000Z", dueAt: "2026-12-14T03:30:00.000Z" });
    expect(rows[1]).toMatchObject({ title: "HR round", opensAt: "2026-12-14T03:30:00.000Z", dueAt: "2026-12-21T03:30:00.000Z" });
    expect(formatIst(rows[0]!.opensAt)).toMatch(/7 Dec,? 2026.*9:00.*IST$/i);
  });

  it("crosses a month end without drifting", () => {
    expect(weeklySchedule("2027-01-28", [{ ...template.modules[0]!, week: 2 }])[0]?.opensAt).toBe("2027-02-04T03:30:00.000Z");
  });

  it("knows India's date when the browser is still on yesterday", () => {
    expect(todayInIndia(new Date("2026-12-07T19:00:00Z"))).toBe("2026-12-08");
  });
});

describe("starting a programme", () => {
  it("previews the dated schedule in IST, then starts it for the chosen batches", async () => {
    const user = userEvent.setup();
    api.startProgramme.mockResolvedValue({
      id: "p1",
      templateId: "t1",
      title: "Placement Accelerator",
      startsOn: "2030-03-04",
      weeks: 6,
      targetBatches: [{ id: "b1", name: "CSE 2027" }],
      assignmentIds: ["a1", "a2"],
      status: "active",
    });
    render(
      <CampusGate title="Programmes">
        <ProgrammesPanel />
      </CampusGate>,
    );

    await screen.findByRole("option", { name: /Placement Accelerator/ });
    await user.selectOptions(screen.getByLabelText("Template"), "t1");
    await user.type(screen.getByLabelText("Start date"), "2030-03-04");
    await user.click(await screen.findByRole("checkbox", { name: /CSE 2027/ }));
    await user.click(screen.getByRole("button", { name: "Preview the schedule" }));

    const table = await screen.findByRole("table", { name: "Weekly schedule (IST)" });
    const week1 = within(table).getByRole("row", { name: /DBMS round/ });
    expect(within(week1).getByText(formatIst("2030-03-04T03:30:00.000Z"))).toBeInTheDocument();
    expect(within(week1).getByText(formatIst("2030-03-11T03:30:00.000Z"))).toBeInTheDocument();
    expect(within(table).getByRole("row", { name: /HR round/ })).toHaveTextContent(formatIst("2030-03-11T03:30:00.000Z"));
    expect(api.startProgramme).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Confirm and start" }));
    await waitFor(() =>
      expect(api.startProgramme).toHaveBeenCalledWith("token", "o1", { templateId: "t1", startsOn: "2030-03-04", batchIds: ["b1"] }),
    );
    expect(await screen.findByText(/Placement Accelerator has started. 2 assignments were published/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Placement Accelerator" })).toHaveAttribute("href", "/campus/programmes/p1?org=o1");
  });

  it("asks for a template, a start date and a batch before previewing", async () => {
    const user = userEvent.setup();
    render(
      <CampusGate title="Programmes">
        <ProgrammesPanel />
      </CampusGate>,
    );
    await user.click(await screen.findByRole("button", { name: "Preview the schedule" }));
    const alert = await screen.findByRole("alert");
    expect(alert).toHaveTextContent("Choose a programme template.");
    expect(alert).toHaveTextContent("Choose a start date.");
    expect(alert).toHaveTextContent("Choose at least one batch.");
    expect(screen.queryByRole("table", { name: "Weekly schedule (IST)" })).not.toBeInTheDocument();
  });

  it("is not offered to faculty, who still see the list", async () => {
    staffAs("faculty");
    render(
      <CampusGate title="Programmes">
        <ProgrammesPanel />
      </CampusGate>,
    );
    expect(await screen.findByRole("heading", { name: "No programmes yet" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Start a programme" })).not.toBeInTheDocument();
  });
});

describe("a student's programmes", () => {
  const mine = (over: Partial<MyProgrammeView> = {}): MyProgrammeView => ({
    id: "p1",
    templateId: "t1",
    title: "Placement Accelerator",
    startsOn: "2026-12-07",
    weeks: 6,
    targetBatches: [],
    assignmentIds: [],
    status: "active",
    completedModules: 2,
    totalModules: 6,
    certificateId: null,
    ...over,
  });

  it("shows progress n of m, and the certificate link only once earned", () => {
    const { rerender } = render(<ProgrammesBlock programmes={[mine()]} />);
    expect(screen.getByText(/2 of 6 modules completed/)).toBeInTheDocument();
    expect(screen.getByRole("progressbar", { name: /2 of 6 modules completed/ })).toHaveAttribute("aria-valuenow", "2");
    expect(screen.queryByRole("link", { name: /View certificate/ })).not.toBeInTheDocument();

    rerender(<ProgrammesBlock programmes={[mine({ completedModules: 6, certificateId: "UT-AAAA-BBBB-CCCC-DDDD" })]} />);
    expect(screen.getByRole("link", { name: /^View certificate/ })).toHaveAttribute(
      "href",
      "/campus/me/certificates/p1",
    );
  });
});

describe("the certificate", () => {
  const certificate: CertificateView = {
    programmeTitle: "Placement Accelerator",
    studentName: "Asha Rao",
    orgName: "Test College",
    orgLogoUrl: "https://example.test/logo.png",
    completedAt: "2026-12-20T10:00:00Z",
    certificateId: "UT-AAAA-BBBB-CCCC-DDDD",
  };

  it("names the student, programme and college, carries no score, and prints", async () => {
    const user = userEvent.setup();
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    api.fetchMyCertificate.mockResolvedValue(certificate);
    render(<ProgrammeCertificate programmeId="p1" />);

    const sheet = await screen.findByRole("article", { name: "Certificate of completion for Asha Rao" });
    expect(within(sheet).getByRole("heading", { name: "Asha Rao" })).toBeInTheDocument();
    expect(within(sheet).getByText("Placement Accelerator")).toBeInTheDocument();
    expect(within(sheet).getAllByText(/Test College/).length).toBeGreaterThan(0);
    expect(within(sheet).getByRole("img", { name: "Test College logo" })).toBeInTheDocument();
    expect(within(sheet).getAllByRole("img", { name: "Untiered" }).length).toBeGreaterThan(0);
    expect(within(sheet).getByText("UT-AAAA-BBBB-CCCC-DDDD")).toBeInTheDocument();
    expect(within(sheet).getByText("20 December 2026")).toBeInTheDocument();
    expect(sheet.textContent).not.toMatch(/score|%|\b\d{1,3}\s*\/\s*100\b|band/i);

    await user.click(screen.getByRole("button", { name: "Print / Save as PDF" }));
    expect(print).toHaveBeenCalled();
    print.mockRestore();
  });

  it("says plainly that it is not ready while the API answers 404", async () => {
    api.fetchMyCertificate.mockRejectedValue(new ApiRequestError(404, "not_found", "That resource does not exist."));
    render(<ProgrammeCertificate programmeId="p1" />);
    expect(await screen.findByRole("heading", { name: "This certificate is not ready yet" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Print / Save as PDF" })).not.toBeInTheDocument();
  });
});

describe("the template editor", () => {
  it("checks the template before saving and sends each module without dates or targets", async () => {
    const user = userEvent.setup();
    api.fetchAdminProgrammeTemplates.mockResolvedValue([]);
    api.createProgrammeTemplate.mockImplementation((_token: string, body: unknown) =>
      Promise.resolve({ ...(body as object), id: "t9", createdAt: "2026-11-14T00:00:00Z" }),
    );
    render(<AdminProgrammes />);

    await user.click(await screen.findByRole("button", { name: "New template" }));
    await user.click(screen.getByRole("button", { name: "Create template" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Give the programme a title");
    expect(api.createProgrammeTemplate).not.toHaveBeenCalled();

    await user.type(screen.getByLabelText("Programme title"), "Two-week sprint");
    await user.selectOptions(screen.getByLabelText("Weeks"), "2");
    await user.type(screen.getByLabelText("Title"), "DBMS round");
    await user.click(screen.getByRole("button", { name: "Create template" }));

    await waitFor(() => expect(api.createProgrammeTemplate).toHaveBeenCalled());
    const body = api.createProgrammeTemplate.mock.calls[0]?.[1];
    expect(body).toMatchObject({ title: "Two-week sprint", weeks: 2, modules: [{ week: 1, assignment: { kind: "interview", title: "DBMS round" } }] });
    expect(body.modules[0].assignment).not.toHaveProperty("dueAt");
    expect(body.modules[0].assignment).not.toHaveProperty("targets");
    expect(await screen.findByRole("heading", { name: "Two-week sprint" })).toBeInTheDocument();
  });
});
