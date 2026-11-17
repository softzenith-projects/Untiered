import type { Route } from "next";
import Link from "next/link";

import { buttonStyles } from "@/components/ui/button";
import { CAMPUS_CONTACT_HREF, CAMPUS_PRODUCT_NAME, CAMPUS_REGISTER_ANCHOR } from "@/lib/campus";
import { campusLeadsEnabled } from "@/lib/flags";

/**
 * The landing page's way in for colleges. It describes the partnership as something being
 * built with the first partner colleges, because it is: nothing here claims a batch
 * dashboard or an assignment flow exists before it does.
 */
export function CollegesBand() {
  const points = [
    "Every student practises the rounds of the employers that visit your campus",
    "Assign interviews to a batch, with deadlines and a cap per student",
    "See which students are ready, and which need help, before the drive",
  ];
  return (
    <section aria-labelledby="colleges-heading" className="border-b border-line bg-surface-sunken">
      <div className="mx-auto grid layout-content gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-16 lg:py-20">
        <div className="flex flex-col gap-4">
          <span className="pill pill-highlight w-fit">For Colleges · {CAMPUS_PRODUCT_NAME}</span>
          <h2 id="colleges-heading" className="text-display text-balance text-ink">
            Placement prep for the whole batch, not just the top ten.
          </h2>
          <p className="max-w-xl text-body text-ink-muted">
            We&rsquo;re building {CAMPUS_PRODUCT_NAME} with our first partner colleges. If you run a placement cell, we&rsquo;d like to
            hear what your students need.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            <Link href={"/colleges" as Route} className={buttonStyles({ size: "lg" })}>
              Untiered for Colleges
            </Link>
            {campusLeadsEnabled() ? (
              <Link href={`/colleges#${CAMPUS_REGISTER_ANCHOR}` as Route} className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Register your college
              </Link>
            ) : (
              <a href={CAMPUS_CONTACT_HREF} className={buttonStyles({ variant: "secondary", size: "lg" })}>
                Talk to us about a pilot
              </a>
            )}
          </div>
        </div>
        <ul className="card flex flex-col gap-4 p-6 shadow-[var(--shadow-md)]">
          {points.map((point) => (
            <li key={point} className="flex items-start gap-3 text-body text-ink">
              <svg aria-hidden="true" viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-positive" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3.5 8.5 3 3 6-7" />
              </svg>
              {point}
            </li>
          ))}
          <li className="border-t border-line pt-4 text-caption text-ink-subtle">Batch tools are in development with partner colleges.</li>
        </ul>
      </div>
    </section>
  );
}
