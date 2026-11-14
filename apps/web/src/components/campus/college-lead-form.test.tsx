import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { CollegeLeadForm } from "./college-lead-form";

const api = vi.hoisted(() => ({ submitCollegeLead: vi.fn() }));

vi.mock("@/lib/api", () => ({
  ...api,
  ApiRequestError: class ApiRequestError extends Error {
    constructor(
      readonly status: number,
      readonly code: string,
      message: string,
    ) {
      super(message);
    }
  },
}));
vi.mock("next/script", () => ({
  default: ({ onReady }: { onReady: () => void }) => (
    <button type="button" onClick={onReady}>
      Load challenge script
    </button>
  ),
}));

const { ApiRequestError } = await import("@/lib/api");

// Braces matter: a function returned from beforeEach is run as its teardown.
beforeEach(() => {
  api.submitCollegeLead.mockReset();
});
afterEach(() => {
  vi.unstubAllEnvs();
  delete window.turnstile;
});

async function fillRequired(user: ReturnType<typeof userEvent.setup>) {
  await user.type(screen.getByLabelText("College name"), "Demo Institute of Technology");
  await user.type(screen.getByLabelText("City"), "Pune");
  await user.type(screen.getByLabelText("State"), "Maharashtra");
  await user.type(screen.getByLabelText("Your name"), "Asha Rao");
  await user.selectOptions(screen.getByLabelText("Your role"), "tpo");
  await user.type(screen.getByLabelText("Work email"), "asha@college.edu");
  await user.click(screen.getByLabelText("You may contact me about Untiered Campus"));
}

describe("college registration form", () => {
  it("checks every required field before sending, and points at the first problem", async () => {
    const user = userEvent.setup();
    render(<CollegeLeadForm />);

    await user.click(screen.getByRole("button", { name: "Register your college" }));

    expect(api.submitCollegeLead).not.toHaveBeenCalled();
    expect(screen.getByLabelText("College name")).toHaveAttribute("aria-invalid", "true");
    expect(screen.getByLabelText("College name")).toHaveFocus();
    expect(screen.getByText("Enter your college's name.")).toBeInTheDocument();
    expect(screen.getByText("Choose your role.")).toBeInTheDocument();
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
    expect(screen.getByText("Tick this box so we can reply to you.")).toBeInTheDocument();

    // Each error clears as its field is fixed.
    await user.type(screen.getByLabelText("College name"), "Demo Institute");
    expect(screen.queryByText("Enter your college's name.")).not.toBeInTheDocument();
    await user.type(screen.getByLabelText("Phone (optional)"), "call me");
    expect(screen.getByText("Use up to 20 digits, spaces or + - ( ).")).toBeInTheDocument();
  });

  it("has a honeypot that people never see or reach, and sends it empty", async () => {
    const user = userEvent.setup();
    api.submitCollegeLead.mockResolvedValue(undefined);
    render(<CollegeLeadForm />);

    const trap = screen.getByTestId("lead-honeypot");
    expect(trap).toHaveAttribute("aria-hidden", "true");
    expect(trap.className).toContain("-left-[10000px]");
    const input = trap.querySelector("input");
    expect(input).toHaveAttribute("tabindex", "-1");
    expect(input).toHaveAttribute("autocomplete", "off");
    expect(screen.queryByRole("textbox", { name: "Website" })).not.toBeInTheDocument();

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Register your college" }));

    await waitFor(() => expect(api.submitCollegeLead).toHaveBeenCalledTimes(1));
    expect(api.submitCollegeLead).toHaveBeenCalledWith({
      collegeName: "Demo Institute of Technology",
      city: "Pune",
      state: "Maharashtra",
      contactName: "Asha Rao",
      contactRole: "tpo",
      email: "asha@college.edu",
      phone: null,
      approxStudents: null,
      message: null,
      consentToContact: true,
      turnstileToken: "",
      website: "",
    });
  });

  it("thanks the college without promising a time it cannot keep", async () => {
    const user = userEvent.setup();
    api.submitCollegeLead.mockResolvedValue(undefined);
    render(<CollegeLeadForm />);

    await fillRequired(user);
    await user.type(screen.getByLabelText(/Students in your final-year batches/), "850");
    await user.click(screen.getByRole("button", { name: "Register your college" }));

    expect(await screen.findByRole("status")).toHaveTextContent(
      "Thanks — someone from our team will contact you within a few working days.",
    );
    expect(api.submitCollegeLead.mock.calls[0]?.[0]).toMatchObject({ approxStudents: 850 });
    expect(screen.queryByRole("form")).not.toBeInTheDocument();
  });

  it("says what the details are for and links to the privacy policy", () => {
    render(<CollegeLeadForm />);
    expect(screen.getByText(/only to reply to you about Untiered Campus/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "privacy policy" })).toHaveAttribute("href", "/privacy");
  });

  it("shows the API's field error beside the field it names", async () => {
    const user = userEvent.setup();
    api.submitCollegeLead.mockRejectedValue(new ApiRequestError(400, "lead_invalid", "email: Enter a valid email address."));
    render(<CollegeLeadForm />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Register your college" }));

    await waitFor(() => expect(screen.getByLabelText("Work email")).toHaveAttribute("aria-invalid", "true"));
    expect(screen.getByText("Enter a valid email address.")).toBeInTheDocument();
  });

  it("says so plainly when the form has been sent too often", async () => {
    const user = userEvent.setup();
    api.submitCollegeLead.mockRejectedValue(new ApiRequestError(429, "rate_limited", "Too many"));
    render(<CollegeLeadForm />);

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Register your college" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(/sent a few times already/);
  });

  it("shows no security check without a site key", () => {
    render(<CollegeLeadForm />);
    expect(screen.queryByLabelText("Security check")).not.toBeInTheDocument();
  });

  it("with a site key, shows the security check and sends its token", async () => {
    vi.stubEnv("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "public-key");
    const user = userEvent.setup();
    api.submitCollegeLead.mockResolvedValue(undefined);
    let solve: ((token: string) => void) | undefined;
    window.turnstile = {
      render: (_container, options) => {
        solve = options.callback;
        return "widget-1";
      },
      remove: vi.fn(),
    };
    render(<CollegeLeadForm />);
    expect(screen.getByLabelText("Security check")).toBeInTheDocument();

    await fillRequired(user);
    await user.click(screen.getByRole("button", { name: "Register your college" }));
    expect(screen.getByRole("alert")).toHaveTextContent("Complete the security check");
    expect(api.submitCollegeLead).not.toHaveBeenCalled();

    await user.click(screen.getByRole("button", { name: "Load challenge script" }));
    act(() => solve?.("verified-token"));
    await user.click(screen.getByRole("button", { name: "Register your college" }));

    await waitFor(() => expect(api.submitCollegeLead).toHaveBeenCalledTimes(1));
    expect(api.submitCollegeLead.mock.calls[0]?.[0]).toMatchObject({ turnstileToken: "verified-token" });
  });
});
