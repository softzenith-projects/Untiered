import type { Metadata, Route } from "next";
import Link from "next/link";

import { BrandWordmark } from "@/components/brand-logo";
import { SessionLink } from "@/components/session-link";
import { CollegeLeadForm } from "@/components/campus/college-lead-form";
import { SiteFooter } from "@/components/site-footer";
import { buttonStyles } from "@/components/ui/button";
import { CAMPUS_CONTACT_HREF, CAMPUS_PRODUCT_NAME, CAMPUS_REGISTER_ANCHOR } from "@/lib/campus";
import { campusEnabled, campusLeadsEnabled, featureEnabled } from "@/lib/flags";
import { LEGAL } from "@/lib/legal";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  title: "Untiered for Colleges · Placement Interview Prep",
  description:
    "Untiered Campus for placement cells: spoken AI mock interviews for every student, for the employers that visit your campus. Register your college for a pilot.",
  path: "/colleges",
});

/**
 * The college partnership's public page (docs/campus-v1-spec.md).
 *
 * Two lists, kept apart on purpose: what a student can use today, which is true now, and
 * what is being built for placement cells, labelled as in development. A college reading
 * this must not come away believing a batch dashboard exists before it does (CLAUDE.md:
 * a claim must be true or it does not appear).
 */
export default function CollegesPage() {
  const mockInterviewsEnabled = featureEnabled("mockInterviews");
  const coursesEnabled = featureEnabled("courses");
  // With self-registration switched off, the page falls back to writing to us.
  const leadsEnabled = campusLeadsEnabled();

  const today = [
    mockInterviewsEnabled
      ? {
          title: "Spoken mock interviews",
          detail:
            "An AI interviewer that asks follow-ups, for service IT, Big Four and product companies. In English or Hindi-English.",
        }
      : null,
    mockInterviewsEnabled
      ? {
          title: "Reports with evidence",
          detail: "Every score points to what the student actually said, and what to work on next.",
        }
      : null,
    coursesEnabled
      ? {
          title: "Free courses and the Arena",
          detail: "Short chapters with runnable code, and daily practice rounds drawn from them.",
        }
      : null,
  ].filter((item): item is { title: string; detail: string } => item !== null);

  const building = [
    { title: "Batches and invites", detail: "Import a batch from a spreadsheet; each student gets an invite to join." },
    { title: "Assigned practice", detail: "Assign interviews to a batch or to chosen students, with deadlines and a cap per student." },
    { title: "Readiness view", detail: "See completion, scores and skill gaps by batch and department." },
    { title: "Integrity signals", detail: "Tab switches and pasted answers are flagged on the report. They never fail a student by themselves." },
  ];

  return (
    <div className="flex min-h-dvh flex-col bg-surface">
      <header className="border-b border-line bg-surface-raised">
        <div className="mx-auto flex layout-content items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <Link href="/" className="inline-flex min-h-11 items-center focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="Untiered home">
            <BrandWordmark />
          </Link>
          <SessionLink
            signedIn={{ href: "/dashboard", label: "Dashboard" }}
            signedOut={{ href: "/login", label: "Sign in" }}
            className="rounded-lg px-3 py-2 text-caption font-semibold text-accent transition-colors hover:bg-accent-wash focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          />
        </div>
      </header>

      <main className="flex-1">
        <section className="relative overflow-hidden bg-navy text-on-navy">
          <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
          <div className="relative mx-auto flex layout-content flex-col gap-6 px-4 py-14 sm:px-6 lg:py-20">
            <span className="pill pill-navy w-fit">{CAMPUS_PRODUCT_NAME} · For colleges</span>
            <h1 className="max-w-3xl text-hero text-balance text-on-navy">
              Every student in the batch deserves a <span className="text-accent-on-navy">practice interview.</span>
            </h1>
            <p className="max-w-2xl text-body text-on-navy-muted">
              A placement cell can&rsquo;t sit a mock interview with every student. Krivih, our AI interviewer, can. We&rsquo;re
              building {CAMPUS_PRODUCT_NAME} with our first partner colleges, so placement cells can assign practice and see who is
              ready before the drive.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-1">
              {leadsEnabled ? (
                <a href={`#${CAMPUS_REGISTER_ANCHOR}`} className={buttonStyles({ size: "lg" })}>
                  Register your college
                </a>
              ) : (
                <a href={CAMPUS_CONTACT_HREF} className={buttonStyles({ size: "lg" })}>
                  Talk to us about a pilot
                </a>
              )}
              {mockInterviewsEnabled ? (
                <Link href="/interview/new" className={buttonStyles({ variant: "onDark", size: "lg" })}>
                  Try an interview yourself
                </Link>
              ) : null}
            </div>
            {campusEnabled() ? (
              <Link
                href={"/login?next=/campus" as Route}
                className="w-fit text-caption font-semibold text-accent-on-navy underline focus-visible:rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-on-navy"
              >
                College staff? Sign in to your portal
              </Link>
            ) : null}
          </div>
        </section>

        <div className="mx-auto flex layout-content flex-col gap-14 px-4 py-14 sm:px-6 lg:py-20">
          {today.length > 0 ? (
            <section aria-labelledby="today-heading" className="flex flex-col gap-6">
              <div className="flex flex-col gap-2">
                <span className="pill pill-positive w-fit">Available now</span>
                <h2 id="today-heading" className="text-display text-balance text-ink">What your students can use today</h2>
              </div>
              <ul className="grid gap-5 md:grid-cols-3">
                {today.map((item) => (
                  <li key={item.title} className="card flex flex-col gap-2 p-6">
                    <h3 className="text-heading font-bold text-ink">{item.title}</h3>
                    <p className="text-caption text-ink-muted">{item.detail}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section aria-labelledby="building-heading" className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="pill pill-highlight w-fit">In development</span>
              <h2 id="building-heading" className="text-display text-balance text-ink">What we&rsquo;re building for placement cells</h2>
              <p className="max-w-2xl text-body text-ink-muted">
                Built with our first partner colleges. Tell us what your placement cell needs and it shapes what we build first.
              </p>
            </div>
            <ul className="grid gap-5 sm:grid-cols-2">
              {building.map((item) => (
                <li key={item.title} className="card flex flex-col gap-2 p-6">
                  <h3 className="text-heading font-bold text-ink">{item.title}</h3>
                  <p className="text-caption text-ink-muted">{item.detail}</p>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="students-heading" className="flex flex-col gap-3 rounded-2xl border border-line bg-surface-raised p-6 sm:p-8">
            <h2 id="students-heading" className="text-title text-ink">Students stay in control of their data</h2>
            <p className="max-w-3xl text-body text-ink-muted">
              A student joins their college&rsquo;s space themselves, and is shown what the college will see before anything is shared.
              The camera is never recorded. See our{" "}
              <Link href={"/privacy" as Route} className="font-medium text-accent hover:underline">
                privacy policy
              </Link>
              .
            </p>
          </section>

          {leadsEnabled ? (
            <section
              id={CAMPUS_REGISTER_ANCHOR}
              aria-labelledby="register-heading"
              className="grid scroll-mt-6 gap-8 rounded-2xl border border-line bg-surface-raised p-6 sm:p-10 lg:grid-cols-[0.8fr_1.2fr]"
            >
              <div className="flex flex-col gap-3">
                <span className="pill pill-highlight w-fit">Start with one batch</span>
                <h2 id="register-heading" className="text-display text-balance text-ink">
                  Register your college
                </h2>
                <p className="text-body text-ink-muted">
                  Tell us who you are and where your college is. Someone from our team will write back to set up a call. Registering
                  creates no account and shares nothing with your students.
                </p>
                <p className="text-caption text-ink-subtle">
                  Prefer email? Write to{" "}
                  <a href={CAMPUS_CONTACT_HREF} className="font-medium text-accent hover:underline">
                    {LEGAL.contactEmail}
                  </a>
                  .
                </p>
              </div>
              <CollegeLeadForm />
            </section>
          ) : (
            <section aria-labelledby="pilot-heading" className="flex flex-col items-start gap-4 rounded-2xl bg-navy p-6 text-on-navy sm:p-10">
              <h2 id="pilot-heading" className="text-display text-balance text-on-navy">Start with one batch</h2>
              <p className="max-w-2xl text-body text-on-navy-muted">
                Write to {LEGAL.contactEmail} with your college, the batches you&rsquo;d like to start with, and roughly how many students.
                We&rsquo;ll set up a call.
              </p>
              <a href={CAMPUS_CONTACT_HREF} className={buttonStyles({ size: "lg" })}>
                Talk to us about a pilot
              </a>
            </section>
          )}
        </div>
      </main>

      <SiteFooter />
    </div>
  );
}
