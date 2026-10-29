import type { BillingOverview, CheckoutOrder, EntitlementView } from "@untiered/shared";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { CreditPacks } from "./credit-packs";
import { DailyLimitNotice, isDailyLimitReached } from "./daily-limit-notice";
import { ApiRequestError, confirmCreditOrder, createCreditOrder, fetchBilling } from "@/lib/api";
import { CheckoutDismissed, payWithRazorpay } from "@/lib/razorpay-checkout";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => "token") }));
vi.mock("@/lib/api", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/api")>()),
  fetchBilling: vi.fn(),
  createCreditOrder: vi.fn(),
  confirmCreditOrder: vi.fn(),
}));
vi.mock("@/lib/razorpay-checkout", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/lib/razorpay-checkout")>()),
  payWithRazorpay: vi.fn(),
}));

const overview: BillingOverview = {
  purchasable: true,
  creditBalance: 0,
  currency: "INR",
  packs: [
    { id: "single", name: "1 interview", credits: 1, pricePaise: 19_900, perInterviewPaise: 19_900, savingsPercent: 0 },
    { id: "pack_5", name: "5 interviews", credits: 5, pricePaise: 89_900, perInterviewPaise: 17_980, savingsPercent: 10 },
    { id: "pack_10", name: "10 interviews", credits: 10, pricePaise: 149_900, perInterviewPaise: 14_990, savingsPercent: 25 },
  ],
};

const order: CheckoutOrder = {
  orderId: "order_1",
  keyId: "rzp_test_key",
  amountPaise: 19_900,
  currency: "INR",
  packId: "single",
  name: "1 interview",
  credits: 1,
  email: "candidate@example.com",
};

describe("CreditPacks", () => {
  beforeEach(() => {
    vi.mocked(fetchBilling).mockReset().mockResolvedValue(overview);
    vi.mocked(createCreditOrder).mockReset().mockResolvedValue(order);
    vi.mocked(payWithRazorpay)
      .mockReset()
      .mockResolvedValue({ razorpayPaymentId: "pay_1", razorpaySignature: "sig" });
    vi.mocked(confirmCreditOrder).mockReset().mockResolvedValue({ ...overview, creditBalance: 1 });
  });

  it("shows each pack at its rupee price with the saving", async () => {
    render(<CreditPacks />);

    expect(await screen.findByRole("button", { name: "Buy 1 interview for ₹199" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy 5 interviews for ₹899" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy 10 interviews for ₹1,499" })).toBeInTheDocument();
    expect(screen.getByText("Save 25%")).toBeInTheDocument();
    expect(screen.getByText(/₹149\.90 per interview/)).toBeInTheDocument();
  });

  it("names only the pack, pays in Checkout, and reports what the server granted", async () => {
    const user = userEvent.setup();
    const onPurchased = vi.fn();
    render(<CreditPacks onPurchased={onPurchased} />);

    await user.click(await screen.findByRole("button", { name: "Buy 1 interview for ₹199" }));

    expect(createCreditOrder).toHaveBeenCalledWith("token", "single");
    expect(payWithRazorpay).toHaveBeenCalledWith(order);
    expect(confirmCreditOrder).toHaveBeenCalledWith("token", "order_1", {
      razorpayPaymentId: "pay_1",
      razorpaySignature: "sig",
    });
    expect(await screen.findByRole("status")).toHaveTextContent("1 interview has been added — you now have 1.");
    expect(onPurchased).toHaveBeenCalledWith({ ...overview, creditBalance: 1 });
  });

  it("says nothing when Checkout is closed without paying", async () => {
    vi.mocked(payWithRazorpay).mockRejectedValue(new CheckoutDismissed());
    const user = userEvent.setup();
    render(<CreditPacks />);

    await user.click(await screen.findByRole("button", { name: "Buy 5 interviews for ₹899" }));

    expect(confirmCreditOrder).not.toHaveBeenCalled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Buy 5 interviews for ₹899" })).toBeEnabled();
  });

  it("shows the server's reason when a payment cannot be verified", async () => {
    vi.mocked(confirmCreditOrder).mockRejectedValue(
      new ApiRequestError(400, "payment_unverified", "We could not verify that payment."),
    );
    const user = userEvent.setup();
    render(<CreditPacks />);

    await user.click(await screen.findByRole("button", { name: "Buy 1 interview for ₹199" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("We could not verify that payment.");
  });

  it("offers nothing while the server cannot sell", async () => {
    vi.mocked(fetchBilling).mockResolvedValue({ ...overview, purchasable: false });
    const { container } = render(<CreditPacks />);

    await vi.waitFor(() => expect(container).toBeEmptyDOMElement());
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});

describe("DailyLimitNotice", () => {
  const usedUp: EntitlementView = {
    allowed: false,
    reason: "daily_rounds_reached",
    message: "You have used today's free practice (1 round or 60 minutes a day).",
    remainingFree: null,
    dailyRoundLimit: 1,
    dailyMinuteLimit: 60,
    remainingRoundsToday: 0,
    remainingMinutesToday: 30,
    creditBalance: 0,
    funding: null,
    purchasable: false,
  };

  beforeEach(() => {
    vi.mocked(fetchBilling).mockReset().mockResolvedValue(overview);
  });

  it("says Pro is coming where nothing can be bought", () => {
    render(<DailyLimitNotice entitlement={usedUp} />);

    expect(screen.getByText("Pro · coming soon")).toBeInTheDocument();
    expect(fetchBilling).not.toHaveBeenCalled();
  });

  it("puts the packs in front of the candidate where buying is open", async () => {
    render(<DailyLimitNotice entitlement={{ ...usedUp, purchasable: true }} />);

    expect(await screen.findByRole("button", { name: "Buy 1 interview for ₹199" })).toBeInTheDocument();
    expect(screen.queryByText("Pro · coming soon")).not.toBeInTheDocument();
  });

  it("covers a used-up lifetime free interview as well as the daily one", () => {
    expect(isDailyLimitReached({ ...usedUp, reason: "free_tier_exhausted" })).toBe(true);
    expect(isDailyLimitReached({ ...usedUp, allowed: true, reason: "allowed", funding: "credit" })).toBe(false);
  });
});
