import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppChrome, isShellPath } from "./app-chrome";

const route = vi.hoisted(() => ({ pathname: "/dashboard" }));
const session = vi.hoisted(() => ({ token: "a-token" as string | null | undefined }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => session.token }));
vi.mock("next/navigation", () => ({ usePathname: () => route.pathname }));
vi.mock("@/components/account-summary", () => ({ AccountSummary: () => <span>Account</span> }));
vi.mock("@/components/credit-balance", () => ({ CreditBalance: () => <span>Credits</span> }));
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
  beforeEach(() => {
    session.token = "a-token";
  });

  it("gives a signed-out visitor a way home, somewhere to go, and a way back after signing in", () => {
    session.token = null;
    route.pathname = "/courses/java";
    render(<AppChrome><p>Overview</p></AppChrome>);

    expect(screen.getByRole("link", { name: "Untiered home" })).toHaveAttribute("href", "/");
    expect(screen.getByRole("link", { name: "Courses" })).toHaveAttribute("href", "/courses");
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login?next=%2Fcourses%2Fjava");
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
    expect(screen.queryByText("Account")).not.toBeInTheDocument();
    expect(screen.queryByText("Credits")).not.toBeInTheDocument();
  });

  it("keeps the signed-in bar for a signed-in candidate", () => {
    route.pathname = "/courses/java";
    render(<AppChrome><p>Overview</p></AppChrome>);

    expect(screen.getByRole("link", { name: "Untiered dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
    expect(screen.getByText("Account")).toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("does not flash the signed-out bar while the session is still unknown", () => {
    session.token = undefined;
    route.pathname = "/courses/java";
    render(<AppChrome><p>Overview</p></AppChrome>);

    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toBeInTheDocument();
  });

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
