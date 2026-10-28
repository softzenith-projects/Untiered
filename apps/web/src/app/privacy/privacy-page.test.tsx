import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ContactPage from "../contact/page";
import TermsPage from "../terms/page";
import PrivacyPage from "./page";
import { useAccessToken } from "@/lib/use-access-token";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => null) }));

/**
 * The legal pages make promises the code has to keep. These pin the ones that matter most,
 * so a change to the product that breaks one shows up as a failing test, not a false policy.
 */
describe("legal pages", () => {
  beforeEach(() => vi.mocked(useAccessToken).mockReturnValue(null));

  it("states answer audio is not saved, the camera is not recorded, and reports expire", () => {
    render(<PrivacyPage />);

    expect(screen.getByText(/your camera is never recorded/i)).toBeInTheDocument();
    expect(screen.getByText(/we do not save that audio file/i)).toBeInTheDocument();
    expect(screen.getByText(/spoken interviewer questions are queued for storage deletion/i)).toBeInTheDocument();
    expect(screen.getByText(/deleted 28 days after the interview/i)).toBeInTheDocument();
    expect(screen.getByText(/india \(mumbai, ap-south-1\)/i)).toBeInTheDocument();
    expect(screen.getByText(/never receives recordings of your voice/i)).toBeInTheDocument();
  });

  it("shows the confirmed support email and routes complaints to it", () => {
    render(<ContactPage />);

    expect(screen.getByText(/write to our grievance officer, natasha sharma, at help@untiered\.tech\./i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "help@untiered.tech" })).toHaveAttribute(
      "href",
      "mailto:help@untiered.tech",
    );
    expect(screen.getAllByRole("link", { name: "Sign in" }).length).toBeGreaterThan(0);
  });

  it("uses the same support email in the privacy policy and terms", () => {
    const privacy = render(<PrivacyPage />);
    expect(screen.getAllByText(/help@untiered\.tech/).length).toBe(2);

    privacy.unmount();
    render(<TermsPage />);
    // Once for refund requests on paid interviews, once for general questions.
    expect(screen.getAllByText(/help@untiered\.tech/).length).toBe(2);
  });

  it("states the same free allowance the API enforces", () => {
    render(<TermsPage />);

    expect(screen.getByText(/your first 3 mock interviews are free/i)).toBeInTheDocument();
  });

  it("links every legal page from the others", () => {
    render(<PrivacyPage />);
    const footer = screen.getByRole("navigation", { name: /legal/i });

    expect(footer).toHaveTextContent(/privacy policy/i);
    expect(footer).toHaveTextContent(/terms of use/i);
    expect(footer).toHaveTextContent(/contact/i);
  });

  it("shows the current brand and a dashboard link to a signed-in visitor", () => {
    vi.mocked(useAccessToken).mockReturnValue("verified-token");
    render(<ContactPage />);

    expect(screen.getAllByRole("img", { name: "Untiered" }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("link", { name: "Dashboard" }).length).toBeGreaterThan(0);
    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("does not flash a sign-in link while the browser checks the session", () => {
    vi.mocked(useAccessToken).mockReturnValue(undefined);
    render(<ContactPage />);

    expect(screen.queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });
});
