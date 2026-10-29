import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardQuestionOfDay } from "@/components/dashboard-question-of-day";
import { localDateKey } from "@/lib/arena/progression";
import type { Challenge } from "@/lib/arena/types";

const recordAnswer = vi.hoisted(() => vi.fn());
const retry = vi.hoisted(() => vi.fn());
const arena = vi.hoisted(() => ({
  ready: true,
  status: "ready" as "ready" | "loading" | "error",
  progress: {
    version: 1 as const,
    xp: 0,
    streak: { current: 0, longest: 0, lastActiveDate: null },
    badges: [] as string[],
    cards: {},
    masteredChallengeIds: [] as string[],
    dailyQuestionCompletions: {} as Record<string, string>,
  },
}));

vi.mock("@/lib/arena/progress-store", () => ({
  useArenaProgress: () => ({ ...arena, recordAnswer, retry, awardBadges: vi.fn() }),
}));

const question: Challenge = {
  id: "daily-dsa-arrays",
  kind: "mcq",
  courseSlug: "dsa",
  chapterSlug: "arrays",
  moduleTitle: "Arrays",
  prompt: "Which lookup is constant time for an array index?",
  options: ["Reading array[i]", "Scanning every value", "Sorting the array"],
  correctIndex: 0,
  why: "An index maps directly to an offset from the array's starting address.",
};

function todayQuestions(): Record<string, Challenge> {
  return { [localDateKey(new Date())]: question };
}

describe("DashboardQuestionOfDay", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    arena.ready = true;
    arena.status = "ready";
    arena.progress.dailyQuestionCompletions = {};
    recordAnswer.mockResolvedValue(true);
  });

  it("shows one stable daily question and records a correct solution for today", async () => {
    const user = userEvent.setup();
    render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} />);

    expect(screen.getByRole("heading", { name: "Question of the day" })).toBeInTheDocument();
    expect(screen.getByText(question.prompt)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Answer it" }));

    await user.click(screen.getByRole("button", { name: /Reading array\[i\]/ }));
    await user.click(screen.getByRole("button", { name: /Confirm/ }));

    const today = localDateKey(new Date());
    await waitFor(() => expect(recordAnswer).toHaveBeenCalledTimes(1));
    expect(recordAnswer.mock.calls[0]![0]).toBe(question.id);
    expect(recordAnswer.mock.calls[0]![1]).toBe(true);
    expect(recordAnswer.mock.calls[0]![4]).toBe(today);
    expect(await screen.findByText(/Awesome job — you solved the Question of the Day/i)).toBeInTheDocument();
  });

  it("starts collapsed on the dashboard and opens in full on the daily page", () => {
    const { unmount } = render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} />);
    expect(screen.getByText(question.prompt)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Reading array\[i\]/ })).not.toBeInTheDocument();
    unmount();

    render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} focused />);
    expect(screen.queryByRole("button", { name: "Answer it" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reading array\[i\]/ })).toBeInTheDocument();
  });

  it("restores the green solved state from account progress", () => {
    arena.progress.dailyQuestionCompletions = { [localDateKey(new Date())]: question.id };
    render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} />);

    expect(screen.getByText(/Awesome job — you solved the Question of the Day/i)).toBeInTheDocument();
    expect(screen.queryByText(question.prompt)).not.toBeInTheDocument();
  });

  it("does not mark an incorrect answer as the daily completion", async () => {
    const user = userEvent.setup();
    render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} />);

    await user.click(screen.getByRole("button", { name: "Answer it" }));
    await user.click(screen.getByRole("button", { name: /Scanning every value/ }));
    await user.click(screen.getByRole("button", { name: /Confirm/ }));

    expect(await screen.findByText("Not quite")).toBeInTheDocument();
    expect(recordAnswer.mock.calls[0]![1]).toBe(false);
    expect(recordAnswer.mock.calls[0]![4]).toBeUndefined();
    expect(screen.queryByText(/Awesome job/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Try again" })).toBeInTheDocument();
  });

  it("reports a save failure instead of showing a false completion", async () => {
    recordAnswer.mockResolvedValue(false);
    const user = userEvent.setup();
    render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} />);

    await user.click(screen.getByRole("button", { name: "Answer it" }));
    await user.click(screen.getByRole("button", { name: /Reading array\[i\]/ }));
    await user.click(screen.getByRole("button", { name: /Confirm/ }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be saved/i);
    expect(screen.queryByText(/Awesome job/i)).not.toBeInTheDocument();
  });

  it("offers a retry when progress cannot be loaded", async () => {
    arena.ready = false;
    arena.status = "error";
    render(<DashboardQuestionOfDay questionsByDate={todayQuestions()} />);

    expect(screen.getByRole("alert")).toHaveTextContent(/temporarily unavailable/i);
    expect(screen.queryByText(question.prompt)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });
});
