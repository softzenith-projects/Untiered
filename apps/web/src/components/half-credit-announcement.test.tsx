import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HalfCreditAnnouncement } from "./half-credit-announcement";

describe("HalfCreditAnnouncement", () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-11-05T10:00:00+05:30"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("announces half-credit 30-minute rounds with a way to try one", () => {
    render(<HalfCreditAnnouncement variant="card" />);

    const note = screen.getByRole("complementary", { name: "What's new" });
    expect(note).toHaveTextContent("0.5 credits");
    expect(note).toHaveTextContent("45 and 60-minute rounds still use one");
    expect(screen.getByRole("link", { name: /try a 30-minute round/i })).toHaveAttribute("href", "/interview/new");
  });

  it("does not link the setup page to itself", () => {
    render(<HalfCreditAnnouncement variant="card" onSetupPage />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
    expect(screen.getByText(/pick 30 minutes under length below/i)).toBeInTheDocument();
  });

  it("sends visitors on the public bar to pricing", () => {
    render(<HalfCreditAnnouncement variant="bar" />);

    expect(screen.getByRole("link", { name: /see pricing/i })).toHaveAttribute("href", "/pricing");
  });

  it("closes everywhere once dismissed, and stays closed", async () => {
    const user = userEvent.setup();
    render(
      <>
        <HalfCreditAnnouncement variant="bar" />
        <HalfCreditAnnouncement variant="card" />
      </>,
    );

    await user.click(screen.getAllByRole("button", { name: "Dismiss this announcement" })[0]!);

    expect(screen.queryByRole("complementary", { name: "What's new" })).not.toBeInTheDocument();
    render(<HalfCreditAnnouncement variant="card" />);
    expect(screen.queryByRole("complementary", { name: "What's new" })).not.toBeInTheDocument();
  });

  it("stops showing once the news is old", () => {
    vi.setSystemTime(new Date("2027-01-02T10:00:00+05:30"));

    render(<HalfCreditAnnouncement variant="card" />);

    expect(screen.queryByRole("complementary", { name: "What's new" })).not.toBeInTheDocument();
  });
});
