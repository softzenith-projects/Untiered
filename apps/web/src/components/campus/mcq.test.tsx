import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { Route } from "next";

import type { AssignedItem, McqAttemptView, McqBankSummary, StudentReadiness } from "@untiered/shared";

import { AssignedToYou } from "./assigned-to-you";
import { defaultComponent, emptyForm, toInput, validateForm, type AssignmentForm } from "./assignment-model";
import { CampusGate } from "./campus-context";
import { formatRemaining, McqTestPage } from "./mcq-test";
import { NewAssignment } from "./new-assignment";
import { StudentReadinessView } from "./student-readiness-view";

const api = vi.hoisted(() => ({
  fetchMeCampus: vi.fn(),
  fetchArenaScenarios: vi.fn(),
  fetchBatches: vi.fn(),
  fetchMembers: vi.fn(),
  fetchMcqBank: vi.fn(),
  createAssignment: vi.fn(),
  publishAssignment: vi.fn(),
  fetchMcqAttempt: vi.fn(),
  submitMcqAttempt: vi.fn(),
  startMcqAttempt: vi.fn(),
  fetchMyAssignments: vi.fn(),
  fetchMyProgrammes: vi.fn(() => Promise.resolve([])),
}));
const nav = vi.hoisted(() => ({ push: vi.fn() }));

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
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/campus/assignments/new",
  useRouter: () => ({ push: nav.push }),
}));

const BANK: McqBankSummary[] = [
  { courseSlug: "dsa", courseTitle: "Data Structures and Algorithms", topic: "dsa", questions: 12 },
  { courseSlug: "javascript", courseTitle: "JavaScript", topic: null, questions: 30 },
];

const questions = [1, 2, 3].map((n) => ({
  id: `mcq-dsa-arrays-q${n}`,
  prompt: `Question ${n} about \`arrays\``,
  code: null,
  options: [
    { id: "a", text: `Option A${n}` },
    { id: "b", text: `Option B${n}` },
  ],
}));

const attempt = (over: Partial<McqAttemptView> = {}): McqAttemptView => ({
  attemptId: "t1",
  assignmentId: "a1",
  assignmentTitle: "DSA check",
  startedAt: new Date(Date.now() - 60_000).toISOString(),
  deadlineAt: null,
  questions,
  submittedAt: null,
  result: null,
  ...over,
});

const graded = (): McqAttemptView =>
  attempt({
    submittedAt: new Date().toISOString(),
    result: {
      correct: 1,
      total: 3,
      score: 33,
      late: false,
      review: [
        { questionId: questions[0]!.id, chosenOptionId: "a", correctOptionId: "a", explanation: "Because A1 is right." },
        { questionId: questions[1]!.id, chosenOptionId: "a", correctOptionId: "b", explanation: "Because B2 is right." },
        { questionId: questions[2]!.id, chosenOptionId: null, correctOptionId: "b", explanation: "Because B3 is right." },
      ],
    },
  });

beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  api.fetchMeCampus.mockResolvedValue({
    student: null,
    staff: [{ orgId: "o1", orgName: "Alpha College", logoUrl: null, role: "tpo" }],
  });
  api.fetchArenaScenarios.mockResolvedValue([]);
  api.fetchBatches.mockResolvedValue([
    { id: "b1", departmentId: "d1", departmentCode: "CSE", graduationYear: 2027, name: "CSE 2027", studentCount: 40 },
  ]);
  api.fetchMembers.mockResolvedValue({ items: [], nextCursor: null });
  api.fetchMcqBank.mockResolvedValue(BANK);
});
afterEach(() => {
  vi.useRealTimers();
});

