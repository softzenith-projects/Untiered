import { render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import AboutPage from "../about/page";
import RefundPolicyPage from "../refund-policy/page";
import TermsPage from "../terms/page";
import PricingPage from "./page";
import { useAccessToken } from "@/lib/use-access-token";

vi.mock("@/lib/use-access-token", () => ({ useAccessToken: vi.fn(() => null) }));

/**
 * The pages a payment provider reviews before it lets the site take money: prices that a
 * signed-out visitor can read, the refund terms on a page of their own, and who runs it.
 */
describe("payment review pages", () => {
  beforeEach(() => vi.mocked(useAccessToken).mockReturnValue(null));

  it("states every pack's price to a signed-out visitor, with taxes included", () => {
    render(<PricingPage />);

    const packs = screen.getByRole("list", { name: "Credit packs" });
    expect(within(packs).getByRole("heading", { name: "1 credit" })).toBeInTheDocument();
    expect(within(packs).getByText("₹199")).toBeInTheDocument();
    expect(within(packs).getByText("₹899")).toBeInTheDocument();
    expect(within(packs).getByText("₹1,499")).toBeInTheDocument();
    expect(screen.getByText(/include all taxes/i)).toBeInTheDocument();
    expect(screen.getAllByText(/your first 3 mock interviews are on us\. forever\./i).length).toBeGreaterThan(0);
    expect(screen.getByRole("link", { name: "Sign in to buy credits" })).toHaveAttribute("href", "/login?next=%2Fupgrade");
  });

  it("gives refunds a page of their own with the same terms as the terms of use", () => {
    render(<RefundPolicyPage />);
    expect(screen.getByRole("heading", { level: 1, name: "Cancellation and refund policy" })).toBeInTheDocument();
    expect(screen.getByText(/no subscription, so there is nothing to\s+cancel/i)).toBeInTheDocument();
    const refundLine = screen.getByText(/within 7\s+days of paying/i).textContent;

    render(<TermsPage />);
    expect(screen.getAllByText(/within 7\s+days of paying/i).map((node) => node.textContent)).toContain(refundLine);
  });

  it("names the company that operates the product", () => {
    render(<AboutPage />);
    expect(screen.getAllByText(/Softzenith Softwares Private Limited/).length).toBeGreaterThan(0);
  });

  it("links pricing, about and the refund policy from the footer", () => {
    render(<PricingPage />);
    expect(screen.getByRole("link", { name: "Pricing" })).toHaveAttribute("href", "/pricing");
    expect(screen.getByRole("link", { name: "About us" })).toHaveAttribute("href", "/about");
    expect(screen.getByRole("link", { name: "Cancellation and refunds" })).toHaveAttribute("href", "/refund-policy");
  });
});
