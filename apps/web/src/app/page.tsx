import type { UsageCounts } from "@untiered/shared";
import type { Metadata, Route } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { BrandMark, BrandWordmark } from "@/components/brand-logo";
import { ActionLink } from "@/components/ui/action-link";
import { Testimonials } from "@/components/testimonials";
import { courses, totalChapters, totalMinutes } from "@/content/courses";
import { LANDING_TESTIMONIALS } from "@/content/landing-testimonials";
import { SiteFooter } from "@/components/site-footer";
import { SessionLink } from "@/components/session-link";
import { fetchUsage } from "@/lib/api";
import { courseEnabled, featureEnabled } from "@/lib/flags";

export const metadata: Metadata = {
  title: "Untiered — talent has no tiers",
  description:
    "Spoken mock interviews for the loops people actually sit: service-based IT, Big Four, " +
    "European competency rounds, global product. Every score in the report quotes what you said.",
};

/**
 * The public landing page.
 *
 * Rebuilt in the InterviewBit-style direction the owner asked for (task 044): a
 * confident marketing page with a navy hero, clear promise and a hero visual, rather
 * than a terminal-flavoured spec sheet. The claims underneath are unchanged from the
 * previous pass and still true statements only — no invented user counts, ratings or
 * testimonials (CLAUDE.md "quality bar").
 *
 * Server-rendered: organic search on "<employer> interview" is a primary acquisition
 * channel (PRD 11).
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
        {mockInterviewsEnabled ? <VoiceSection /> : null}
        {mockInterviewsEnabled ? <TranscriptSample /> : null}
        {mockInterviewsEnabled ? <Coverage /> : null}
        {mockInterviewsEnabled && reportsEnabled ? <ReportContents /> : null}
        {coursesEnabled && visibleCourses.length > 0 ? (
          <Courses visibleCourses={visibleCourses} arenaEnabled={arenaEnabled} />
        ) : null}
        <Testimonials testimonials={LANDING_TESTIMONIALS} />
        {mockInterviewsEnabled ? <HowItWorks /> : null}
        <CtaBand mockInterviewsEnabled={mockInterviewsEnabled} coursesEnabled={coursesEnabled} arenaEnabled={arenaEnabled} />
      </main>
      <SiteFooter />
    </div>
  );
}

function SiteHeader({ mockInterviewsEnabled, coursesEnabled }: { mockInterviewsEnabled: boolean; coursesEnabled: boolean }) {
  return (
    <header className="z-sticky sticky top-0 border-b border-line bg-surface-raised/90 shadow-[var(--shadow-sm)] backdrop-blur-xl">
      <div className="mx-auto flex layout-content items-center justify-between gap-6 px-6 py-4">
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
    <section className="bg-navy text-on-navy">
      <div className={`mx-auto grid layout-content gap-14 px-6 py-20 lg:items-center lg:gap-10 lg:py-28 ${mockInterviewsEnabled ? "lg:grid-cols-[1.1fr_1fr]" : "lg:grid-cols-[1.25fr_.75fr]"}`}>
        <div className="flex flex-col gap-7">
          <span className="pill pill-navy w-fit">Talent has no tiers.</span>
          <h1 className="text-hero text-balance text-on-navy">
            {mockInterviewsEnabled ? (
              <>A mock interview that <span className="text-accent-on-navy">interrupts you.</span></>
            ) : (
              <>Build skills that <span className="text-accent-on-navy">hold up under pressure.</span></>
            )}
          </h1>
          <p className="max-w-xl text-body text-on-navy-muted">
            {mockInterviewsEnabled
              ? "You speak your answers. It follows up on what you actually said, cuts in when you ramble, and pushes back on claims you cannot defend. Afterwards you get a report where every score is pinned to a sentence out of your own mouth."
              : "Work through complete learning paths, test your recall in short practice rounds, and return tomorrow with a clear next step instead of another passive video queue."}
          </p>
          <div className="flex flex-wrap items-center gap-4 pt-1">
            {mockInterviewsEnabled ? (
              <ActionLink href="/interview/new" size="lg">Take a free interview</ActionLink>
            ) : (
              <ActionLink href={learningHref as Route} size="lg">Start learning</ActionLink>
            )}
            {coursesEnabled && mockInterviewsEnabled ? (
              <ActionLink href={"/courses" as Route} variant="onDark" size="lg">Explore free courses</ActionLink>
            ) : null}
          </div>
          <p className="text-caption text-on-navy-muted">{mockInterviewsEnabled ? "Every round free while we build. Full report included, no card." : "Free learning paths. Sign in once and continue where you stopped."}</p>
          {mockInterviewsEnabled ? (
            <Suspense fallback={null}>
              <UsageLine />
            </Suspense>
          ) : null}
        </div>

        {mockInterviewsEnabled ? <HeroVisual /> : <LearningVisual coursesEnabled={coursesEnabled} arenaEnabled={arenaEnabled} />}
      </div>
    </section>
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
 * The hero visual: a mock interview card with a waveform and a report score, built in
 * plain SVG/HTML. Not a stock abstract blob — it is a small, honest picture of the two
 * things the product actually does (listen to a spoken answer, score it with evidence).
 */
