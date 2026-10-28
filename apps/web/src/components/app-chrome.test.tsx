import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { AppChrome, isShellPath } from "./app-chrome";

const route = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/account-summary", () => ({ AccountSummary: () => <span>Account</span> }));
vi.mock("@/components/site-footer", () => ({ SiteFooter: () => <footer>Footer</footer> }));
vi.mock("@/components/session-link", () => ({ SessionLink: () => null }));

describe("isShellPath", () => {
  it.each(["/dashboard", "/courses", "/courses/java", "/arena/dsa", "/questions/two-sum", "/report/abc", "/interview/new", "/upgrade"])(
    "frames %s",
    (path) => expect(isShellPath(path)).toBe(true),
  );

  it.each(["/", "/login", "/privacy", "/courses/java/variables", "/interview/abc-123", "/dashboards"])(
    "leaves %s bare",
    (path) => expect(isShellPath(path)).toBe(false),
  );
});

describe("AppChrome", () => {
  it("keeps the same bar mounted when the page underneath changes", () => {
    route.pathname = "/dashboard";
    const view = render(<AppChrome><p>Dashboard body</p></AppChrome>);
    const bar = screen.getByRole("navigation", { name: "Main" });

    route.pathname = "/courses";
    view.rerender(<AppChrome><p>Courses body</p></AppChrome>);

    expect(screen.getByRole("navigation", { name: "Main" })).toBe(bar);
    expect(screen.getByText("Courses body")).toBeInTheDocument();
  });

  it("renders the interview room without the bar", () => {
    route.pathname = "/interview/abc-123";
    render(<AppChrome><p>Room</p></AppChrome>);
    expect(screen.queryByRole("navigation", { name: "Main" })).not.toBeInTheDocument();
    expect(screen.getByText("Room")).toBeInTheDocument();
  });
});
