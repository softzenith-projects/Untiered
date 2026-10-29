import type { UsageCounts } from "@untiered/shared";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { CourseArtwork } from "@/components/courses/course-visuals";
import { LoopPicker } from "@/components/landing/loop-picker";
import { ReportPreview } from "@/components/landing/report-preview";
import { SampleTurn } from "@/components/landing/sample-turn";
import { ActionLink } from "@/components/ui/action-link";
import { Testimonials } from "@/components/testimonials";
import { courses, totalChapters, totalMinutes } from "@/content/courses";
import { LANDING_TESTIMONIALS } from "@/content/landing-testimonials";
import { SiteFooter } from "@/components/site-footer";
import { SessionLink } from "@/components/session-link";
import { fetchUsage } from "@/lib/api";
import { courseEnabled, featureEnabled } from "@/lib/flags";
import { FREE_ROUNDS_TEXT } from "@/lib/legal";

export const metadata: Metadata = {
  title: "Untiered — talent has no tiers",
  description:
    "Spoken mock interviews for the loops people actually sit: service-based IT, Big Four, " +
    "European competency rounds, global product. Every score in the report quotes what you said.",
};

/**
 * The public landing page.
 *
 * Revamped (28 October 2026) because the previous pass explained the product in six
 * sections of paragraphs. This one shows it instead: the hero plays a spoken turn and the
 * interviewer pushing back on it, the loop picker shows each archetype's rounds, and the
 * sample report reveals the quote behind each score. Copy is cut to a line per section.
 *
 * The claims underneath are still true statements only — no invented user counts, ratings
 * or testimonials (CLAUDE.md "quality bar"), and the free allowance is read from the same
 * constant the terms state, so the two cannot disagree.
 *
 * Server-rendered: organic search on "<employer> interview" is a primary acquisition
 * channel (PRD 11). The interactive pieces are client islands whose first state renders
 * on the server, so their text is in the HTML.
 */
