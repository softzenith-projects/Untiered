import type { Metadata } from "next";
import Link from "next/link";

import { AppShell } from "@/components/app-shell";
import { ROUND_CATALOGUE } from "@/lib/rounds";
import { requireFeature } from "@/lib/require-feature";

export const metadata: Metadata = {
  title: "The rounds we run",
  description:
    "Every round this runs, and who each one is for: Infosys techno-managerial panels, " +
    "Big Four case rounds, European competency interviews, global product system design, " +
    "and the HR conversation about notice, relocation and visa that nobody rehearses.",
};

/**
 * The catalogue.
 *
 * Server-rendered on purpose: organic search on "<employer> interview" and
 * "<round type> interview" is a primary acquisition channel (PRD 11), and this page is
 * the one that names them.
 *
 * Set as an editorial list rather than a grid of identical cards. Each entry earns its
 * place by being specific — a real employer, a real round name, and what an interviewer
 * is actually listening for — because a candidate deciding whether to trust this with
 * their preparation reads the specifics and skips the adjectives.
 */
export default function RoundsPage() {
  requireFeature("mockInterviews");
  return (
    <AppShell breadcrumb="rounds">
      <div className="flex flex-col gap-12">
        <header className="-mx-6 flex flex-col gap-5 rounded-2xl border border-accent/20 bg-accent-wash px-6 py-10 shadow-[var(--shadow-sm)] sm:mx-0 sm:px-10">
          <p className="w-fit rounded-full bg-surface-raised px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase shadow-[var(--shadow-sm)]">
            All rounds · {ROUND_CATALOGUE.length}
          </p>
          <h1 className="max-w-3xl text-display text-balance text-ink">The rounds.</h1>
          <p className="max-w-2xl text-body leading-relaxed text-ink-muted">
            {ROUND_CATALOGUE.length} rounds, each with its own structure and its own rubric. An Infosys
            techno-managerial panel is not a Google system design round, and preparing for one
            does not prepare you for the other.
          </p>
        </header>

        <ul className="grid auto-rows-fr gap-5 md:grid-cols-2">
          {ROUND_CATALOGUE.map((round) => (
            <li key={round.value} className="h-full">
              <Link
                href={`/interview/new?round=${encodeURIComponent(round.value)}&from=rounds`}
                aria-label={`Practise the ${round.label} round`}
                className="group flex h-full flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent/35 hover:shadow-[var(--shadow-md)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                <p className="w-fit rounded-full bg-surface-sunken px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">
                  {round.eyebrow}
                </p>
                <h2 className="text-heading text-ink">{round.label}</h2>
                <p className="grow text-body leading-relaxed text-ink-muted">{round.blurb}</p>
                <p className="rounded-xl border border-positive/20 bg-positive/10 p-4 text-caption leading-relaxed text-ink-muted">
                  <span className="text-ink">What the interviewer is listening for:</span>{" "}
                  {round.listeningFor}
                </p>
                <p className="font-mono text-caption text-ink-subtle md:min-h-10">{round.whoRunsIt}</p>
                <span className="pt-1 text-body font-medium text-accent-strong transition-transform group-hover:translate-x-1">
                  Practise this round →
                </span>
              </Link>
            </li>
          ))}
        </ul>

        <section className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <h2 className="text-heading text-ink">Not sure which one you are sitting?</h2>
          <p className="max-w-xl text-body text-ink-muted">
            Describe the interview in one line — the employer, when it is, what you are worried
            about — and the round gets set up from that. You correct it before anything starts.
          </p>
          <Link
            href="/interview/new"
            className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
          >
            Set up a round
          </Link>
        </section>
      </div>
    </AppShell>
  );
}
