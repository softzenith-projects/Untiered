import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import ArenaCoursePage from "@/app/arena/[course]/page";
import ArenaPage from "@/app/arena/page";

const captured = vi.hoisted(() => ({ props: null as { courseSlug: string; challenges?: unknown } | null }));
vi.mock("@/components/arena/arena-course-practice", () => ({
  ArenaCoursePractice: (props: { courseSlug: string; challenges?: unknown }) => {
    captured.props = props;
    return <div>Scenario workspace</div>;
  },
}));
vi.mock("@/components/app-shell", () => ({ AppShell: ({ children }: { children: React.ReactNode }) => <>{children}</> }));

describe("scenario Arena pages", () => {
  it("links each course to its own Arena instead of serving a standalone daily set", () => {
    render(<ArenaPage />);
    expect(screen.getByRole("heading", { name: /practise decisions/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /java/i })).toHaveAttribute("href", "/arena/java");
    expect(screen.getByRole("link", { name: /system design/i })).toHaveAttribute("href", "/arena/system-design");
  });

  it("sends only the course slug to the client; the server API owns scenario selection", async () => {
    const element = await ArenaCoursePage({ params: Promise.resolve({ course: "dsa" }) });
    render(element);
    expect(screen.getByText("Scenario workspace")).toBeInTheDocument();
    expect(captured.props).toEqual({ courseSlug: "dsa" });
  });
});
