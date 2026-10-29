import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { LoginOptions } from "./login-options";

const { signInWithOAuth, signUp } = vi.hoisted(() => ({ signInWithOAuth: vi.fn(), signUp: vi.fn() }));

vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }) }));
vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth, signUp } }),
}));

const optIn = { name: /email me the daily question/i };

describe("LoginOptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("shows the email opt-in once, whichever form is showing", async () => {
    render(<LoginOptions next="/dashboard" />);
    expect(screen.getAllByRole("checkbox", optIn)).toHaveLength(1);

    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(screen.getAllByRole("checkbox", optIn)).toHaveLength(1);
  });

  it("carries a choice made on the sign-up form to Google", async () => {
    render(<LoginOptions next="/dashboard" />);
    await userEvent.click(screen.getByRole("button", { name: "Create account" }));
    await userEvent.click(screen.getByRole("checkbox", optIn));
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(window.sessionStorage.getItem("untiered:email-opt-in-pending")).toBe("1");
  });
});