export default function LandingPage() {
  const mockInterviewsEnabled = featureEnabled("mockInterviews");
  const coursesEnabled = featureEnabled("courses");
  const arenaEnabled = featureEnabled("arena");
  const reportsEnabled = featureEnabled("reports");
  const visibleCourses = courses.filter((course) => courseEnabled(course.slug));

  return (
    <div className="min-h-dvh bg-surface">
      <SiteHeader mockInterviewsEnabled={mockInterviewsEnabled} coursesEnabled={coursesEnabled} />
      <main>
        <Hero
          mockInterviewsEnabled={mockInterviewsEnabled}
          coursesEnabled={coursesEnabled && visibleCourses.length > 0}
          arenaEnabled={arenaEnabled && visibleCourses.length > 0}
        />
        {mockInterviewsEnabled ? <EmployerStrip /> : null}
        {mockInterviewsEnabled ? <Loops /> : null}
        {mockInterviewsEnabled && reportsEnabled ? <Report /> : null}
        {coursesEnabled && visibleCourses.length > 0 ? (
          <Courses visibleCourses={visibleCourses} arenaEnabled={arenaEnabled} />
        ) : null}
        <Testimonials testimonials={LANDING_TESTIMONIALS} />
        <CtaBand mockInterviewsEnabled={mockInterviewsEnabled} coursesEnabled={coursesEnabled} arenaEnabled={arenaEnabled} />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader({ mockInterviewsEnabled, coursesEnabled }: { mockInterviewsEnabled: boolean; coursesEnabled: boolean }) {
  return (
    <header className="z-sticky sticky top-0 border-b border-line bg-surface-raised/90 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className="mx-auto flex layout-content items-center justify-between gap-6 px-4 py-3 sm:px-6">
        <Link href="/" className="flex min-h-11 items-center gap-2.5 focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent" aria-label="Untiered home">
          <span className="sm:hidden"><BrandMark /></span>
          <span className="hidden sm:block"><BrandWordmark /></span>
        </Link>
        <nav aria-label="Site" className="hidden items-center gap-8 md:flex">
          {mockInterviewsEnabled ? (
            <Link href="/interview/new" className="inline-flex min-h-11 items-center text-caption font-medium text-ink-muted hover:text-ink">Mock interviews</Link>
          ) : null}
          {coursesEnabled ? (
            <Link href={"/courses" as Route} className="inline-flex min-h-11 items-center text-caption font-medium text-ink-muted hover:text-ink">Courses</Link>
          ) : null}
        </nav>
        <div className="flex items-center gap-3">
          <SessionLink
            signedIn={{ href: "/dashboard", label: "Dashboard" }}
            signedOut={{ href: "/login", label: "Sign in" }}
            className="hidden min-h-11 items-center rounded-lg px-3 py-2 text-caption font-medium text-ink transition-colors hover:bg-surface-sunken sm:inline-flex"
          />
          <ActionLink href={coursesEnabled && !mockInterviewsEnabled ? "/courses" : mockInterviewsEnabled ? "/interview/new" : "/login"} size="sm">
            {mockInterviewsEnabled ? "Start free" : coursesEnabled ? "Start learning" : "Sign in"}
          </ActionLink>
        </div>
      </div>
    </header>
  );
}

function Hero({
  mockInterviewsEnabled,
  coursesEnabled,
  arenaEnabled,
}: {
  mockInterviewsEnabled: boolean;
  coursesEnabled: boolean;
  arenaEnabled: boolean;
}) {
  const learningHref = coursesEnabled ? "/courses" : arenaEnabled ? "/arena" : "/login";
  return (
    <section className="relative overflow-hidden bg-navy text-on-navy">
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 opacity-40" />
      <div className={`relative mx-auto grid layout-content gap-12 px-4 py-14 sm:px-6 lg:items-center lg:gap-14 lg:py-24 ${mockInterviewsEnabled ? "lg:grid-cols-[1fr_1.05fr]" : "lg:grid-cols-[1.25fr_.75fr]"}`}>
        <div className="flex flex-col gap-6">
          <span className="pill pill-navy w-fit">Talent has no tiers.</span>
          <h1 className="text-hero text-balance text-on-navy">
            {mockInterviewsEnabled ? (
              <>A mock interview that <span className="text-accent-on-navy">interrupts you.</span></>
            ) : (
              <>Build skills that <span className="text-accent-on-navy">hold up under pressure.</span></>
            )}
          </h1>
          <p className="max-w-lg text-body text-on-navy-muted">
            {mockInterviewsEnabled
              ? "You talk. It follows up on what you actually said, cuts in when you ramble, and quotes you in the report."
              : "Complete learning paths, short daily recall rounds, and a clear next step every time you come back."}
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-1">
            {mockInterviewsEnabled ? (
              <ActionLink href="/interview/new" size="lg">Take a free interview</ActionLink>
            ) : (
              <ActionLink href={learningHref as Route} size="lg">Start learning</ActionLink>
            )}
            {coursesEnabled && mockInterviewsEnabled ? (
              <ActionLink href={"/courses" as Route} variant="onDark" size="lg">Free courses</ActionLink>
            ) : null}
          </div>
          {mockInterviewsEnabled ? (
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-caption text-on-navy-muted">
              {[`${FREE_ROUNDS_TEXT} free`, "Full report included", "No card to start"].map((item) => (
                <li key={item} className="flex items-center gap-1.5">
                  <CheckIcon />
                  {item}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-caption text-on-navy-muted">Free learning paths. Sign in once and continue where you stopped.</p>
          )}
          {mockInterviewsEnabled ? (
            <Suspense fallback={null}>
              <UsageLine />
            </Suspense>
          ) : null}
        </div>

        {mockInterviewsEnabled ? <SampleTurn /> : <LearningVisual coursesEnabled={coursesEnabled} arenaEnabled={arenaEnabled} />}
      </div>
    </section>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4 text-positive" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m3.5 8.5 3 3 6-7" />
    </svg>
  );
}

function LearningVisual({ coursesEnabled, arenaEnabled }: { coursesEnabled: boolean; arenaEnabled: boolean }) {
  const cards = [
    coursesEnabled ? { eyebrow: "Learning paths", title: "Small chapters. Runnable code. Clear progress." } : null,
    arenaEnabled ? { eyebrow: "Daily Arena", title: "Short recall rounds that change every day." } : null,
  ].filter((card): card is { eyebrow: string; title: string } => card !== null);

  return (
    <div className="grid gap-4">
      {cards.map((card, index) => (
        <div key={card.eyebrow} className={`card border-on-navy/10 p-6 shadow-[var(--shadow-lg)] ${index === 1 ? "sm:ml-10" : ""}`}>
          <p className="font-mono text-micro tracking-widest text-accent uppercase">{card.eyebrow}</p>
          <p className="mt-3 text-heading font-bold text-ink">{card.title}</p>
          <div className="mt-5 h-1.5 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full w-2/3 rounded-full bg-accent" /></div>
        </div>
      ))}
    </div>
  );
}

/**
 * What the product has actually done.
 *
 * Shown only once there is something worth showing. "3 interviews completed" is worse
 * than no number at all — a counter is only social proof above a threshold, and below it
 * an honest silence beats a small brag.
 */
async function UsageLine() {
  const usage: UsageCounts | null = await fetchUsage();
  const MEANINGFUL = 25;
  if (!usage || usage.interviewsCompleted < MEANINGFUL) return null;

  return (
    <p className="font-mono text-caption text-on-navy-muted">
      {usage.interviewsCompleted.toLocaleString()} interviews sat ·{" "}
      {usage.reportsGenerated.toLocaleString()} reports written
    </p>
  );
}

/**
 * True employer names we cover, as text wordmarks — no logos we do not own the rights to.
 * Every name here is a row in `public.companies`; the "more" count is the rest of that
 * table (91 in production on 27 October 2026), rounded down so it stays true.
 *
 * The list is rendered twice so the scrolling strip loops seamlessly; the copy is hidden
 * from assistive tech, and from everyone when motion is reduced (globals.css).
 */
const EMPLOYERS = [
  "Google", "Amazon", "Microsoft", "Meta", "Apple", "Netflix", "Uber", "Atlassian", "Salesforce", "Stripe",
  "Adyen", "PayPal", "Goldman Sachs", "JPMorgan Chase", "McKinsey & Company", "Flipkart", "Zomato", "Swiggy",
  "Razorpay", "Paytm", "PhonePe", "CRED", "Zerodha", "Meesho", "Zoho", "Freshworks", "TCS", "Infosys",
  "Accenture", "Deloitte",
];

function EmployerStrip() {
  return (
    <section className="border-b border-line bg-surface-raised py-8">
      <p className="px-4 pb-5 text-center font-mono text-micro tracking-widest text-ink-subtle uppercase">
        Rounds built for interviews at these employers and 60+ more
      </p>
      <div className="marquee overflow-hidden">
        <div className="marquee-track flex">
          <EmployerList />
          <EmployerList duplicate />
        </div>
      </div>
    </section>
  );
}

/** Each copy carries its own trailing gap, so the two halves are identical and the loop has no seam. */
function EmployerList({ duplicate = false }: { duplicate?: boolean }) {
  return (
    <ul aria-hidden={duplicate || undefined} className={`flex shrink-0 gap-x-10 gap-y-3 pr-10 ${duplicate ? "marquee-duplicate" : ""}`}>
      {EMPLOYERS.map((name) => (
        <li key={name} className="text-h4 font-bold whitespace-nowrap text-ink-subtle transition-colors hover:text-ink">
          {name}
        </li>
      ))}
    </ul>
  );
}

function Loops() {
  return (
    <section className="border-b border-line">
      <div className="mx-auto layout-content px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-col gap-3 pb-8">
          <h2 className="text-display text-balance text-ink">An Infosys panel is not a Google loop.</h2>
          <p className="max-w-xl text-body text-ink-muted">Each type runs its own rounds and its own rubric. Pick one.</p>
        </div>
        <LoopPicker />
        <p className="max-w-xl pt-5 text-caption text-ink-subtle">
          Name an employer we don&rsquo;t know and the round runs on the archetype — and says so, rather than inventing detail.
        </p>
      </div>
    </section>
  );
}

function Report() {
  const extras = ["Answer-by-answer breakdown", "Where you needed a nudge", "Filler, pace and structure", "What to fix next"];
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto grid layout-content gap-10 px-4 py-16 sm:px-6 lg:grid-cols-[0.8fr_1.2fr] lg:items-center lg:gap-16 lg:py-24">
        <div className="flex flex-col gap-4">
          <span className="pill pill-accent w-fit">The report</span>
          <h2 className="text-display text-balance text-ink">Every score quotes you.</h2>
          <p className="max-w-md text-body text-ink-muted">A score that can&rsquo;t be tied to something you said is dropped, not shown.</p>
          <ul className="flex flex-wrap gap-2 pt-2">
            {extras.map((item) => (
              <li key={item} className="rounded-full border border-line bg-surface-raised px-3 py-1.5 text-caption font-medium text-ink-muted">
                {item}
              </li>
            ))}
          </ul>
        </div>
        <ReportPreview />
      </div>
    </section>
  );
}

/**
 * Free courses. Each card links to its own course; titles and taglines are read from the
 * course content itself so the landing page cannot drift from what a course is called.
 */
function Courses({
  visibleCourses,
  arenaEnabled,
}: {
  visibleCourses: typeof courses;
  arenaEnabled: boolean;
}) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto layout-content px-4 py-16 sm:px-6 lg:py-24">
        <div className="flex flex-wrap items-end justify-between gap-4 pb-8">
          <div className="flex flex-col gap-3">
            <span className="pill pill-highlight w-fit">Free courses</span>
            <h2 className="text-display text-balance text-ink">Study before you sit the round.</h2>
          </div>
          <Link href={"/courses" as Route} className="inline-flex min-h-11 items-center text-caption font-semibold text-accent hover:text-accent-strong">
            All courses →
          </Link>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {visibleCourses.map((course) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}` as Route}
              className="card group flex flex-col overflow-hidden transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <CourseArtwork courseSlug={course.slug} />
              <div className="flex flex-1 flex-col gap-2 p-5">
                <h3 className="text-heading font-bold text-ink">{course.title}</h3>
                <p className="text-caption text-ink-muted">{course.tagline}</p>
                <span className="mt-auto pt-3 font-mono text-micro text-ink-subtle">
                  {totalChapters(course)} chapters · {totalMinutes(course)} min
                </span>
              </div>
            </Link>
          ))}
        </div>
        {arenaEnabled ? (
          <Link
            href={"/arena" as Route}
            className="card mt-5 flex flex-wrap items-center justify-between gap-4 p-5 transition-shadow hover:shadow-[var(--shadow-md)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <span className="flex flex-col gap-1">
              <span className="text-heading font-bold text-ink">The Arena</span>
              <span className="text-caption text-ink-muted">Spot the mistake, predict the output — short rounds from every chapter.</span>
            </span>
            <span className="text-caption font-semibold text-accent">Play now →</span>
          </Link>
        ) : null}
      </div>
    </section>
  );
}

/**
 * The free allowance is stated from the same constant as the terms (`lib/legal.ts`), so
 * this band cannot promise more than the product gives.
 */
function CtaBand({
  mockInterviewsEnabled,
  coursesEnabled,
  arenaEnabled,
}: {
  mockInterviewsEnabled: boolean;
  coursesEnabled: boolean;
  arenaEnabled: boolean;
}) {
  const href = mockInterviewsEnabled ? "/interview/new" : coursesEnabled ? "/courses" : arenaEnabled ? "/arena" : "/login";
  const steps = ["Pick a company and role", "Talk through up to 8 exchanges", "Read the report"];
  return (
    <section className="bg-navy text-on-navy">
      <div className="mx-auto flex layout-content flex-col gap-10 px-4 py-16 sm:px-6 lg:flex-row lg:items-center lg:justify-between lg:py-20">
        <div className="flex flex-col gap-4">
          <h2 className="text-display text-balance text-on-navy">
            {mockInterviewsEnabled ? `Your first ${FREE_ROUNDS_TEXT} are free.` : "Keep building the skill behind the answer."}
          </h2>
          {mockInterviewsEnabled ? (
            <ol className="flex flex-col gap-3 sm:flex-row sm:gap-6">
              {steps.map((step, index) => (
                <li key={step} className="flex items-center gap-2.5 text-caption text-on-navy-muted">
                  <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-navy-raised font-mono text-micro font-bold text-on-navy">
                    {index + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ol>
          ) : (
            <p className="max-w-xl text-body text-on-navy-muted">Choose a learning path, practise what you studied, and come back sharper.</p>
          )}
        </div>
        <div className="flex flex-col items-start gap-2">
          <ActionLink href={href as Route} size="lg">
            {mockInterviewsEnabled ? "Start an interview" : coursesEnabled ? "Explore courses" : arenaEnabled ? "Open the Arena" : "Sign in"}
          </ActionLink>
          {mockInterviewsEnabled ? (
            <span className="text-caption text-on-navy-muted">Full report with each · no card to start</span>
          ) : null}
        </div>
      </div>
    </section>
  );
}
