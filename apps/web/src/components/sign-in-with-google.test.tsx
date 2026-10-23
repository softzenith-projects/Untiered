import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { SignInWithGoogle } from "./sign-in-with-google";

const signInWithOAuth = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signInWithOAuth } }),
}));

describe("SignInWithGoogle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.sessionStorage.clear();
    signInWithOAuth.mockResolvedValue({ error: null });
  });

  it("keeps an explicit email choice across the OAuth redirect", async () => {
    render(<SignInWithGoogle next="/dashboard" />);
    await userEvent.click(screen.getByRole("checkbox", { name: /email me the daily question/i }));
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(window.sessionStorage.getItem("untiered:email-opt-in-pending")).toBe("1");
  });

  it("exposes a single button with an accessible name", () => {
    render(<SignInWithGoogle next="/dashboard" />);

    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });

  it("starts the Google flow and carries the destination through the callback", async () => {
    render(<SignInWithGoogle next="/dashboard" />);

    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(signInWithOAuth).toHaveBeenCalledTimes(1);
    const [call] = signInWithOAuth.mock.calls;
    expect(call?.[0]).toMatchObject({ provider: "google" });

    const redirectTo = new URL(call?.[0].options.redirectTo as string);
    expect(redirectTo.pathname).toBe("/auth/callback");
    expect(redirectTo.searchParams.get("next")).toBe("/dashboard");
  });

  it("reports a failure to start the flow instead of hanging on a pending button", async () => {
    signInWithOAuth.mockResolvedValue({ error: new Error("provider not enabled") });

    render(<SignInWithGoogle next="/dashboard" />);
    await userEvent.click(screen.getByRole("button", { name: "Continue with Google" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be started/i);
    expect(screen.getByRole("button", { name: "Continue with Google" })).toBeEnabled();
  });
});
