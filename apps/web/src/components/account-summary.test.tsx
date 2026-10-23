import type { MeResponse } from "@untiered/shared";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { AccountSummary, forgetAccount } from "./account-summary";

const fetchMe = vi.hoisted(() => vi.fn());
const updateEmailPreferences = vi.hoisted(() => vi.fn());
const signOut = vi.hoisted(() => vi.fn());
const auth = vi.hoisted(() => ({ token: "token-abc" as string | null | undefined }));

vi.mock("@/lib/api", () => ({
  fetchMe,
  updateEmailPreferences,
  ApiRequestError: class extends Error {},
}));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { signOut } }),
}));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => auth.token }));

// The way out now lives inside this block rather than floating at the foot of an empty
// rail, so this component has a router dependency it did not have before.
const route = vi.hoisted(() => ({ pathname: "/dashboard" }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: vi.fn(), refresh: vi.fn() }), usePathname: () => route.pathname }));

const me: MeResponse = {
  id: "6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11",
  email: "candidate@example.com",
  displayName: "Test Candidate",
  preferredLanguage: "hindi_english",
  createdAt: "2026-08-25T10:00:00Z",
  profile: {
    function: null,
    currentLevel: null,
    targetLevel: null,
    totalExperienceMonths: null,
    peopleManagementScope: null,
    location: null,
    relocationIntent: null,
    workAuthorisationStatus: null,
    noticePeriodDays: null,
    compensationExpectation: null,
  },
};

describe("AccountSummary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    forgetAccount();
    window.localStorage.clear();
    window.sessionStorage.clear();
    auth.token = "token-abc";
    route.pathname = "/dashboard";
  });

  it("applies a Google signup email choice after authentication", async () => {
    fetchMe.mockResolvedValue(me);
    updateEmailPreferences.mockResolvedValue({ dailyQuestion: true, announcements: true, reengagement: true });
    window.sessionStorage.setItem("untiered:email-opt-in-pending", "1");

    render(<AccountSummary />);

    await waitFor(() => expect(updateEmailPreferences).toHaveBeenCalledWith("token-abc", {
      dailyQuestion: true, announcements: true, reengagement: true,
    }));
    await waitFor(() => expect(window.sessionStorage.getItem("untiered:email-opt-in-pending")).toBeNull());
  });

  /**
   * Sign out moved off the rail once because a permanently visible control is clutter and
   * easy to hit. It is back on the owner's request (7 Oct 2026), but behind the name: the
   * menu is closed until asked for, so nothing destructive sits in the furniture.
   */
  it("keeps the account actions closed until the name is pressed", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);

    const trigger = await screen.findByRole("button", { name: /account menu for test candidate/i });
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();

    await userEvent.click(trigger);

    expect(trigger).toHaveAttribute("aria-expanded", "true");
    expect(screen.getByRole("link", { name: /explore untiered pro/i })).toHaveAttribute("href", "/upgrade");
    expect(screen.getByRole("link", { name: /profile and resume/i })).toHaveAttribute("href", "/profile");
    expect(screen.queryByRole("link", { name: /all your rounds/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: /delete account/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });

  it("keeps the signed-in name on screen when a page change remounts it", async () => {
    fetchMe.mockResolvedValue(me);
    const first = render(<AccountSummary />);
    await screen.findByRole("button", { name: /account menu for test candidate/i });
    first.unmount();

    fetchMe.mockRejectedValue(new Error("network down"));
    render(<AccountSummary />);

    expect(screen.getByRole("button", { name: /account menu for test candidate/i })).toBeInTheDocument();
    await waitFor(() => expect(fetchMe).toHaveBeenCalledTimes(2));
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("signs out from the menu", async () => {
    fetchMe.mockResolvedValue(me);
    render(<AccountSummary />);

    await userEvent.click(await screen.findByRole("button", { name: /account menu/i }));
    await userEvent.click(screen.getByRole("button", { name: /sign out/i }));

    expect(signOut).toHaveBeenCalledTimes(1);
  });

  it("closes on Escape and gives focus back to the name", async () => {
    fetchMe.mockResolvedValue(me);
    render(<AccountSummary />);

    const trigger = await screen.findByRole("button", { name: /account menu/i });
    await userEvent.click(trigger);
    await userEvent.keyboard("{Escape}");

    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(trigger).toHaveFocus();
  });

  it("announces that it is loading before the profile arrives", () => {
    fetchMe.mockReturnValue(new Promise(() => {}));

    render(<AccountSummary />);

    expect(screen.getByRole("status")).toHaveTextContent(/loading your profile/i);
  });

  it("shows the candidate and their interview language once loaded", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);

    expect(await screen.findByText("Test Candidate")).toBeInTheDocument();
    expect(screen.getByText("Hindi-English")).toBeInTheDocument();
  });

  it("prompts a new candidate to fill in profile details once", async () => {
    fetchMe.mockResolvedValue(me);
    const user = userEvent.setup();

    render(<AccountSummary />);

    expect(await screen.findByRole("heading", { name: "Set up your profile" })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Fill in details" })).toHaveAttribute("href", "/profile#profile-details");
    await user.click(screen.getByRole("button", { name: "Later" }));
    expect(screen.queryByRole("heading", { name: "Set up your profile" })).not.toBeInTheDocument();
    expect(window.localStorage.getItem(`untiered:profile-setup:${me.id}`)).toBe("seen");
  });

  it("does not prompt when profile details already exist", async () => {
    fetchMe.mockResolvedValue({ ...me, profile: { ...me.profile, currentLevel: "Engineer" } });
    render(<AccountSummary />);
    await screen.findByRole("button", { name: /account menu/i });
    expect(screen.queryByRole("heading", { name: "Set up your profile" })).not.toBeInTheDocument();
  });

  it("sends the Supabase access token to the API", async () => {
    fetchMe.mockResolvedValue(me);

    render(<AccountSummary />);
    await screen.findByText("Test Candidate");

    expect(fetchMe).toHaveBeenCalledWith(expect.objectContaining({ accessToken: "token-abc" }));
  });

  it("falls back to the email address when no display name was supplied", async () => {
    fetchMe.mockResolvedValue({ ...me, displayName: null });

    render(<AccountSummary />);

    expect(await screen.findByText("candidate@example.com")).toBeInTheDocument();
  });

  it("reports a failed profile load as an alert rather than an empty panel", async () => {
    fetchMe.mockRejectedValue(new Error("A valid Supabase access token is required."));

    render(<AccountSummary />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/valid supabase access token/i);
  });

  it("reports the missing session when the browser has no token at all", async () => {
    auth.token = null;

    render(<AccountSummary />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/no active session/i);
    expect(fetchMe).not.toHaveBeenCalled();
  });
});
