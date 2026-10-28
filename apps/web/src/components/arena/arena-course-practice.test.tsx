import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ArenaCoursePractice } from "@/components/arena/arena-course-practice";

const { fetchProgress, start, answer } = vi.hoisted(() => ({
  fetchProgress: vi.fn(), start: vi.fn(), answer: vi.fn(),
}));
vi.mock("@/lib/api", () => ({
  fetchScenarioCourseProgress: fetchProgress,
  startScenario: start,
  answerScenarioStep: answer,
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));

const first = {
  id: "dsa:autocomplete:1", position: 1, kind: "initial", stepType: "algo_choice",
  prompt: "Which structure?", contextNote: null,
  options: [{ id: "a", text: "Trie" }, { id: "b", text: "Array scan" }, { id: "c", text: "Stack" }],
  codeSnippet: null, language: null,
  systemState: { nodes: ["students", "web", "db"], links: [["students", "web"], ["web", "db"]] },
};
const next = { ...first, id: "dsa:autocomplete:2", position: 2, kind: "probe", prompt: "What about scale?", contextNote: "Traffic grew." };

describe("course scenario practice", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchProgress.mockResolvedValue({ scenariosDone: 0, activeScenarioId: null, unlockedTier: 0, weakestConcepts: [{ id: "dsa:trie", name: "Trie", score: 0.5 }] });
    start.mockResolvedValue({ scenario: { id: "dsa:autocomplete", courseId: "dsa", title: "Autocomplete", hook: "A search box needs suggestions.", context: "Search", tier: "foundations", estimatedMinutes: 7 }, step: first });
    answer.mockResolvedValue({ correct: false, correctOptionId: "a", explanation: "A trie indexes prefixes.", bottleneckNote: "Prefix lookup.", nextStep: next, solutionBrief: null, conceptsCovered: [] });
  });

  it("shows the hook, grades one answer, and reveals the next contextual probe only after continuing", async () => {
    const user = userEvent.setup();
    render(<ArenaCoursePractice courseSlug="dsa" />);
    await user.click(await screen.findByRole("button", { name: "Start scenario" }));
    expect(screen.getByText("A search box needs suggestions.")).toBeInTheDocument();
    expect(screen.getByRole("region", { name: "System map" })).toHaveTextContent("students");
    expect(screen.queryByText("Traffic grew.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("radio", { name: "Array scan" }));
    await user.click(screen.getByRole("button", { name: "Check answer" }));
    await waitFor(() => expect(answer).toHaveBeenCalledWith("dsa", "token", first.id, "b"));
    expect(screen.getByRole("status")).toHaveTextContent("Best answer: Trie");
    expect(screen.getByRole("status")).toHaveTextContent("Key point: Prefix lookup.");
    expect(screen.queryByText("Traffic grew.")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Next probe" }));
    expect(screen.getByText("Traffic grew.")).toBeInTheDocument();
    expect(screen.getByText("What about scale?")).toBeInTheDocument();
  });

  it("stops showing the loading state after a progress error and can retry", async () => {
    fetchProgress.mockRejectedValueOnce(new Error("server error"));
    const user = userEvent.setup();
    render(<ArenaCoursePractice courseSlug="dsa" />);
    expect(await screen.findByRole("alert")).toHaveTextContent("Please try again");
    expect(screen.queryByText("Loading your progress…")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Start scenario" })).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByRole("button", { name: "Start scenario" })).toBeEnabled();
    expect(fetchProgress).toHaveBeenCalledTimes(2);
  });
});