describe("MCQ test builder", () => {
  const mcqForm = (over: Partial<AssignmentForm> = {}): AssignmentForm => ({
    ...emptyForm(),
    kind: "mcq_test",
    title: "DSA check",
    mcqCourseSlugs: ["dsa"],
    mcqQuestionCount: "10",
    batchIds: ["b1"],
    dueAt: "2027-01-10T10:00",
    ...over,
  });

  it("validates the courses, the question count against the bank, the time limit and the attempts", () => {
    expect(validateForm(mcqForm(), BANK)).toEqual([]);
    expect(validateForm(mcqForm({ mcqCourseSlugs: [] }), BANK)).toContain("Choose between 1 and 10 courses for the test.");
    expect(validateForm(mcqForm({ mcqQuestionCount: "4" }), BANK)).toContain("Each attempt draws 5 to 50 questions.");
    expect(validateForm(mcqForm({ mcqQuestionCount: "51" }), BANK)).toContain("Each attempt draws 5 to 50 questions.");
    expect(validateForm(mcqForm({ mcqQuestionCount: "13" }), BANK)).toContain(
      "The chosen courses have 12 questions; draw at most that many.",
    );
    expect(validateForm(mcqForm({ mcqCourseSlugs: ["dsa", "javascript"], mcqQuestionCount: "40" }), BANK)).toEqual([]);
    expect(validateForm(mcqForm({ mcqCourseSlugs: ["gone"] }), BANK)).toContain(
      "A chosen course no longer has enough questions. Choose another course.",
    );
    expect(validateForm(mcqForm({ mcqTimeLimit: "200" }), BANK)).toContain(
      "The time limit must be 5 to 120 minutes, or empty for no limit.",
    );
    expect(validateForm(mcqForm({ attemptLimit: "11" }), BANK)).toContain("Attempts per student must be a whole number from 1 to 10.");
  });

  it("sends the test's shape, and defaults the component to coding only for DSA", () => {
    expect(toInput(mcqForm({ mcqTimeLimit: "20", attemptLimit: "2" }))).toEqual(
      expect.objectContaining({ kind: "mcq_test", mcq: { courseSlugs: ["dsa"], questionCount: 10, timeLimitMinutes: 20 }, attemptLimit: 2 }),
    );
    expect(toInput(mcqForm()).mcq?.timeLimitMinutes).toBeNull();
    expect(defaultComponent("mcq_test", undefined, [], ["dsa"])).toBe("coding");
    expect(defaultComponent("mcq_test", undefined, [], ["dsa", "javascript"])).toBe("core_cs");
  });

  it("offers bank courses with their counts and topic, refuses too many questions, and saves", async () => {
    api.createAssignment.mockResolvedValue({ id: "a9" });
    render(
      <CampusGate title="Assignments">
        <NewAssignment />
      </CampusGate>,
    );
    await userEvent.click(await screen.findByRole("radio", { name: /MCQ test/ }));
    await userEvent.type(screen.getByLabelText("Title"), "DSA check");
    const courses = await screen.findByRole("group", { name: "Courses" });
    expect(within(courses).getByText("12 questions · Data structures and algorithms")).toBeInTheDocument();
    expect(within(courses).getByText("30 questions · No campus topic")).toBeInTheDocument();

    await userEvent.click(within(courses).getByRole("checkbox", { name: /Data Structures and Algorithms/ }));
    await userEvent.clear(screen.getByLabelText("Questions per attempt"));
    await userEvent.type(screen.getByLabelText("Questions per attempt"), "20");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    expect(await screen.findByText("The chosen courses have 12 questions; draw at most that many.")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Questions per attempt"));
    await userEvent.type(screen.getByLabelText("Questions per attempt"), "10");
    await userEvent.type(screen.getByLabelText(/Time limit in minutes/), "15");
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    await userEvent.click(await screen.findByRole("checkbox", { name: /CSE 2027/ }));
    await userEvent.click(screen.getByRole("button", { name: "Next" }));
    fireEvent.change(await screen.findByLabelText("Deadline"), { target: { value: "2027-01-10T10:00" } });
    expect(screen.getByLabelText("Readiness component")).toHaveValue("coding");
    expect(screen.getByLabelText("Topic (optional)")).toHaveValue("dsa");
    expect(screen.queryByLabelText(/Interview cap/)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Save draft" }));

    await waitFor(() =>
      expect(api.createAssignment).toHaveBeenCalledWith(
        "token",
        "o1",
        expect.objectContaining({
          kind: "mcq_test",
          mcq: { courseSlugs: ["dsa"], questionCount: 10, timeLimitMinutes: 15 },
          component: "coding",
          topic: "dsa",
        }),
      ),
    );
  });
});

describe("taking an MCQ test", () => {
  it("shows the questions with no answer key, asks before submitting, then reviews each answer", async () => {
    api.fetchMcqAttempt.mockResolvedValue(attempt());
    api.submitMcqAttempt.mockResolvedValue(graded());
    render(<McqTestPage attemptId="t1" />);

    const groups = await screen.findAllByRole("group", { name: /Question \d of 3/ });
    expect(groups).toHaveLength(3);
    expect(screen.queryByText(/Because/)).not.toBeInTheDocument();
    expect(screen.queryByText("Correct answer")).not.toBeInTheDocument();
    expect(screen.queryByRole("timer")).not.toBeInTheDocument();

    await userEvent.click(within(groups[0]!).getByRole("radio", { name: "Option A1" }));
    await userEvent.click(within(groups[1]!).getByRole("radio", { name: "Option A2" }));
    expect(screen.getByText("2 of 3 answered")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Submit test" }));
    const dialog = screen.getByRole("alertdialog", { name: "Submit your answers?" });
    expect(dialog).toHaveTextContent("You have answered 2 of 3 questions. 1 unanswered will count as wrong.");
    expect(within(dialog).getByRole("button", { name: "Submit now" })).toHaveFocus();
    await userEvent.click(within(dialog).getByRole("button", { name: "Keep working" }));
    expect(api.submitMcqAttempt).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: "Submit test" }));
    await userEvent.click(screen.getByRole("button", { name: "Submit now" }));
    expect(api.submitMcqAttempt).toHaveBeenCalledWith("token", "t1", {
      answers: [
        { questionId: questions[0]!.id, optionId: "a" },
        { questionId: questions[1]!.id, optionId: "a" },
      ],
    });

    expect(await screen.findByRole("heading", { name: "Score 33 / 100" })).toBeInTheDocument();
    expect(screen.getByText(/1 of 3 correct/)).toBeInTheDocument();
    expect(screen.getByText("Because B2 is right.")).toBeInTheDocument();
    expect(screen.getAllByText("Correct answer")).toHaveLength(3);
    expect(screen.getByText("Not answered")).toBeInTheDocument();
    expect(screen.getByText("Incorrect")).toBeInTheDocument();
  });

  it("restores the answers chosen before a reload", async () => {
    window.localStorage.setItem("untiered.mcq-draft.t1", JSON.stringify({ [questions[1]!.id]: "b" }));
    api.fetchMcqAttempt.mockResolvedValue(attempt());
    render(<McqTestPage attemptId="t1" />);

    const groups = await screen.findAllByRole("group", { name: /Question \d of 3/ });
    expect(within(groups[1]!).getByRole("radio", { name: "Option B2" })).toBeChecked();
    expect(screen.getByText("1 of 3 answered")).toBeInTheDocument();

    await userEvent.click(within(groups[0]!).getByRole("radio", { name: "Option B1" }));
    expect(JSON.parse(window.localStorage.getItem("untiered.mcq-draft.t1") ?? "{}")).toEqual({
      [questions[0]!.id]: "b",
      [questions[1]!.id]: "b",
    });
  });

  it("shows a timer that counts down to the deadline, and submits by itself when the time runs out", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    api.fetchMcqAttempt.mockResolvedValue(attempt({ deadlineAt: new Date(Date.now() + 3_000).toISOString() }));
    api.submitMcqAttempt.mockResolvedValue(graded());
    render(<McqTestPage attemptId="t1" />);

    const timer = await screen.findByRole("timer");
    expect(timer.textContent).toMatch(/^0:0[23]$/);
    expect(screen.getByText("Less than one minute left.")).toBeInTheDocument();
    expect(api.submitMcqAttempt).not.toHaveBeenCalled();

    await act(async () => {
      await vi.advanceTimersByTimeAsync(4_000);
    });
    await waitFor(() => expect(api.submitMcqAttempt).toHaveBeenCalledTimes(1));
    expect(await screen.findByRole("heading", { name: "Score 33 / 100" })).toBeInTheDocument();
  });

  it("opens straight on the result of a submitted attempt", async () => {
    api.fetchMcqAttempt.mockResolvedValue(graded());
    render(<McqTestPage attemptId="t1" />);
    expect(await screen.findByRole("heading", { name: "Score 33 / 100" })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Submit test" })).not.toBeInTheDocument();
    expect(screen.getAllByText("Your answer")).toHaveLength(2);
  });

  it("formats the time left", () => {
    expect(formatRemaining(0)).toBe("0:00");
    expect(formatRemaining(-5_000)).toBe("0:00");
    expect(formatRemaining(65_000)).toBe("1:05");
    expect(formatRemaining(20 * 60_000)).toBe("20:00");
  });
});

