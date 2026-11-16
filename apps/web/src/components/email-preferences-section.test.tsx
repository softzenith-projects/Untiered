import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailPreferencesSection } from "./email-preferences-section";

const { fetchEmailPreferences, updateEmailPreferences, fetchMeCampus } = vi.hoisted(() => ({
  fetchEmailPreferences: vi.fn(), updateEmailPreferences: vi.fn(), fetchMeCampus: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ fetchEmailPreferences, updateEmailPreferences, fetchMeCampus }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token-abc" }));

describe("EmailPreferencesSection", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    fetchEmailPreferences.mockResolvedValue({ dailyQuestion: false, announcements: false, reengagement: false, consentedAt: null });
    updateEmailPreferences.mockResolvedValue({ dailyQuestion: true, announcements: false, reengagement: false, consentedAt: "2026-10-23T09:00:00Z" });
  });

  it("keeps all choices off by default and saves only what the candidate selects", async () => {
    render(<EmailPreferencesSection />);
    const daily = await screen.findByRole("checkbox", { name: /question of the day/i });
    expect(daily).not.toBeChecked();
    expect(screen.getByRole("checkbox", { name: /news and learning notes/i })).not.toBeChecked();
    await userEvent.click(daily);
    await userEvent.click(screen.getByRole("button", { name: "Save email preferences" }));

    await waitFor(() => expect(updateEmailPreferences).toHaveBeenCalledWith("token-abc", {
      dailyQuestion: true, announcements: false, reengagement: false,
    }));
    expect(await screen.findByRole("status")).toHaveTextContent("Email preferences saved.");
    // Not a college member, and the campus switch is off: no college toggle, and nothing asked about colleges.
    expect(screen.queryByRole("checkbox", { name: /college reminders/i })).not.toBeInTheDocument();
    expect(fetchMeCampus).not.toHaveBeenCalled();
  });

  it("shows the college reminders toggle to a campus student when campus is on, and saves it", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    fetchEmailPreferences.mockResolvedValue({ dailyQuestion: false, announcements: false, reengagement: false, consentedAt: null, campusReminders: true });
    fetchMeCampus.mockResolvedValue({ student: { orgId: "o", orgName: "Demo College", logoUrl: null, batchId: "b", batchName: "CSE 2027", rollNumber: null }, staff: [] });
    updateEmailPreferences.mockResolvedValue({ dailyQuestion: false, announcements: false, reengagement: false, consentedAt: null, campusReminders: false });

    render(<EmailPreferencesSection />);
    const toggle = await screen.findByRole("checkbox", { name: /college reminders/i });
    expect(toggle).toBeChecked();
    await userEvent.click(toggle);
    await userEvent.click(screen.getByRole("button", { name: "Save email preferences" }));

    await waitFor(() => expect(updateEmailPreferences).toHaveBeenCalledWith("token-abc", {
      dailyQuestion: false, announcements: false, reengagement: false, campusReminders: false,
    }));
    vi.unstubAllEnvs();
  });

  it("hides the college toggle from an account that is in no college, even with campus on", async () => {
    vi.stubEnv("NEXT_PUBLIC_FEATURE_CAMPUS", "true");
    fetchMeCampus.mockResolvedValue({ student: null, staff: [] });

    render(<EmailPreferencesSection />);
    await screen.findByRole("checkbox", { name: /question of the day/i });
    await waitFor(() => expect(fetchMeCampus).toHaveBeenCalled());

    expect(screen.queryByRole("checkbox", { name: /college reminders/i })).not.toBeInTheDocument();
    vi.unstubAllEnvs();
  });
});
