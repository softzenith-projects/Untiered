import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { PremiumOffer } from "@/components/premium-offer";
import { FREE_ROUNDS_LIFETIME_TEXT } from "@/lib/legal";

export const metadata: Metadata = { title: "Upgrade" };

const INCLUDED_NOW = [
  `${FREE_ROUNDS_LIFETIME_TEXT}, up to 60 minutes each`,
  "The complete evidence-backed report",
  "All enabled courses and Arena practice",
  "English and Hindi-English interviews",
];


/**
 * The interview packs (`PremiumOffer`) beside what the free tier already includes. The
 * packs, prices and whether they can be bought all come from the server.
 */
export default function UpgradePage() {
  return (
    <AppShell breadcrumb="upgrade">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="hero-band overflow-hidden px-7 py-10 sm:px-10 sm:py-12">
          <p className="eyebrow text-accent-on-navy">Untiered Premium</p>
          <h1 className="mt-3 max-w-3xl text-display text-balance text-on-navy">
            Your free practice stays free.
          </h1>
          <p className="mt-3 max-w-2xl text-body text-on-navy-muted">
            Every interview, free or paid, comes with the full evidence-backed report. Paid
            interviews are for practising once your account has used its {FREE_ROUNDS_LIFETIME_TEXT}.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="current-access" className="card flex flex-col p-6 sm:p-8">
            <p className="pill pill-positive w-fit">Your current plan</p>
            <h2 id="current-access" className="mt-5 text-title text-ink">Free access</h2>
            <p className="mt-2 text-body text-ink-muted">
              Enough to see what a real round and its report are like before you pay for any.
            </p>
            <ul className="mt-6 grid gap-3">
              {INCLUDED_NOW.map((item) => (
                <li key={item} className="flex gap-3 text-caption text-ink-muted">
                  <span aria-hidden className="font-bold text-positive">✓</span>
                  {item}
                </li>
              ))}
            </ul>
            <Link href="/interview/new" className="action-secondary mt-8 self-start">
              Start practising
            </Link>
          </section>

          <PremiumOffer />
        </div>

        <p className="rounded-xl border border-line bg-surface-raised px-5 py-4 text-caption text-ink-muted">
          No card or UPI details are entered on this page: payments are made in Razorpay&rsquo;s
          own checkout. Interview packs are one-off purchases with no renewal or subscription.
        </p>
      </div>
    </AppShell>
  );
}
