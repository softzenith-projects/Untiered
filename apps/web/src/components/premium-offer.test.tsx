import type { BillingOverview } from "@untiered/shared";
import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { PremiumOffer } from "./premium-offer";
import { fetchBilling } from "@/lib/api";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => "token") }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchBilling: vi.fn(),
}));

const overview: BillingOverview = {
  purchasable: true,
  creditBalance: 2,
  currency: "INR",
  packs: [
    { id: "single", name: "1 interview", credits: 1, pricePaise: 19_900, perInterviewPaise: 19_900, savingsPercent: 0 },
    { id: "pack_5", name: "5 interviews", credits: 5, pricePaise: 89_900, perInterviewPaise: 17_980, savingsPercent: 10 },
  ],
};

describe("PremiumOffer", () => {
  beforeEach(() => {
    vi.mocked(fetchBilling).mockReset().mockResolvedValue(overview);
  });

  it("puts the packs and the current balance on the upgrade page", async () => {
    render(<PremiumOffer />);

    expect(await screen.findByRole("heading", { name: "Buy mock interviews" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy 5 interviews for ₹899" })).toBeEnabled();
    expect(screen.getByText(/paid\s+interviews/)).toHaveTextContent("You have 2 paid interviews");
    expect(screen.queryByText(/not for sale/i)).not.toBeInTheDocument();
  });

  it("still shows the packs, not a preview, before payments are switched on", async () => {
    vi.mocked(fetchBilling).mockResolvedValue({ ...overview, purchasable: false });
    render(<PremiumOffer />);

    expect(await screen.findByRole("button", { name: "Buy 1 interview for ₹199" })).toBeDisabled();
    expect(screen.queryByText(/untiered pro/i)).not.toBeInTheDocument();
  });

  it("says so when the packs cannot be loaded, and offers no checkout", async () => {
    vi.mocked(fetchBilling).mockRejectedValue(new Error("offline"));
    render(<PremiumOffer />);

    expect(await screen.findByRole("alert")).toHaveTextContent(/could not be loaded/i);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
