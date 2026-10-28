import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ProFeatureRequestForm } from "@/components/pro-feature-request-form";
import { DAILY_ROUNDS_TEXT, LEGAL } from "@/lib/legal";
import { PRO_FEATURES } from "@/lib/pro-features";

export const metadata: Metadata = { title: "Upgrade" };

const INCLUDED_NOW = [
  `${DAILY_ROUNDS_TEXT} of mock interview a day, up to ${LEGAL.dailyMinutes} minutes`,
  "The complete evidence-backed report",
  "All enabled courses and Arena practice",
  "English and Hindi-English interviews",
];


/**
 * A deliberately honest upgrade surface. Payments and pricing are not live product
 * decisions yet, so the screen makes the future plan discoverable without presenting a
 * checkout, price, limit or entitlement that does not exist.
 */
export default function UpgradePage() {
  return (
    <AppShell breadcrumb="upgrade">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        <header className="hero-band overflow-hidden px-7 py-10 sm:px-10 sm:py-12">
          <p className="eyebrow text-accent-on-navy">Untiered Pro</p>
          <h1 className="mt-3 max-w-3xl text-display text-balance text-on-navy">
            More support is coming. Your practice stays free.
          </h1>
          <p className="mt-3 max-w-2xl text-body text-on-navy-muted">
            There is no paid plan or checkout today. This preview shows what you already
            have and the directions being considered for Pro, without taking away the full
            interview report that makes practice useful.
          </p>
        </header>

        <div className="grid gap-6 lg:grid-cols-2">
          <section aria-labelledby="current-access" className="card flex flex-col p-6 sm:p-8">
            <p className="pill pill-positive w-fit">Your current plan</p>
            <h2 id="current-access" className="mt-5 text-title text-ink">Free access</h2>
            <p className="mt-2 text-body text-ink-muted">
              The core product is open while Untiered proves what helps candidates improve.
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

          <section aria-labelledby="pro-preview" className="relative overflow-hidden rounded-surface border border-accent/25 bg-accent-wash p-6 shadow-[var(--shadow-md)] sm:p-8">
            <div aria-hidden className="absolute -top-20 -right-16 size-56 rounded-full bg-accent/15 blur-3xl" />
            <div className="relative flex h-full flex-col">
              <p className="pill pill-accent w-fit">Preview · not for sale yet</p>
              <h2 id="pro-preview" className="mt-5 text-title text-ink">Untiered Pro</h2>
              <p className="mt-2 text-body text-ink-muted">
                These are product directions, not promised features. Pricing will only appear
                after the plan and payment experience are ready for owner review.
              </p>
              <ul className="mt-6 grid gap-3">
                {PRO_FEATURES.map(({ key, label }) => (
                  <li key={key} className="flex gap-3 text-caption text-ink-muted">
                    <span aria-hidden className="font-bold text-accent">+</span>
                    {label}
                  </li>
                ))}
              </ul>
              <Link href="#pro-request" className="action-primary mt-8 self-start">
                Tell us what Pro should include <span aria-hidden>→</span>
              </Link>
            </div>
          </section>
        </div>

        <ProFeatureRequestForm />

        <p className="rounded-xl border border-line bg-surface-raised px-5 py-4 text-caption text-ink-muted">
          No payment details are collected on this page. When plans become real, the price,
          renewal terms and exact limits will be shown before any purchase.
        </p>
      </div>
    </AppShell>
  );
}
