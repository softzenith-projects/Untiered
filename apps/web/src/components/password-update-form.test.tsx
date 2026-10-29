import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PasswordUpdateForm } from "./password-update-form";

const { getUser, updateUser } = vi.hoisted(() => ({ getUser: vi.fn(), updateUser: vi.fn() }));

vi.mock("@/lib/supabase/client", () => ({
  createSupabaseBrowserClient: () => ({ auth: { getUser, updateUser } }),
}));
vi.mock("@/components/brand-logo", () => ({ BrandWordmark: () => <span>Untiered</span> }));

describe("PasswordUpdateForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getUser.mockResolvedValue({ data: { user: { id: "candidate" } } });
    updateUser.mockResolvedValue({ error: null });
  });

  it("requires a valid session from the reset link", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    render(<PasswordUpdateForm />);
    expect(await screen.findByRole("alert")).toHaveTextContent(/invalid or has expired/i);
    expect(screen.queryByRole("button", { name: "Update password" })).not.toBeInTheDocument();
  });

  it("updates the password and confirms completion", async () => {
    render(<PasswordUpdateForm />);
    await screen.findByRole("button", { name: "Update password" });
    await userEvent.type(screen.getByLabelText("New password"), "strongpassword123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "strongpassword123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    await waitFor(() => expect(updateUser).toHaveBeenCalledWith({ password: "strongpassword123" }));
    expect(await screen.findByRole("status")).toHaveTextContent(/password has been updated/i);
    expect(screen.getByRole("link", { name: /dashboard/i })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps the form available when Supabase rejects the new password", async () => {
    updateUser.mockResolvedValue({ error: new Error("weak password") });
    render(<PasswordUpdateForm />);
    await screen.findByRole("button", { name: "Update password" });
    await userEvent.type(screen.getByLabelText("New password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not update/i);
    expect(screen.getByRole("button", { name: "Update password" })).toBeEnabled();
  });

  it.each([
    [{ code: "same_password" }, /different from your current one/i],
    [{ code: "weak_password", reasons: ["pwned"] }, /known data breach/i],
    [{ code: "weak_password", reasons: ["characters"] }, /letter and a number/i],
  ])("names the reason Supabase gave for refusing the password (%o)", async (rejection, message) => {
    updateUser.mockResolvedValue({ error: Object.assign(new Error("rejected"), rejection) });
    render(<PasswordUpdateForm />);
    await screen.findByRole("button", { name: "Update password" });
    await userEvent.type(screen.getByLabelText("New password"), "password123");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(message);
  });

  it("checks the password rule before contacting Supabase", async () => {
    render(<PasswordUpdateForm />);
    await screen.findByRole("button", { name: "Update password" });
    await userEvent.type(screen.getByLabelText("New password"), "onlyletters");
    await userEvent.type(screen.getByLabelText("Confirm new password"), "onlyletters");
    await userEvent.click(screen.getByRole("button", { name: "Update password" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/letter and a number/i);
    expect(updateUser).not.toHaveBeenCalled();
  });
});
