import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { EmailPreferencesSection } from "./email-preferences-section";

const { fetchEmailPreferences, updateEmailPreferences } = vi.hoisted(() => ({
  fetchEmailPreferences: vi.fn(), updateEmailPreferences: vi.fn(),
}));

vi.mock("@/lib/api", () => ({ fetchEmailPreferences, updateEmailPreferences }));
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
  });
});