function HeroVisual() {
  const bars = [6, 14, 9, 22, 12, 28, 16, 10, 24, 14, 8, 18, 11, 26, 15, 9, 20, 13, 7, 17];
  return (
    <div className="relative mx-auto w-full max-w-sm lg:mx-0">
      <div className="card relative flex flex-col gap-5 bg-surface-raised p-6 shadow-[var(--shadow-lg)]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Live round · turn 4
          </span>
          <span className="flex items-center gap-1.5 text-micro font-semibold text-positive">
            <span className="h-1.5 w-1.5 rounded-full bg-positive" aria-hidden="true" />
            Speaking
          </span>
        </div>

        <div className="flex h-16 items-end gap-1" role="img" aria-label="A candidate's voice waveform">
          {bars.map((h, i) => (
            <span
              key={i}
              className="w-full rounded-full bg-accent/70"
              style={{ height: `${h * 2.2}px` }}
            />
          ))}
        </div>

        <p className="text-caption text-ink-muted">
          &ldquo;We polled the ledger table every few seconds and retried on failure.&rdquo;
        </p>

        <div className="flex items-center justify-between border-t border-line pt-4">
          <span className="text-caption text-ink-subtle">Operational depth</span>
          <span className="font-mono text-title font-bold text-ink">2<span className="text-caption text-ink-subtle">/5</span></span>
        </div>
      </div>

      <div className="card absolute -bottom-8 -left-8 hidden w-52 flex-col gap-2 bg-surface-raised p-4 shadow-[var(--shadow-md)] sm:flex">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Report score
        </span>
        <div className="flex items-baseline gap-1.5">
          <span className="font-mono text-display font-bold text-accent">78</span>
          <span className="text-caption text-ink-subtle">/100</span>
        </div>
        <span className="pill pill-positive w-fit">Ready for the next round</span>
      </div>
    </div>
  );
}

/**
 * True employer names we cover, as text wordmarks — no logos we do not own the rights to.
 * Every name here is a row in `public.companies`; the "more" count is the rest of that
 * table (91 in production on 27 October 2026), rounded down so it stays true.
 */
