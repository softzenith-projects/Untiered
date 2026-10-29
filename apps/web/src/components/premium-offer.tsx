"use client";

import type { BillingOverview } from "@untiered/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CreditPacks } from "@/components/credit-packs";
import { fetchBilling, fetchEntitlement } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The paid side of the upgrade page: the interview packs and what the candidate already
 * holds. The packs and their prices come from the server; whether they can be bought
 * right now is the server's call too (`CreditPacks`).
 */
export function PremiumOffer() {
  const accessToken = useAccessToken();
  const [overview, setOverview] = useState<BillingOverview | null>(null);
  const [failed, setFailed] = useState(false);
  // The free interviews left, so the balance here is the same number as the header's.
  const [remainingFree, setRemainingFree] = useState<number | null>(null);

  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    fetchBilling({ accessToken })
      .then((value) => {
        if (active) setOverview(value);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    fetchEntitlement({ accessToken })
      .then((value) => {
        if (active) setRemainingFree(value.remainingFree);
      })
      .catch(() => {
        // Without it the page still shows the credits bought, labelled as such.
      });
    return () => {
      active = false;
    };
  }, [accessToken]);

  if (failed) {
    return (
      <section aria-labelledby="premium-packs" className="card p-6 sm:p-8 lg:order-first lg:col-span-2">
        <h2 id="premium-packs" className="text-title text-ink">Buy interview credits</h2>
        <p role="alert" className="mt-2 text-body text-ink-muted">
          The interview packs could not be loaded. Refresh to try again.
        </p>
      </section>
    );
  }

  if (!overview) {
    return (
      <section aria-busy="true" className="card min-h-64 animate-pulse p-6 sm:p-8 lg:order-first lg:col-span-2" aria-label="Loading interview packs" />
    );
  }

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
              Buy interview credits
            </h2>
            <p className="mt-2 max-w-2xl text-body text-ink-muted">
              Each credit is one full spoken interview with its complete report. Your free interviews are always
              used first, so a credit is only spent when you practise beyond them.
            </p>
          </div>
          <Balance bought={overview.creditBalance} free={remainingFree} />
        </div>
        <CreditPacks initialOverview={overview} onPurchased={setOverview} />
        {overview.creditBalance + (remainingFree ?? 0) > 0 ? (
          <Link href="/interview/new" className="action-primary self-start">
            Start an interview <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The same total the header shows — free interviews left plus credits bought — with the
 * split underneath, since the free ones are spent first.
 */
function Balance({ bought, free }: { bought: number; free: number | null }) {
  if (free === null) {
    return (
      <p className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-caption text-ink">
        You have <strong className="text-heading">{bought}</strong> bought {bought === 1 ? "credit" : "credits"}
      </p>
    );
  }
  const total = free + bought;
  return (
    <div className="rounded-xl border border-line bg-surface-raised px-4 py-3 text-caption text-ink">
      <p>
        You have <strong className="text-heading">{total}</strong> {total === 1 ? "credit" : "credits"}
      </p>
      <p className="mt-0.5 text-micro text-ink-subtle">
        {free} free · {bought} bought
      </p>
    </div>
  );
}
