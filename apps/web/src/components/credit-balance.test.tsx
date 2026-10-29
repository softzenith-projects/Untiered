import type { EntitlementView } from "@untiered/shared";
import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CreditBalance, interviewsLeft } from "./credit-balance";

const fetchEntitlement = vi.hoisted(() => vi.fn());
vi.mock("@/lib/api", () => ({ fetchEntitlement }));
vi.mock("@/lib/use-access-token", () => ({ useAccessToken: () => "token" }));
vi.mock("next/navigation", () => ({ usePathname: () => "/dashboard" }));

function entitlement(overrides: Partial<EntitlementView>): EntitlementView {
  return {
    allowed: true,
    reason: "allowed",
    message: "",
    remainingFree: 3,
    dailyRoundLimit: null,
    dailyMinuteLimit: null,
    remainingRoundsToday: null,
    remainingMinutesToday: null,
    creditBalance: 0,
    funding: "free",
    purchasable: true,
    ...overrides,
  };
}

describe("interviewsLeft", () => {
  it("counts free interviews and bought credits as one balance", () => {
    expect(interviewsLeft(entitlement({ remainingFree: 2, creditBalance: 5 }))).toBe(7);
  });

  it("treats no free limit as nothing free to add", () => {
    expect(interviewsLeft(entitlement({ remainingFree: null, creditBalance: 4 }))).toBe(4);
  });
});

describe("CreditBalance", () => {
  it("shows the balance beside a link to buy more", async () => {
    fetchEntitlement.mockResolvedValue(entitlement({ remainingFree: 3, creditBalance: 0 }));
    render(<CreditBalance />);

    expect(await screen.findByText("3")).toBeInTheDocument();
    expect(screen.getByText("credits")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Buy credits" })).toHaveAttribute("href", "/upgrade");
  });

  it("keeps the buy link when the balance cannot be read", () => {
    fetchEntitlement.mockReturnValue(new Promise(() => {}));
    render(<CreditBalance />);

    expect(screen.getByRole("link", { name: "Buy credits" })).toBeInTheDocument();
  });
});
