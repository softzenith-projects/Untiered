import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { QuestionBankIndex } from "@/components/question-bank-index";
import { featureEnabled, questionBankBrowsable } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Questions employers have asked",
  // Signed-in only, and not for search engines: whether extracted third-party text goes
  // on public pages is a decision for the owner, not a default (PRD 16).
  robots: { index: false, follow: false },
};

/**
 * The question bank's index (PRD 04, 08).
 *
 * Every entry is a question a document we fetched says an employer asked, and every
 * company here has at least one. Where they come from is stated before the list, because
 * a candidate should know what a tag means before trusting one.
 *
 * Not found unless the bank is browsable (task 042; off by default).
 */
export default function QuestionsPage() {
  if (!questionBankBrowsable()) notFound();

  return (
    <AppShell breadcrumb="questions">
      <div className="flex flex-col gap-8">
        <header className="hero-band relative overflow-hidden p-7 text-on-navy sm:p-9">
          <div aria-hidden="true" className="absolute -top-24 -right-16 size-64 rounded-full bg-accent/20 blur-3xl" />
          <div className="relative flex flex-col gap-4">
          <span className="pill pill-navy w-fit">Sourced question bank</span>
          <h1 className="text-display text-balance text-on-navy">Questions employers have asked.</h1>
          <p className="max-w-2xl text-body text-on-navy-muted">
            Each one is here because a document says it was asked — the employer’s own careers
            pages, openly licensed collections, or someone’s own published account of their loop —
            and each links to where it was read. A question reported at Amazon and at Microsoft
            carries both.
          </p>
          <p className="max-w-2xl text-caption text-on-navy-muted">
            Nothing here was written by a model, and nothing was scraped from forums. Looking for how
            a round runs rather than what it asks?
            {featureEnabled("mockInterviews") ? (
              <> <Link href="/rounds" className="text-on-navy underline underline-offset-4">The rounds</Link>.</>
            ) : null}
          </p>
          </div>
        </header>

        <QuestionBankIndex />
      </div>
    </AppShell>
  );
}
