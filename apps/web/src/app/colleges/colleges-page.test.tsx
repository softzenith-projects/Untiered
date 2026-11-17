import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CollegesPage from "./page";
import { CollegesBand } from "@/components/landing/colleges-band";
import { LEGAL } from "@/lib/legal";
import { useAccessToken } from "@/lib/use-access-token";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => null) }));

function pilotLinks() {
  return screen.getAllByRole("link", { name: "Talk to us about a pilot" });
}

afterEach(() => vi.unstubAllEnvs());

describe("colleges page", () => {
  it("asks a college to register with the form, and keeps email as an option", () => {
    render(<CollegesPage />);
    for (const link of screen.getAllByRole("link", { name: "Register your college" })) {
      expect(link).toHaveAttribute("href", "#register");
    }
    const section = screen.getByRole("region", { name: "Register your college" });
    expect(section).toHaveAttribute("id", "register");
    expect(within(section).getByRole("form", { name: "Register your college" })).toBeInTheDocument();
    const email = within(section).getByRole("link", { name: LEGAL.contactEmail });
    expect(email.getAttribute("href")?.startsWith(`mailto:${LEGAL.contactEmail}?`)).toBe(true);
    expect(screen.queryByRole("link", { name: "Talk to us about a pilot" })).not.toBeInTheDocument();
  });

  it("falls back to writing to us when self-registration is switched off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS_LEADS", "false");
    render(<CollegesPage />);
    expect(screen.queryByRole("form", { name: "Register your college" })).not.toBeInTheDocument();
    expect(screen.queryByRole("link", { name: "Register your college" })).not.toBeInTheDocument();
    const links = pilotLinks();
    expect(links.length).toBeGreaterThan(0);
    for (const link of links) {
      const href = link.getAttribute("href") ?? "";
      expect(href.startsWith(`mailto:${LEGAL.contactEmail}?`)).toBe(true);
      expect(decodeURIComponent(href)).toContain("Batches you would like to start with");
    }
  });

  it("keeps what exists today apart from what is still being built", () => {
    render(<CollegesPage />);
    const building = screen.getByRole("region", { name: /what we.re building for placement cells/i });
    expect(within(building).getByText("In development")).toBeInTheDocument();
    expect(within(building).getByRole("heading", { name: "Readiness view" })).toBeInTheDocument();

    const today = screen.getByRole("region", { name: "What your students can use today" });
    expect(within(today).queryByRole("heading", { name: "Readiness view" })).not.toBeInTheDocument();
  });

  it("signs college staff into their portal, not the student app, when the campus switch is on", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    render(<CollegesPage />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "College staff sign in" })).toHaveAttribute("href", "/login?next=/campus");
    expect(within(header).queryByRole("link", { name: "Sign in" })).not.toBeInTheDocument();
  });

  it("takes signed-in staff straight to the college portal", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    vi.mocked(useAccessToken).mockReturnValueOnce("token");
    render(<CollegesPage />);
    const header = screen.getByRole("banner");
    expect(within(header).getByRole("link", { name: "College portal" })).toHaveAttribute("href", "/campus");
    expect(within(header).queryByRole("link", { name: "Dashboard" })).not.toBeInTheDocument();
  });

  it("offers no sign-in in the header while the portal is switched off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "false");
    render(<CollegesPage />);
    const header = screen.getByRole("banner");
    expect(within(header).queryByRole("link", { name: /sign in/i })).not.toBeInTheDocument();
    expect(within(header).getByRole("link", { name: "Register your college" })).toHaveAttribute("href", "#register");
  });

  it("does not claim the camera is recorded", () => {
    render(<CollegesPage />);
    expect(screen.getByText(/the camera is never recorded/i)).toBeInTheDocument();
  });
});

describe("landing page colleges band", () => {
  it("links to the colleges page and to the registration form, and says the batch tools are in development", () => {
    render(<CollegesBand />);
    expect(screen.getByRole("link", { name: "Untiered for Colleges" })).toHaveAttribute("href", "/colleges");
    expect(screen.getByRole("link", { name: "Register your college" })).toHaveAttribute("href", "/colleges#register");
    expect(screen.getByText(/in development with partner colleges/i)).toBeInTheDocument();
  });

  it("links to the pilot email when self-registration is switched off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS_LEADS", "false");
    render(<CollegesBand />);
    expect(pilotLinks()[0]?.getAttribute("href")).toMatch(/^mailto:/);
    expect(screen.queryByRole("link", { name: "Register your college" })).not.toBeInTheDocument();
  });
});
