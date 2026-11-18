import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { ProgrammeView, ProgrammeWeekView } from "@untiered/shared";

import { CampusGate } from "./campus-context";
import { ProgrammeDetail } from "./programme-detail";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchProgramme: vi.fn(),
  fetchProgrammeProgress: vi.fn(),
  fetchProgrammeWeeks: vi.fn(),
  archiveProgramme: vi.fn(),
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
  usePathname: () => "/campus/programmes/p1",
  useRouter: () => ({ push: vi.fn() }),
  useSearchParams: () => new URLSearchParams("org=o1"),
}));

const view: ProgrammeView = {
  id: "p1",
  templateId: "t1",
  title: "6-week Placement Accelerator",
  startsOn: "2026-11-02",
  weeks: 6,
  targetBatches: [{ id: "b1", name: "CSE 2027" }],
  assignmentIds: ["a1", "a2", "a3"],
  status: "active",
};

const week = (over: Partial<ProgrammeWeekView>): ProgrammeWeekView => ({
  week: 1,
  opensAt: "2026-11-02T03:30:00Z",
  dueAt: "2026-11-09T03:30:00Z",
  opened: true,
  assignments: [{ id: "a1", title: "Aptitude MCQ and HR basics" }],
  students: 10,
  completedStudents: 9,
  completionRate: 0.9,
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
  api.fetchMeCampus.mockResolvedValue({
    student: null,
    staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "faculty" }],
  });
  api.fetchProgramme.mockResolvedValue(view);
  api.fetchProgrammeProgress.mockResolvedValue([]);
});

function renderDetail() {
  return render(
    <CampusGate title="Programme">
      <ProgrammeDetail programmeId="p1" />
    </CampusGate>,
  );
}

describe("programme detail", () => {
  it("shows each week with its state, the share of students who completed it and the unlock date of a locked one", async () => {
    api.fetchProgrammeWeeks.mockResolvedValue([
      week({}),
      week({ week: 3, opensAt: "2026-11-16T03:30:00Z", students: 8, completedStudents: 3, completionRate: 0.375, assignments: [{ id: "a3", title: "Technical interview: week 3" }] }),
      week({ week: 4, opensAt: "2099-11-23T03:30:00Z", opened: false, students: 8, completedStudents: 0, completionRate: null, assignments: [{ id: "a4", title: "Arena: arrays and hashing" }] }),
    ]);
    renderDetail();

    const weeks = within((await screen.findByRole("heading", { name: "Weeks" })).closest("section")!);
    expect(weeks.getByText("2 of 3 weeks are open. A new week unlocks at 9:00 am IST.")).toBeInTheDocument();
    const items = weeks.getAllByRole("listitem");
    expect(within(items[0]!).getByText("Open")).toBeInTheDocument();
    expect(within(items[0]!).getByText("90%")).toBeInTheDocument();
    expect(within(items[0]!).getByRole("progressbar", { name: "Week 1: 9 of 10 students completed" })).toBeInTheDocument();
    expect(within(items[1]!).getByText("38%")).toBeInTheDocument();
    expect(within(items[2]!).getByText("Locked")).toBeInTheDocument();
    expect(within(items[2]!).getByText(/Unlocks .*2099/)).toBeInTheDocument();
    expect(within(items[2]!).queryByRole("progressbar")).not.toBeInTheDocument();
    expect(api.fetchProgrammeWeeks).toHaveBeenCalledWith("o1", "p1", expect.objectContaining({ accessToken: "token" }));
  });

  it("previews the certificate without a name, date or id, and for faculty offers no archive control", async () => {
    api.fetchProgrammeWeeks.mockResolvedValue([week({})]);
    renderDetail();

    const preview = within((await screen.findByRole("heading", { name: "Certificate" })).closest("section")!);
    expect(preview.getByText("Certificate of completion")).toBeInTheDocument();
    expect(preview.getByText("Awarded to a student who completes all 6 weeks")).toBeInTheDocument();
    expect(preview.getByText(/Alpha College/)).toBeInTheDocument();
    expect(preview.getByText(/Preview\./)).toBeInTheDocument();
    expect(preview.queryByText(/UT-/)).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Archive programme" })).not.toBeInTheDocument();
  });

  it("says when no student is set a week that has opened", async () => {
    api.fetchProgrammeWeeks.mockResolvedValue([week({ students: 0, completedStudents: 0, completionRate: null })]);
    renderDetail();
    expect(await screen.findByText("No students are set this week yet.")).toBeInTheDocument();
  });
});
