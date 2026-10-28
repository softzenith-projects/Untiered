"use client";

import type { BillingOverview } from "@untiered/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CreditPacks } from "@/components/credit-packs";
import { fetchBilling } from "@/lib/api";
import { PRO_FEATURES } from "@/lib/pro-features";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The paid side of the upgrade page: the interview packs and what the candidate already
 * holds, once buying is open. Until the server has Razorpay keys it is the preview it
 * always was — no price or checkout is shown for something that cannot be bought.
 */
export function PremiumOffer() {
  const accessToken = useAccessToken();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchBilling({ accessToken })
      .then((value) => {
        if (active) setOverview(value);
      })
      .catch(() => {
        // Shown as the preview: a page that cannot reach billing must not offer a checkout.
      })
      .finally(() => {
        if (active) setSettled(true);
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (!settled) {
    return <section aria-busy="true" className="card min-h-64 animate-pulse p-6 sm:p-8" aria-label="Loading Premium" />;
  }

  if (overview?.purchasable) {
    return (
      <section
        aria-labelledby="premium-packs"
        className="relative overflow-hidden rounded-surface border border-accent/25 bg-accent-wash p-6 shadow-[var(--shadow-md)] sm:p-8 lg:order-first lg:col-span-2"
      >
        <div aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full bg-accent/15 blur-3xl" />
        <div className="relative flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="pill pill-accent w-fit">Premium</p>
              <h2 id="premium-packs" className="mt-4 text-title text-ink">
                Buy mock interviews
              </h2>
              <p className="mt-2 max-w-2xl text-body text-ink-muted">
                Each one is a full spoken round with its complete report. Your free practice is always used
                first, so a paid interview is only spent when you practise beyond it.
              </p>
            </div>
            <p className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-caption text-ink">
              You have <strong className="text-heading">{overview.creditBalance}</strong> paid{" "}
              {overview.creditBalance === 1 ? "interview" : "interviews"}
            </p>
          </div>
          <CreditPacks initialOverview={overview} onPurchased={setOverview} />
          {overview.creditBalance > 0 ? (
            <Link href="/interview/new" className="action-primary self-start">
              Start an interview <span aria-hidden>→</span>
            </Link>
          ) : null}
        </div>
      </section>
    );
  }

  return (
    <section
      aria-labelledby="pro-preview"
      className="relative overflow-hidden rounded-surface border border-accent/25 bg-accent-wash p-6 shadow-[var(--shadow-md)] sm:p-8"
    >
      <div aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full bg-accent/15 blur-3xl" />
      <div className="relative flex h-full flex-col">
        <p className="pill pill-accent w-fit">Preview · not for sale yet</p>
        <h2 id="pro-preview" className="mt-5 text-title text-ink">
          Untiered Pro
        </h2>
        <p className="mt-2 text-body text-ink-muted">
          These are product directions, not promised features. Pricing will only appear after the plan and
          payment experience are ready for owner review.
        </p>
        <ul className="mt-6 grid gap-3">
          {PRO_FEATURES.map(({ key, label }) => (
            <li key={key} className="flex gap-3 text-caption text-ink-muted">
              <span aria-hidden className="font-bold text-accent">
                +
              </span>
              {label}
            </li>
          ))}
        </ul>
        <Link href="#pro-request" className="action-primary mt-8 self-start">
          Tell us what Pro should include <span aria-hidden>→</span>
        </Link>
      </div>
    </section>
  );
}
