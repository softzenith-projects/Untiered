import { render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import CollegesPage from "./page";
import { CollegesBand } from "@/components/landing/colleges-band";
import { LEGAL } from "@/lib/legal";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => null) }));

function contactLinks() {
  return screen.getAllByRole("link", { name: "Talk to us about a pilot" });
}

afterEach(() => vi.unstubAllEnvs());

describe("colleges page", () => {
  it("sends a college to write to us, with the details we need already asked for", () => {
    render(<CollegesPage />);
    const links = contactLinks();
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

  it("offers college staff a way into their portal when the campus switch is on", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    render(<CollegesPage />);
    expect(screen.getByRole("link", { name: "College staff? Sign in to your portal" })).toHaveAttribute(
      "href",
      "/login?next=/campus",
    );
  });

  it("does not link to a portal that is switched off", () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "false");
    render(<CollegesPage />);
    expect(screen.queryByRole("link", { name: /college staff/i })).not.toBeInTheDocument();
  });

  it("does not claim the camera is recorded", () => {
    render(<CollegesPage />);
    expect(screen.getByText(/the camera is never recorded/i)).toBeInTheDocument();
  });
});

describe("landing page colleges band", () => {
  it("links to the colleges page and to the pilot contact, and says the batch tools are in development", () => {
    render(<CollegesBand />);
    expect(screen.getByRole("link", { name: "Untiered for colleges" })).toHaveAttribute("href", "/colleges");
    expect(contactLinks()[0]?.getAttribute("href")).toMatch(/^mailto:/);
    expect(screen.getByText(/in development with partner colleges/i)).toBeInTheDocument();
  });
});