describe("an MCQ test in Assigned to you", () => {
  const item = (over: Partial<AssignedItem> = {}): AssignedItem => ({
    id: "a1",
    orgName: "Alpha College",
    title: "DSA check",
    instructions: null,
    kind: "mcq_test",
    roundType: null,
    durationMinutes: null,
    companyName: null,
    roleTitle: null,
    scenarios: [],
    opensAt: "2026-11-01T00:00:00Z",
    dueAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
    allowLate: false,
    status: "not_started",
    attemptsUsed: 0,
    attemptLimit: 2,
    canStart: true,
    blockedReason: null,
    sessionIds: [],
    mcq: { courseSlugs: ["dsa"], questionCount: 10, timeLimitMinutes: 15 },
    mcqScore: null,
    mcqOpenAttemptId: null,
    mcqLatestAttemptId: null,
    ...over,
  });

  it("starts an attempt and opens it", async () => {
    api.fetchMyAssignments.mockResolvedValue([item()]);
    api.startMcqAttempt.mockResolvedValue(attempt({ attemptId: "t7" }));
    render(<AssignedToYou />);

    expect(await screen.findByText(/MCQ test, 10 questions, 15 minutes/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Start test/ }));
    expect(api.startMcqAttempt).toHaveBeenCalledWith("token", "a1");
    await waitFor(() => expect(nav.push).toHaveBeenCalledWith("/campus/me/tests/t7"));
  });

  it("resumes an open attempt instead of starting another, and links the latest result", async () => {
    api.fetchMyAssignments.mockResolvedValue([
      item({ mcqOpenAttemptId: "t2", mcqLatestAttemptId: "t1", mcqScore: 80, attemptsUsed: 2, canStart: false, blockedReason: "attempt_limit" }),
    ]);
    render(<AssignedToYou />);

    expect(await screen.findByRole("link", { name: /Resume test/ })).toHaveAttribute("href", "/campus/me/tests/t2");
    expect(screen.queryByRole("button", { name: /Start test/ })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: /See your latest result/ })).toHaveAttribute("href", "/campus/me/tests/t1");
    expect(screen.getByText(/best score 80/)).toBeInTheDocument();
  });
});