function EmployerStrip() {
  const employers = [
    "Google",
    "Amazon",
    "Microsoft",
    "Meta",
    "Apple",
    "Netflix",
    "Uber",
    "Atlassian",
    "Salesforce",
    "Stripe",
    "Adyen",
    "PayPal",
    "Goldman Sachs",
    "JPMorgan Chase",
    "McKinsey & Company",
    "Flipkart",
    "Zomato",
    "Swiggy",
    "Razorpay",
    "Paytm",
    "PhonePe",
    "CRED",
    "Zerodha",
    "Meesho",
    "Zoho",
    "Freshworks",
    "TCS",
    "Infosys",
    "Accenture",
    "Deloitte",
  ];
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto layout-content px-6 py-8">
        <p className="pb-4 text-center font-mono text-micro tracking-widest text-ink-subtle uppercase">
          Rounds built for interviews at
        </p>
        <ul className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3">
          {employers.map((name) => (
            <li key={name} className="text-heading font-bold text-ink-muted">
              {name}
            </li>
          ))}
          <li className="text-heading font-bold text-accent">and 60+ more</li>
        </ul>
      </div>
    </section>
  );
}

function VoiceSection() {
  const points = [
    {
      title: "You speak, it listens",
      body: "Browser recording straight to Gemini — no separate voice vendor. It hears the answer and speaks the next question back.",
    },
    {
      title: "A face across the table",
      body: "A drawn interviewer, never photoreal and never named, so nobody mistakes it for a person. Your own camera is optional and never leaves your browser.",
    },
    {
      title: "It interrupts",
      body: "Rambling gets cut in on. A claim you cannot defend gets a follow-up. That is the difference from a question bank on a timer.",
    },
  ];
  return (
    <section className="border-b border-line">
      <div className="mx-auto layout-content px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <span className="pill pill-accent w-fit">Voice mock interviews</span>
          <h2 className="text-display text-balance text-ink">Practice by talking, not by typing.</h2>
        </div>
        <ul className="grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-3">
          {points.map((p) => (
            <li key={p.title} className="flex flex-col gap-2 bg-surface-raised p-6">
              <h3 className="text-heading font-bold text-ink">{p.title}</h3>
              <p className="text-caption text-ink-muted">{p.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/**
 * A real exchange from a real session. The single most persuasive thing on the page,
 * because it is the thing competitors cannot fake with copy.
 */
function TranscriptSample() {
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto grid layout-content gap-10 px-6 py-20 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <h2 className="text-display text-balance text-ink">It listens to the answer.</h2>
          <p className="max-w-md text-body text-ink-muted">
            Not a question bank on a timer. The follow-up below came from one sentence the
            candidate said about their own architecture — and it came because the answer had gone
            thin.
          </p>
        </div>

        <div className="card overflow-hidden">
          <div className="flex items-center justify-between border-b border-line px-5 py-3">
            <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
              Project deep-dive · service-based IT
            </span>
            <span className="font-mono text-micro text-ink-subtle">turn 2</span>
          </div>
          <div className="flex flex-col divide-y divide-line">
            <Exchange
              speaker="Candidate"
              body="Yeah, so we used a background worker that polled the ledger table every few seconds. If it failed we just retried it. It was mostly fine."
            />
            <Exchange
              speaker="Interviewer"
              accent
              tag="challenge"
              body="Polling a ledger table taking hundreds of writes per second degrades the database and adds lag. How did you track which records still needed projecting?"
            />
          </div>
          <p className="border-t border-line px-5 py-3 text-caption text-ink-subtle">
            The report scored operational depth 2 out of 5 here, and quoted that answer as the
            reason.
          </p>
        </div>
      </div>
    </section>
  );
}

function Exchange({
  speaker,
  body,
  accent = false,
  tag,
}: {
  speaker: string;
  body: string;
  accent?: boolean;
  tag?: string;
}) {
  return (
    <div className={accent ? "bg-accent-wash px-5 py-4" : "px-5 py-4"}>
      <div className="flex items-center gap-2 pb-1.5">
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {speaker}
        </span>
        {tag ? <span className="pill pill-accent">{tag}</span> : null}
      </div>
      <p className="text-body text-ink">{body}</p>
    </div>
  );
}

/** Names real employers and real round types. An adjective would say nothing. */
function Coverage() {
  const archetypes = [
    {
      label: "Service-based IT",
      examples: "TCS · Infosys · Wipro · Cognizant",
      rounds: "Project walkthrough, techno-managerial, HR fit",
    },
    {
      label: "Consulting and Big Four",
      examples: "Deloitte · EY · PwC · KPMG · Accenture",
      rounds: "Case discussion, client scenario, manager round",
    },
    {
      label: "Global product",
      examples: "Google · Amazon · Microsoft · Atlassian",
      rounds: "Coding, system design, behavioural, bar raiser",
    },
    {
      label: "European employers",
      examples: "Booking · Adyen · SAP · Zalando",
      rounds: "Competency rounds, values fit, relocation and visa",
    },
    {
      label: "Indian product",
      examples: "Zoho · Razorpay · Zerodha · Swiggy",
      rounds: "Practical coding, product sense, founder round",
    },
    {
      label: "GCC and captive",
      examples: "Global banks, retail and pharma captives",
      rounds: "Domain depth, stakeholder management, compliance",
    },
  ];

  return (
    <section className="border-b border-line">
      <div className="mx-auto layout-content px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <h2 className="text-display text-balance text-ink">The loops most tools skip.</h2>
          <p className="max-w-2xl text-body text-ink-muted">
            An Infosys techno-managerial panel is not a Google system design round, and preparing
            for one does not prepare you for the other. Each archetype runs its own structure and
            its own rubric.
          </p>
        </div>

        <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {archetypes.map((item) => (
            <li key={item.label} className="card flex flex-col gap-2 p-5">
              <span className="text-heading font-bold text-ink">{item.label}</span>
              <span className="font-mono text-caption text-ink-subtle">{item.examples}</span>
              <span className="text-caption text-ink-muted">{item.rounds}</span>
            </li>
          ))}
        </ul>

        <p className="max-w-2xl pt-6 text-caption text-ink-subtle">
          Name an employer we do not recognise and the round still runs — on archetype patterns,
          and it tells you that is what it is doing rather than inventing detail about a company
          we know nothing about.
        </p>
      </div>
    </section>
  );
}

function ReportContents() {
  const sections = [
    {
      n: "01",
      title: "Competency scores, each with a quote",
      body: "Scored against your function and level. A score that cannot be tied to something you said is dropped rather than shown.",
    },
    {
      n: "02",
      title: "Where you needed a hand",
      body: "Counted from the round itself: which answers stood alone, where you were nudged, and what you built on the nudge.",
    },
    {
      n: "03",
      title: "Answer by answer",
      body: "What worked, what was vague, what a real interviewer would have probed, and a stronger framing for the weakest answers.",
    },
    {
      n: "04",
      title: "How you came across",
      body: "Structure, filler density, pace, rambling, and how you handled not knowing something.",
    },
    {
      n: "05",
      title: "What to work on next",
      body: "The specific competencies to fix before the next attempt, and which round to take next.",
    },
  ];

  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto grid layout-content gap-10 px-6 py-20 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
        <div className="flex flex-col gap-4">
          <span className="pill pill-accent w-fit">The feedback report</span>
          <h2 className="text-display text-balance text-ink">The report is the product.</h2>
          <p className="max-w-md text-body text-ink-muted">
            Encouraging summaries are worthless and candidates know it. Everything here is either
            traceable to your transcript or it does not appear.
          </p>
        </div>

        <ol className="card flex flex-col divide-y divide-line">
          {sections.map((section) => (
            <li key={section.n} className="flex gap-5 p-5">
              <span className="pt-0.5 font-mono text-caption text-accent">{section.n}</span>
              <div className="flex flex-col gap-1">
                <h3 className="text-heading font-bold text-ink">{section.title}</h3>
                <p className="max-w-xl text-body text-ink-muted">{section.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Free courses (task 045).
 *
 * Each card links to its own course. It used to send both to `/courses` — the comment
 * said "links out even if the route isn't live yet", which was true when it was written
 * and quietly stopped being true once the courses shipped. The effect was that clicking
 * either card landed you on the same catalogue page, so the two cards looked broken.
 *
 * The titles and taglines are read from the course content itself rather than repeated
 * here, so the landing page cannot drift out of step with what the course is actually
 * called.
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
      <div className="mx-auto layout-content px-6 py-20">
        <div className="flex flex-col gap-3 pb-10">
          <span className="pill pill-highlight w-fit">Free courses</span>
          <h2 className="text-display text-balance text-ink">Study before you sit the round.</h2>
          <p className="max-w-2xl text-body text-ink-muted">
            Free, self-paced material — the fundamentals a coding round tests, and the AI work everyone is
            now being asked about.
          </p>
        </div>
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visibleCourses.map((course) => (
            <Link
              key={course.slug}
              href={`/courses/${course.slug}` as Route}
              className="card flex flex-col gap-2 p-6 transition-shadow hover:shadow-[var(--shadow-md)]"
            >
              <h3 className="text-heading font-bold text-ink">{course.title}</h3>
              <p className="text-caption text-ink-muted">{course.tagline}</p>
              <span className="pt-2 text-caption font-semibold text-accent">
                {totalChapters(course)} chapters · {totalMinutes(course)} min
              </span>
              <span className="text-caption font-semibold text-accent">Start course →</span>
            </Link>
          ))}
          {arenaEnabled ? (
            <Link href={"/arena" as Route} className="card flex flex-col gap-2 p-6 transition-shadow hover:shadow-[var(--shadow-md)]">
              <span className="pill pill-highlight w-fit">New</span>
              <h3 className="text-heading font-bold text-ink">The Arena</h3>
              <p className="text-caption text-ink-muted">
                Short, gamified rounds derived from every chapter above — spot the mistake, predict the output,
                read a diagram one step ahead.
              </p>
              <span className="pt-2 text-caption font-semibold text-accent">Play now →</span>
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

function HowItWorks() {
  const steps = [
    { n: "01", title: "Pick company and role", body: "Chosen fresh for this session — no setup, no target list to maintain." },
    { n: "02", title: "Take the round", body: "Up to 8 spoken exchanges. It adapts to what you say and interrupts when it needs to." },
    { n: "03", title: "Read the report", body: "Every score quotes your own transcript. Free, in full, every time." },
  ];
  return (
    <section className="border-b border-line bg-surface-sunken">
      <div className="mx-auto layout-content px-6 py-20">
        <h2 className="pb-10 text-display text-balance text-ink">How it works.</h2>
        <ol className="grid gap-8 sm:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="flex flex-col gap-2">
              <span className="font-mono text-display font-bold text-accent">{s.n}</span>
              <h3 className="text-heading font-bold text-ink">{s.title}</h3>
              <p className="text-caption text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * There is no paid tier yet, so this promises exactly what the product does: every round,
 * free, while it is being built. Saying "free trial" or naming a future price would be
 * selling something that does not exist.
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
  return (
    <section className="bg-navy text-on-navy">
      <div className="mx-auto flex layout-content flex-col items-start gap-6 px-6 py-20">
        <h2 className="text-display text-balance text-on-navy">
          {mockInterviewsEnabled ? "Every round is free right now." : "Keep building the skill behind the answer."}
        </h2>
        <p className="max-w-xl text-body text-on-navy-muted">
          {mockInterviewsEnabled
            ? "Not a trial round, and not a sample report — the whole thing, as many times as you want, while we are still building it. No card. When there is something worth charging for, we will say so before we charge for it."
            : "Choose a learning path, practise what you studied, and come back with a stronger explanation than the one you had yesterday."}
        </p>
        <ActionLink href={href as Route} size="lg">
          {mockInterviewsEnabled ? "Start an interview" : coursesEnabled ? "Explore courses" : arenaEnabled ? "Open the Arena" : "Sign in"}
        </ActionLink>
      </div>
    </section>
  );
}
