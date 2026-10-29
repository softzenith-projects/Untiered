import type { Metadata, Route } from "next";
import Link from "next/link";

import { LegalPage, LegalSection } from "@/components/legal-page";
import { SessionLink } from "@/components/session-link";
import { CREDIT_PACKS, FREE_ROUNDS_LIFETIME_TEXT, LEGAL } from "@/lib/legal";
import { formatRupees } from "@/lib/razorpay-checkout";

export const metadata: Metadata = {
  title: "Pricing",
  description: `${LEGAL.productName} pricing: ${FREE_ROUNDS_LIFETIME_TEXT}, then interview credits from ${formatRupees(CREDIT_PACKS[0]!.pricePaise)}.`,
};

/**
 * The prices, readable without signing in. Buying itself happens on /upgrade, where the
 * server prices the order; this page only states what it will charge.
 */
export default function PricingPage() {
  const single = CREDIT_PACKS[0]!.pricePaise / CREDIT_PACKS[0]!.credits;

  return (
    <LegalPage
      eyebrow="Untiered · Pricing"
      title="Pricing"
      intro={`Start with ${FREE_ROUNDS_LIFETIME_TEXT}. After that, buy interview credits: one credit is one spoken mock interview with its full evidence-backed report.`}
      showUpdated={false}
    >
      <LegalSection id="free" title="Free">
        <p>
          Every account gets {FREE_ROUNDS_LIFETIME_TEXT}, each with the complete report, plus the
          courses and Arena practice. No card or payment details are needed to start.
        </p>
      </LegalSection>

      <LegalSection id="credits" title="Interview credits">
        <ul className="grid gap-3 sm:grid-cols-3" aria-label="Credit packs">
          {CREDIT_PACKS.map((pack) => {
            const perCredit = pack.pricePaise / pack.credits;
            const saving = Math.round((1 - perCredit / single) * 100);
            return (
              <li key={pack.credits} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-heading text-ink">{pack.credits === 1 ? "1 credit" : `${pack.credits} credits`}</h3>
                  {saving > 0 ? <span className="pill pill-positive w-fit">Save {saving}%</span> : null}
                </div>
                <p className="text-title text-ink">{formatRupees(pack.pricePaise)}</p>
                <p className="text-caption text-ink-muted">
                  {pack.credits === 1 ? "1 mock interview with its full report" : `${formatRupees(perCredit)} per credit`}
                </p>
              </li>
            );
          })}
        </ul>
        <ul className="list-disc space-y-2 pl-5">
          <li>Prices are in Indian rupees and include all taxes.</li>
          <li>Each purchase is a one-off payment. There is no subscription and nothing renews.</li>
          <li>Your free interviews are always used first. A credit is used when an interview starts, and is returned automatically if the interview fails because of a fault on our side.</li>
          <li>Credits do not expire while your account exists.</li>
          <li>Payments are processed securely by Razorpay: UPI, cards and net banking.</li>
        </ul>
        <SessionLink
          signedIn={{ href: "/upgrade" as Route, label: "Buy credits" }}
          signedOut={{ href: "/login?next=%2Fupgrade" as Route, label: "Sign in to buy credits" }}
          className="action-primary mt-2 self-start"
        />
      </LegalSection>

      <LegalSection id="refunds" title="Refunds">
        <p>
          Unused packs can be refunded within {LEGAL.refundWindowDays} days of paying. See the{" "}
          <Link href={"/refund-policy" as Route} className="font-medium text-accent hover:underline">
            cancellation and refund policy
          </Link>{" "}
          for the details.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
