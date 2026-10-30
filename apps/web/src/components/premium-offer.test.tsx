import type { BillingOverview, EntitlementView } from "@untiered/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PremiumOffer } from "./premium-offer";
import { fetchBilling, fetchEntitlement } from "@/lib/api";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => "token") }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchBilling: vi.fn(),
  fetchEntitlement: vi.fn(),
}));

const overview: BillingOverview = {
  purchasable: true,
  creditBalance: 2,
  currency: "INR",
  packs: [
    { id: "single", name: "1 credit", credits: 1, pricePaise: 19_900, perInterviewPaise: 19_900, savingsPercent: 0 },
    { id: "pack_5", name: "5 credits", credits: 5, pricePaise: 89_900, perInterviewPaise: 17_980, savingsPercent: 10 },
  ],
};

describe("PremiumOffer", () => {
  beforeEach(() => {
    vi.mocked(fetchBilling).mockReset().mockResolvedValue(overview);
    vi.mocked(fetchEntitlement).mockReset().mockRejectedValue(new Error("offline"));
  });

  it("puts the packs and the current balance on the upgrade page", async () => {
    render(<PremiumOffer />);

    expect(await screen.findByRole("heading", { name: "Buy interview credits" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy 5 credits for ₹899" })).toBeEnabled();
    expect(screen.getByText(/You have/)).toHaveTextContent("You have 2 bought credits");
    expect(screen.queryByText(/not for sale/i)).not.toBeInTheDocument();
  });

  it("counts free interviews into the balance, the same number as the header", async () => {
    vi.mocked(fetchEntitlement).mockResolvedValue({ remainingFree: 3 } as EntitlementView);
    render(<PremiumOffer />);

    expect(await screen.findByText(/You have/)).toHaveTextContent("You have 5 credits");
    expect(screen.getByText("3 free · 2 bought")).toBeInTheDocument();
  });

  it("still shows the packs, not a preview, before payments are switched on", async () => {
    vi.mocked(fetchBilling).mockResolvedValue({ ...overview, purchasable: false });
    render(<PremiumOffer />);

    expect(await screen.findByRole("button", { name: "Buy 1 credit for ₹199" })).toBeDisabled();
    expect(screen.queryByText(/untiered pro/i)).not.toBeInTheDocument();
  });

  it("says so when the packs cannot be loaded, and offers no checkout", async () => {
    vi.mocked(fetchBilling).mockRejectedValue(new Error("offline"));
    render(<PremiumOffer />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
