"use client";

import type { BillingOverview, CreditPackView } from "@untiered/shared";
import { useEffect, useState } from "react";

import { announceCreditsChanged } from "@/components/credit-balance";
import { Button } from "@/components/ui/button";
import { ApiRequestError, confirmCreditOrder, createCreditOrder, fetchBilling } from "@/lib/api";
import { CheckoutDismissed, formatRupees, payWithRazorpay } from "@/lib/razorpay-checkout";
import { useAccessToken } from "@/lib/use-access-token";
import { formatCreditNumber } from "@/lib/credits";

type Status = { tone: "positive" | "negative"; text: string } | null;

/** "1 credit" or "5 credits", from the count rather than the server's display name, so the card always says credits. */
function creditCount(credits: number): string {
  return credits === 1 ? "1 credit" : `${formatCreditNumber(credits)} credits`;
}

/**
 * The interview packs, each bought in one step through Razorpay Checkout.
 *
 * The page names a pack and nothing else: the server prices the order, checks the
 * payment, and grants the interviews. What the candidate sees here is only ever what the
 * server says they now hold.
 */
export function CreditPacks({
  onPurchased,
  compact = false,
  initialOverview = null,
}: {
  /** Called with the new balance once the server has granted the interviews. */
  onPurchased?: (overview: BillingOverview) => void;
  /** A tighter layout for use inside a notice. */
  compact?: boolean;
  /** Already read by the page, so it is not fetched a second time. */
  initialOverview?: BillingOverview | null;
}) {
  const accessToken = useAccessToken();
  const [overview, setOverview] = useState<BillingOverview | null>(initialOverview);
  const [failed, setFailed] = useState(false);
  const [buying, setBuying] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>(null);

  useEffect(() => {
    if (!accessToken || initialOverview) return;
    let active = true;
    fetchBilling({ accessToken })
      .then((value) => {
        if (active) setOverview(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [accessToken, initialOverview]);

  async function buy(pack: CreditPackView) {
    if (!accessToken || buying) return;
    setBuying(pack.id);
    setStatus(null);
    let orderId: string | null = null;
    try {
      const order = await createCreditOrder(accessToken, pack.id);
      orderId = order.orderId;
      const payment = await payWithRazorpay(order);
      const updated = await confirmCreditOrder(accessToken, order.orderId, payment);
      setOverview(updated);
      announceCreditsChanged();
      setStatus({
        tone: "positive",
        text: `Payment received. ${creditCount(pack.credits)} ${pack.credits === 1 ? "has" : "have"} been added — you now have ${creditCount(updated.creditBalance)}.`,
      });
      onPurchased?.(updated);
    } catch (error) {
      if (error instanceof CheckoutDismissed) {
        setStatus(null);
      } else if (error instanceof ApiRequestError) {
        setStatus({ tone: "negative", text: error.message });
      } else {
        setStatus({
          tone: "negative",
          text:
            orderId === null
              ? "Payments could not be reached just now. Nothing was charged — try again."
              : "Something went wrong while paying. If money left your account, your interviews will be added or the amount refunded automatically.",
        });
      }
    } finally {
      setBuying(null);
    }
  }

  if (failed) {
    return <p className="text-caption text-ink-muted">The interview packs could not be loaded. Refresh to try again.</p>;
  }
  if (!overview) {
    return <p className="text-caption text-ink-subtle" aria-live="polite">Loading interview packs…</p>;
  }
  // Until the server has Razorpay keys it still names the packs, so they are shown at
  // their real prices with nothing to press. The daily-limit notice never gets here.
  const closed = !overview.purchasable;

  return (
    <div className="flex flex-col gap-4">
      <ul className={`grid gap-3 ${compact ? "sm:grid-cols-3" : "md:grid-cols-3"}`} aria-label="Interview packs">
        {overview.packs.map((pack) => (
          <li
            key={pack.id}
            className={`flex flex-col gap-3 rounded-2xl border bg-surface-raised p-5 shadow-[var(--shadow-sm)] ${
              pack.savingsPercent > 0 ? "border-accent/40" : "border-line"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-heading text-ink">{creditCount(pack.credits)}</h3>
              {pack.savingsPercent > 0 ? (
                <span className="pill pill-positive w-fit">Save {pack.savingsPercent}%</span>
              ) : null}
            </div>
            <p className="text-title text-ink">{formatRupees(pack.pricePaise)}</p>
            <p className="text-caption text-ink-muted">
              {pack.credits === 1
                ? "1 credit = one 45 or 60-minute mock interview, or two 30-minute ones, each with its full report"
                : `${formatRupees(pack.perInterviewPaise)} per credit. Each credit is one 45 or 60-minute interview, or two 30-minute ones`}
            </p>
            <Button
              variant={pack.savingsPercent > 0 ? "primary" : "secondary"}
              className="mt-auto w-full"
              loading={buying === pack.id}
              disabled={closed || buying !== null}
              onClick={() => void buy(pack)}
              aria-label={`Buy ${creditCount(pack.credits)} for ${formatRupees(pack.pricePaise)}`}
            >
              Buy for {formatRupees(pack.pricePaise)}
            </Button>
          </li>
        ))}
      </ul>
      {closed ? (
        <p role="status" className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-caption font-medium text-ink">
          Buying is not open yet. These packs become available here as soon as payments are switched on.
        </p>
      ) : null}
      {status ? (
        <p
          role={status.tone === "negative" ? "alert" : "status"}
          className={`rounded-xl border px-4 py-3 text-caption font-medium text-ink ${
            status.tone === "negative" ? "border-danger/30 bg-danger-wash" : "border-positive/30 bg-positive-wash"
          }`}
        >
          {status.text}
        </p>
      ) : null}
      <p className="text-caption text-ink-subtle">
        Prices include all taxes. A credit — or half of one, for a 30-minute round — is used when an interview starts, and comes back automatically if the
        interview fails on our side. Credits do not expire. Payments are processed by Razorpay.
      </p>
    </div>
  );
}
