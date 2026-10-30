import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { HeaderActions } from "./header-actions";

const session = vi.hoisted(() => ({ token: null as string | null | undefined }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => session.token }));
vi.mock("@/components/account-summary", () => ({ AccountSummary: () => <span>Naman Kaushik</span> }));

const cta = { href: "/interview/new" as const, label: "Start free" };

describe("HeaderActions", () => {
  it("shows a signed-in visitor their account instead of an offer to start", () => {
    session.token = "token";
    render(<HeaderActions cta={cta} />);

    expect(screen.getByText("Naman Kaushik")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Dashboard" })).toHaveAttribute("href", "/dashboard");
    expect(screen.queryByRole("link", { name: "Start free" })).not.toBeInTheDocument();
  });

  it("offers a signed-out visitor the way in", () => {
    session.token = null;
    render(<HeaderActions cta={cta} />);

    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute("href", "/login");
    expect(screen.getByRole("link", { name: "Start free" })).toHaveAttribute("href", "/interview/new");
    expect(screen.queryByText("Naman Kaushik")).not.toBeInTheDocument();
  });

  it("shows neither until the session is known", () => {
    session.token = undefined;
    const { container } = render(<HeaderActions cta={cta} />);

    expect(container).toBeEmptyDOMElement();
  });
});