describe("MCQ evidence on a student's readiness", () => {
  it("links a submitted test to its answers", () => {
    const readiness: StudentReadiness = {
      memberId: "m1",
      name: "Asha",
      rollNumber: "R1",
      batchName: "CSE 2027",
      departmentCode: "CSE",
      overall: null,
      band: "not_enough_evidence",
      components: { coding: 80, coreCs: null, technicalInterview: null, communication: null, aptitude: null },
      weights: { coding: 30, coreCs: 25, technicalInterview: 25, communication: 10, aptitude: 10 },
      evidence: [
        {
          assignmentId: "a1",
          assignmentTitle: "DSA check",
          component: "coding",
          topic: "dsa",
          kind: "mcq_test",
          sessionId: null,
          score: 80,
          completedAt: "2026-11-14T10:00:00Z",
          mcqAttemptId: "t1",
        },
      ],
      suggestedTopics: [],
    };
    render(
      <StudentReadinessView
        readiness={readiness}
        reportHref={(item) => (item.mcqAttemptId ? (`/campus/readiness/m1/tests/${item.mcqAttemptId}?org=o1` as Route) : null)}
      />,
    );
    expect(screen.getByRole("link", { name: "View answers: DSA check" })).toHaveAttribute("href", "/campus/readiness/m1/tests/t1?org=o1");
  });
});
