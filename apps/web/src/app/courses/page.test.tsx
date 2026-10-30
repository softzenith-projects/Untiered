import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import CoursesPage from "./page";

const getClaims = vi.hoisted(() => vi.fn());
/** What the banner was handed, because what matters is what reaches the browser, not what shows. */
const bannerProps = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({ auth: { getClaims } }),
}));
vi.mock("@/components/courses/daily-challenge-banner", () => ({
  DailyChallengeBanner: (props: unknown) => {
    bannerProps(props);
    return <p>Question of the day</p>;
  },
}));
vi.mock("@/components/courses/import-browser-progress", () => ({ ImportBrowserProgress: () => null }));
vi.mock("@/components/courses/course-catalogue", () => ({
  CourseCatalogue: ({ courses }: { courses: { title: string }[] }) => (
    <ul>{courses.map((course) => <li key={course.title}>{course.title}</li>)}</ul>
  ),
}));

describe("CoursesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows a signed-out visitor every course and sends them no Arena question or answer", async () => {
    getClaims.mockResolvedValue({ data: null });

    render(await CoursesPage());

    expect(screen.getByText("Java Programming")).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    expect(screen.queryByText("Question of the day")).not.toBeInTheDocument();
    expect(bannerProps).not.toHaveBeenCalled();
  });

  it("keeps the daily question for a signed-in learner", async () => {
    getClaims.mockResolvedValue({ data: { claims: { sub: "6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11" } } });

    render(await CoursesPage());

    expect(screen.getByText("Question of the day")).toBeInTheDocument();
    expect(screen.getByText("Java Programming")).toBeInTheDocument();
  });
});
