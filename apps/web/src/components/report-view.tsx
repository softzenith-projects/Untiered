"use client";

import type {
  ReportAssessedArea,
  ReportAssistance,
  ReportCompetency,
  ReportPracticeItem,
  ReportQuestionSources,
  SessionReport,
} from "@untiered/shared";
import Link from "next/link";
import { useEffect, useState } from "react";

import { CompetencyBars, TONE_STYLES, bandFor, overallScore, scoreToneForPercent } from "@/components/report-charts";
import { ReportVisuals } from "@/components/report-visuals";
import { SpokenEnglishPanel } from "@/components/spoken-english-panel";
import { ApiRequestError, fetchReport } from "@/lib/api";
import { cn } from "@/lib/cn";
import { cachedReport, rememberReport } from "@/lib/report-cache";
import { useAccessToken } from "@/lib/use-access-token";

const REPORT_RETRY_DELAY_MS = 5_000;
const REPORT_MAX_RETRY_DELAY_MS = 30_000;
const REPORT_WAIT_LIMIT_MS = 10 * 60_000;

function reportIsStillGenerating(cause: unknown): boolean {
  return cause instanceof ApiRequestError && (
    (cause.status === 409 && cause.code === "report_generating") ||
    cause.status === 502 || cause.status === 504
  );
}

/**
 * The feedback report (PRD 09) — where perceived value concentrates.
 *
 * Every competency score is shown with the candidate's own words underneath it. Scores
 * arrive here already filtered server-side: any whose evidence could not be found in the
 * transcript was dropped rather than displayed, because a score without evidence is a
 * badge, and an invented quote destroys the credibility this page exists to build.
 */
export type ReportLoader = (options: { accessToken: string; signal: AbortSignal }) => Promise<SessionReport>;

export function ReportView({
  sessionId,
  detailed = false,
  loadReport,
}: {
  sessionId: string;
  detailed?: boolean;
  /**
   * Where the report comes from when it is not the signed-in candidate's own (college
   * staff reading a student's report). It bypasses the candidate's report cache.
   */
  loadReport?: ReportLoader;
}) {
  const accessToken = useAccessToken();
  const [attempt, setAttempt] = useState(0);

  return (
    <ReportLoadAttempt
      key={`${accessToken ?? "signed-out"}:${sessionId}:${attempt}`}
      sessionId={sessionId}
      detailed={detailed}
      accessToken={accessToken}
      loadReport={loadReport}
      onRetry={() => setAttempt((current) => current + 1)}
    />
  );
}

function ReportLoadAttempt({
  sessionId,
  detailed,
  accessToken,
  loadReport,
  onRetry,
}: {
  sessionId: string;
  detailed: boolean;
  accessToken: string | null | undefined;
  loadReport: ReportLoader | undefined;
  onRetry: () => void;
}) {
  // Already in hand when the candidate arrives from the interview's closing screen, which
  // waited for it; the page then renders at once instead of asking for it again.
  const [report, setReport] = useState<SessionReport | null>(() => (loadReport ? null : cachedReport(sessionId)));
  const [error, setError] = useState<string | null>(null);
  const [expired, setExpired] = useState<string | null>(null);
  const [waitTimedOut, setWaitTimedOut] = useState(false);

  useEffect(() => {
    if (!accessToken || (!loadReport && cachedReport(sessionId))) return;
    let active = true;
    let retryTimer: ReturnType<typeof setTimeout> | undefined;
    const controller = new AbortController();
    const startedAt = Date.now();
    let retryDelay = REPORT_RETRY_DELAY_MS;

    const load = async () => {
      try {
        const options = { accessToken, signal: controller.signal };
        const loaded = loadReport ? await loadReport(options) : await fetchReport(sessionId, options);
        if (!loadReport) rememberReport(sessionId, loaded);
        if (active) setReport(loaded);
      } catch (cause) {
        if (!active) return;
        if (reportIsStillGenerating(cause)) {
          const remaining = REPORT_WAIT_LIMIT_MS - (Date.now() - startedAt);
          if (remaining <= 0) {
            setWaitTimedOut(true);
            return;
          }
          retryTimer = setTimeout(load, Math.min(retryDelay, remaining));
          retryDelay = Math.min(retryDelay * 2, REPORT_MAX_RETRY_DELAY_MS);
          return;
        }
        // An expired report is a normal retention outcome, not a generation failure.
        if (cause instanceof ApiRequestError && cause.code === "report_expired") {
          setExpired(cause.message);
          return;
        }
        setError(cause instanceof ApiRequestError ? cause.message : "This report could not be loaded.");
      }
    };

    void load();

    return () => {
      active = false;
      controller.abort();
      if (retryTimer) clearTimeout(retryTimer);
    };
    // The loader is fixed for the life of one attempt (the parent re-keys on change).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken, sessionId]);

  if (expired) {
    return (
      <section
        aria-labelledby="expired"
        className="flex flex-col items-start gap-5 rounded-surface border border-line bg-surface-raised p-7 shadow-[var(--shadow-md)] sm:p-10"
      >
        <p className="pill pill-highlight">
          No longer held
        </p>
        <h1 id="expired" className="max-w-2xl text-display text-balance text-ink">
          This report has expired.
        </h1>
        <p className="max-w-prose text-body text-ink-muted">{expired}</p>
        <p className="max-w-prose text-body text-ink-muted">
          The round itself is still in your history. Sitting the same round again is the closest
          thing to reading it back — and a second attempt tells you more than the first one did.
        </p>
        <div className="flex flex-wrap items-center gap-5 pt-1">
          <Link
            href="/interview/new"
            className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
          >
            Sit this round again
          </Link>
          <Link href="/dashboard" className="text-body text-ink-muted underline-offset-4 hover:underline">
            Back to your interviews
          </Link>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <p role="alert" className="text-body text-danger">
        {error}
      </p>
    );
  }

  if (waitTimedOut) {
    return (
      <section className="rounded-surface border border-line bg-surface-raised p-7 shadow-[var(--shadow-md)] sm:p-10">
        <h1 className="text-display text-ink">Your report is taking longer than expected.</h1>
        <p className="mt-3 max-w-prose text-body text-ink-muted">
          Your interview is saved. We could not finish loading the report yet.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-6 rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Try again
        </button>
      </section>
    );
  }

  if (!report) {
    return <ReportLoadingState />;
  }

  return <ReportDocument report={report} detailed={detailed} staff={Boolean(loadReport)} />;
}

/** A useful waiting room for the model-written report, without inventing a score. */
export function ReportLoadingState() {
  return (
    <section role="status" aria-labelledby="report-loading" className="overflow-hidden rounded-surface border border-line bg-surface-raised shadow-[var(--shadow-md)]">
      <div className="hero-band relative overflow-hidden px-6 py-8 sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -right-20 -top-24 size-72 rounded-full bg-accent/25 blur-3xl" />
        <div className="relative max-w-3xl">
          <p className="eyebrow text-accent-on-navy">Feedback in progress</p>
          <h1 id="report-loading" className="mt-3 text-display text-balance text-on-navy">Building your evidence-backed report.</h1>
          <p className="mt-3 max-w-2xl text-body leading-relaxed text-on-navy-muted">
            We are checking each assessment against the transcript before it appears here. Unsupported claims are left out.
          </p>
        </div>
      </div>

      <div className="grid gap-3 p-6 sm:grid-cols-3 sm:p-9">
        {[
          ["01", "Reviewing the round", "Reading the answers and the path the conversation took."],
          ["02", "Grounding feedback", "Keeping scores and coaching tied to assessable evidence."],
          ["03", "Planning the next step", "Turning the strongest gaps into focused practice."],
        ].map(([number, title, detail], index) => (
          <div key={number} className="rounded-2xl border border-line bg-surface-sunken p-4">
            <div className="flex items-center justify-between gap-3">
              <span className="font-mono text-micro font-semibold text-accent">{number}</span>
              <span aria-hidden="true" className={`size-2 rounded-full ${index === 0 ? "bg-positive" : "bg-accent/35"}`} />
            </div>
            <p className="mt-3 text-caption font-semibold text-ink">{title}</p>
            <p className="mt-1 text-caption leading-relaxed text-ink-muted">{detail}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

/**
 * The report as pure markup over a report it is handed.
 *
 * Split from the fetching for the same reason the dashboard was: a page reachable only by
 * signing in, sitting a full round and waiting for a model to write about it is a page
 * nobody ever looks at twice, and the visuals on it have to be looked at to be judged.
 *
 * Every array is read through `?? []`. Reports are composed once and stored, so a report
 * written before a section existed comes back without its key — which is not theoretical:
 * an interview sat one week could not be opened at all the next, because the reader hit
 * `.length` on a field that had just been added. The server backfills the shape it knows
 * about (`ReportService.withEveryField`), and this is the belt to that pair of braces.
 */
export function ReportDocument({
  report,
  detailed = true,
  staff = false,
}: {
  report: SessionReport;
  detailed?: boolean;
  /** A college staff member reading a student's report: no links into the student's own practice. */
  staff?: boolean;
}) {
  const competencies = report.competencies ?? [];
  const annotations = report.annotations ?? [];
  const practicePlan = report.practicePlan ?? [];
  const strengths = report.strengths ?? [];
  const developmentAreas = report.developmentAreas ?? [];
  const customTopic = report.roundType === "custom_topic" ? report.focusTopic?.trim() : null;
  const assessableTurns = report.assessableTurns ?? report.answeredTurns;
  const hasGroundedCompetency = competencies.some((item) => item.maxScore > 0);
  const hasReliableOverallScore = assessableTurns >= 2 && hasGroundedCompetency;
  const headlineScore = hasReliableOverallScore ? overallScore(competencies) : null;
  const headlineBand = headlineScore === null ? null : bandFor(headlineScore);
  const headlineTone = headlineScore === null ? null : scoreToneForPercent(headlineScore);
  const strongestCompetency = competencies
    .filter((item) => item.maxScore > 0)
    .reduce<ReportCompetency | null>((best, item) => {
      if (!best) return item;
      return item.score / item.maxScore > best.score / best.maxScore ? item : best;
    }, null);

  return (
    <article className="flex flex-col gap-8 md:gap-10">
      {detailed && !staff ? (
        <Link href={`/report/${report.sessionId}`} className="w-fit text-caption font-semibold text-accent hover:underline">
          <span aria-hidden>←</span> Back to report summary
        </Link>
      ) : null}
      <header className="hero-band relative overflow-hidden p-7 sm:p-10">
        <div aria-hidden="true" className="absolute -top-24 -right-20 size-72 rounded-full bg-accent/20 blur-3xl" />
        <div className="relative grid gap-8 lg:grid-cols-[minmax(0,1fr)_10rem] lg:items-center">
          <div className="flex flex-col gap-4">
            <p className="eyebrow text-accent-on-navy">
              {customTopic ? `${report.roundLabel} · ${customTopic}` : `${report.roundLabel} · ${report.companyName}`}
            </p>
            <h1 className="text-display text-balance text-on-navy">{report.headline}</h1>
            <p className="max-w-3xl text-body text-on-navy-muted">{report.summary}</p>
            <p className="text-caption text-on-navy-muted">
              {customTopic
                ? `${report.answeredTurns} answers · assessed within your chosen topic`
                : `${report.roleTitle} · ${report.answeredTurns} answers · assessed against a ${report.archetypeLabel.toLowerCase()} rubric`}
            </p>
          </div>
          {headlineScore !== null && headlineBand ? (
            <div
              role="img"
              aria-label={`Overall score ${headlineScore} percent, ${headlineBand.name}`}
              className="grid size-32 place-items-center rounded-full p-2 lg:justify-self-end"
              style={{
                background: `conic-gradient(var(--${headlineTone}) ${headlineScore}%, rgba(255,255,255,0.16) 0)`,
              }}
            >
              <div className="grid size-full place-items-center rounded-full bg-navy-raised text-center">
                <span>
                  <strong className="block text-title text-on-navy">{headlineScore}%</strong>
                  <span className="block max-w-20 text-micro text-accent-on-navy">{headlineBand.name}</span>
                </span>
              </div>
            </div>
          ) : null}
        </div>
      </header>

      <ReportMetricStrip
        headlineScore={headlineScore}
        headlineBand={headlineBand?.name ?? null}
        assessableTurns={assessableTurns}
        answeredTurns={report.answeredTurns}
        assistance={report.assistance}
        strongestCompetency={strongestCompetency}
      />

      {hasReliableOverallScore ? <ReportVisuals report={report} /> : null}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,2fr)_minmax(18rem,1fr)] lg:items-start">
        {hasReliableOverallScore ? (
          <section className="flex flex-col gap-7 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
            <div>
              <p className="eyebrow text-accent">Performance breakdown</p>
              <h2 className="mt-2 text-title text-ink">How you did</h2>
            </div>
            <CompetencyBars competencies={competencies} />
            <div className="rounded-xl bg-positive-wash px-5 py-4">
              <p className="font-mono text-micro tracking-widest text-positive uppercase">Interviewer note</p>
              <p className="mt-2 max-w-prose text-body text-ink">{report.summary}</p>
            </div>
          </section>
        ) : (
          <LimitedEvidencePanel
            assessableTurns={assessableTurns}
            hasGroundedCompetency={hasGroundedCompetency}
          />
        )}
        <ReportNextAction
          staff={staff}
          item={practicePlan[0] ?? null}
          recommendedNextSession={report.recommendedNextSession}
          answeredTurns={report.answeredTurns}
          assessableTurns={assessableTurns}
          assistedAnswers={report.assistance?.assistedAnswers ?? 0}
        />
      </div>

      {!detailed && !staff ? (
        <section className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-accent/20 bg-accent-wash px-5 py-5 sm:flex-row sm:items-center sm:px-6">
          <div>
            <h2 className="text-heading text-ink">Want the evidence behind every score?</h2>
            <p className="mt-1 max-w-2xl text-caption text-ink-muted">
              Open the answer-by-answer view for transcript quotes, rationale, communication feedback, and sources.
            </p>
          </div>
          <Link
            href={`/report/${report.sessionId}?detail=1`}
            className="shrink-0 rounded-lg border border-accent bg-surface-raised px-4 py-2 text-caption font-semibold text-accent-strong shadow-[var(--shadow-sm)] transition-colors hover:bg-accent hover:text-accent-contrast"
          >
            Read detailed report <span aria-hidden>→</span>
          </Link>
        </section>
      ) : null}

      {detailed ? (
        <>
      {report.assistance?.assistedAnswers > 0 ? <AssistancePanel assistance={report.assistance} /> : null}

      {practicePlan.length > 1 ? <PracticePlanPanel items={practicePlan.slice(1)} /> : null}

      <Section title="Competencies" lead="Each score is anchored to something you actually said.">
        {competencies.length === 0 ? (
          <p className="text-body text-ink-muted">
            No competency could be scored against evidence from this transcript. That usually means
            the answers were too brief to assess fairly.
          </p>
        ) : (
          <>
            <CompetencyBars competencies={competencies} />

            <ul className="flex flex-col gap-8 border-t border-line pt-8">
              {competencies.map((item) => {
                const percent = item.maxScore > 0 ? (item.score / item.maxScore) * 100 : 0;
                const band = bandFor(percent);
                const tone = TONE_STYLES[scoreToneForPercent(percent)];
                return (
                  <li key={item.competency} className={cn("flex flex-col gap-3 rounded-xl border-l-4 py-1 pl-5", tone.border)}>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                        <h3 className="text-heading text-ink">{item.competency}</h3>
                        {/*
                          * The band name in its traffic-light colour (owner, 29 October 2026:
                          * the report should read at a glance). The word is still there, so the
                          * colour is never the only signal.
                          */}
                        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 font-mono text-micro font-semibold tracking-widest uppercase", tone.wash, tone.text)}>
                          <span aria-hidden="true" className={cn("size-2 rounded-full", tone.fill)} />
                          {band.name}
                        </span>
                      </div>
                      <span className="shrink-0 font-mono text-caption tabular-nums text-ink-muted">
                        {item.score}/{item.maxScore}
                      </span>
                    </div>

                    {/*
                      * The quote first and large — task 053 calls it "the most valuable
                      * thing on the page" — and never behind the disclosure below. A test
                      * pins that down: `evidenceQuote` must render outside any `<details>`.
                      */}
                    <blockquote className="rounded-r-lg border-l-4 border-accent bg-accent-wash py-3 pl-5 text-body text-ink italic">
                      &ldquo;{item.evidenceQuote}&rdquo;
                    </blockquote>

                    <details className="group">
                      <summary className="flex cursor-pointer list-none items-center gap-1.5 text-caption font-medium text-ink-subtle marker:content-none hover:text-ink [&::-webkit-details-marker]:hidden">
                        <svg
                          aria-hidden="true"
                          viewBox="0 0 8 8"
                          className="h-2 w-2 shrink-0 fill-current transition-transform group-open:rotate-90"
                        >
                          <polygon points="0,0 8,4 0,8" />
                        </svg>
                        Why this score
                      </summary>
                      <p className="max-w-prose pt-2 text-body text-ink-muted">{item.rationale}</p>
                    </details>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </Section>

      {annotations.length > 0 ? (
        <Section
          title="Answer by answer"
          lead="Every question you were asked, and how you could have answered it better."
        >
          <ol className="flex flex-col gap-10">
            {annotations.map((note, index) => (
              <li
                key={`${note.turnIndex}-${index}`}
                className="flex flex-col gap-4 border-t border-line pt-8 first:border-0 first:pt-0"
              >
                <div className="flex flex-wrap items-baseline gap-3">
                  <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                    question {note.turnIndex + 1}
                  </span>
                </div>
                <p className="text-body font-medium text-ink">{note.question}</p>

                {/*
                  * The load-bearing part of this section, so it is the one thing that
                  * cannot be quiet: a candidate who reads nothing else on this page should
                  * still leave with this. Rendered even for an older stored report that
                  * has no note for this question — an honest "no note" beats the question
                  * silently vanishing from the list.
                  */}
                <div className="flex flex-col gap-2 rounded-lg border border-accent/30 bg-surface-raised p-5">
                  <span className="font-mono text-micro tracking-widest text-accent uppercase">
                    How you could have answered it better
                  </span>
                  <p className="max-w-prose text-body text-ink">
                    {note.strongerFraming ?? "No note was written for this answer."}
                  </p>
                </div>

                {note.worked || note.vague || note.wouldProbe ? (
                  <dl className="grid gap-3 sm:grid-cols-3">
                    <Note term="What worked" detail={note.worked} />
                    <Note term="What was vague" detail={note.vague} />
                    <Note term="Where they'd have probed" detail={note.wouldProbe} />
                  </dl>
                ) : null}
              </li>
            ))}
          </ol>
        </Section>
      ) : null}

      <Section title="How you came across" lead="Delivery, separately from content.">
        <dl className="grid gap-5 sm:grid-cols-2">
          <Note term="Structure" detail={report.communication.structure} />
          <Note term="Filler" detail={report.communication.fillerDensity} />
          <Note term="Pace" detail={report.communication.pace} />
          <Note term="Rambling" detail={report.communication.rambling} />
          <Note term="Not knowing an answer" detail={report.communication.handlingUncertainty} />
        </dl>
      </Section>

      <SpokenEnglishPanel spoken={report.spokenEnglish} />

      <AssessedAreas strengths={strengths} developmentAreas={developmentAreas} />

      <QuestionSources sources={report.questionSources} />

      <Section title="If this had been the real thing" lead="A simulation, not a verdict.">
        <div className="flex flex-col gap-3 rounded-xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] p-6">
          <div className="flex items-baseline gap-3">
            <span className="text-heading text-ink">{report.outcomeSimulation.label}</span>
            <span className="text-caption text-ink-subtle">{report.outcomeSimulation.likelihood}</span>
          </div>
          <p className="max-w-prose text-body text-ink-muted">{report.outcomeSimulation.reasoning}</p>
          <p className="pt-2 text-caption text-ink-subtle">
            This is a simulation based on one practice round. It is not a prediction, and no real
            employer has seen it.
          </p>
        </div>
      </Section>

      <footer className="flex flex-wrap items-center gap-4 rounded-2xl border border-accent/20 bg-accent-wash p-6 sm:p-8">
        {staff ? null : (
          <Link
            href="/interview/new"
            className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong"
          >
            Practise again
          </Link>
        )}
        <p className="text-caption text-ink-subtle">
          Recommended next: {report.recommendedNextSession}
        </p>
      </footer>
        </>
      ) : null}
    </article>
  );
}

/** The compact, factual strip from the visual reference — no invented hiring signal or benchmark. */
function ReportMetricStrip({
  headlineScore,
  headlineBand,
  assessableTurns,
  answeredTurns,
  assistance,
  strongestCompetency,
}: {
  headlineScore: number | null;
  headlineBand: string | null;
  assessableTurns: number;
  answeredTurns: number;
  assistance: ReportAssistance | undefined;
  strongestCompetency: ReportCompetency | null;
}) {
  const assisted = assistance?.assistedAnswers ?? 0;
  const metrics = [
    {
      label: "Overall",
      value: headlineScore === null ? "Not scored" : `${headlineScore}%`,
      note: headlineBand ?? "The evidence threshold was not met",
    },
    {
      label: "Evidence",
      value: `${assessableTurns} of ${answeredTurns}`,
      note: "answers were substantive enough to assess",
    },
    {
      label: "Help used",
      value: assisted === 0 ? "None recorded" : `${assisted} ${assisted === 1 ? "answer" : "answers"}`,
      note: assisted === 0 ? "No interviewer nudge is recorded" : "included interviewer assistance",
    },
    {
      label: "Strongest evidence",
      value: strongestCompetency?.competency ?? "Not established",
      note: strongestCompetency
        ? `${strongestCompetency.score}/${strongestCompetency.maxScore} on its anchored rubric`
        : "No grounded competency was available",
    },
  ];

  return (
    <dl className="grid overflow-hidden rounded-2xl border border-line bg-line shadow-[var(--shadow-sm)] sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <div key={metric.label} className="bg-surface-raised px-5 py-4">
          <dt className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{metric.label}</dt>
          <dd className="mt-2 text-heading font-semibold text-ink">{metric.value}</dd>
          <dd className="mt-1 text-micro leading-relaxed text-ink-subtle">{metric.note}</dd>
        </div>
      ))}
    </dl>
  );
}

function ReportNextAction({
  item,
  recommendedNextSession,
  answeredTurns,
  assessableTurns,
  assistedAnswers,
  staff,
}: {
  staff: boolean;
  item: ReportPracticeItem | null;
  recommendedNextSession: string;
  answeredTurns: number;
  assessableTurns: number;
  assistedAnswers: number;
}) {
  return (
    <aside className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-7 lg:sticky lg:top-24">
      <div>
        <p className="eyebrow text-accent">Next best action</p>
        <h2 className="mt-2 text-heading text-ink">{item?.focus ?? recommendedNextSession}</h2>
        <p className="mt-2 text-caption leading-relaxed text-ink-muted">
          {item?.why ?? "Use the next round to create enough evidence for a clearer comparison."}
        </p>
      </div>

      {item?.drill ? (
        <p className="rounded-xl bg-accent-wash px-4 py-3 text-caption leading-relaxed text-ink">{item.drill}</p>
      ) : null}

      {staff ? null : (
        <Link href="/interview/new" className="action-primary min-h-12 w-full px-5 text-body">
          Practise this focus
        </Link>
      )}

      <div className="border-t border-line pt-5">
        <h3 className="text-heading text-ink">Round details</h3>
        <dl className="mt-4 flex flex-col gap-3 text-caption">
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-subtle">Answers</dt>
            <dd className="font-mono text-ink">{answeredTurns}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-subtle">Assessable answers</dt>
            <dd className="font-mono text-ink">{assessableTurns}</dd>
          </div>
          <div className="flex items-center justify-between gap-4">
            <dt className="text-ink-subtle">Answers with help</dt>
            <dd className="font-mono text-ink">{assistedAnswers}</dd>
          </div>
        </dl>
      </div>
    </aside>
  );
}

function LimitedEvidencePanel({
  assessableTurns,
  hasGroundedCompetency,
}: {
  assessableTurns: number;
  hasGroundedCompetency: boolean;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-highlight/35 bg-highlight/10 p-6 shadow-[var(--shadow-sm)] sm:p-7">
      <p className="font-mono text-micro tracking-widest text-warning uppercase">Evidence check</p>
      <h2 className="text-title text-ink">No overall score yet</h2>
      <p className="max-w-prose text-body text-ink-muted">
        {!hasGroundedCompetency
          ? "No competency score could be tied to a verified quote from your answers, so showing a percentage would misrepresent the evidence."
          : assessableTurns === 0
            ? "The round did not reach a substantive answer, so a percentage would be invented precision."
            : "One substantive answer is not enough to turn into a credible interview percentage. The answer-specific feedback below is still useful, but it is not a readiness score."}
      </p>
      <p className="text-caption font-medium text-ink">
        Complete at least two substantive questions before treating the result as a trend.
      </p>
    </section>
  );
}

/**
 * How much the interviewer stepped in.
 *
 * Shown high in the report and stated plainly, because a candidate who was hinted to the
 * answer deserves to know that is what happened — a report that quietly folds assisted
 * answers into the same score as unaided ones is flattering them into a real rejection.
 */
function AssistancePanel({ assistance }: { assistance: ReportAssistance }) {
  const breakdown = assistance.breakdown ?? [];
  const moments = assistance.moments ?? [];

  return (
    <section
      aria-labelledby="assistance"
      className="flex flex-col gap-4 rounded-2xl border border-highlight/35 bg-highlight/10 p-6 shadow-[var(--shadow-sm)] sm:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="assistance" className="text-heading text-ink">
          Where you needed a hand
        </h2>
        <p className="text-caption text-ink-subtle">{assistance.headline}</p>
      </div>

      {breakdown.length > 0 ? (
        <ul className="flex flex-wrap gap-x-6 gap-y-2">
          {breakdown.map((item) => (
            <li key={item.label} className="text-caption text-ink-muted">
              {item.label}
              <span className="pl-2 font-mono text-ink-subtle">×{item.count}</span>
            </li>
          ))}
        </ul>
      ) : null}

      {assistance.narrative ? (
        <p className="max-w-prose text-body text-ink-muted">{assistance.narrative}</p>
      ) : null}

      {moments.length > 0 ? (
        <ul className="flex flex-col gap-1.5 border-t border-line pt-4">
          {moments.map((moment) => (
            <li key={moment} className="text-caption text-ink-subtle">
              — {moment}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}

/**
 * What to do next, given the same visual weight as the score.
 *
 * Task 053: "what to do next" was a numbered list near the bottom of a long page, after
 * everything else had already asked for the candidate's attention — the opposite of what
 * task 048 built it for. It moves up beside the score and the assistance panel, in the
 * same bordered-card language, on the theory that a candidate who reads nothing else on
 * this page should still leave with a drill in hand.
 */
function PracticePlanPanel({ items }: { items: ReportPracticeItem[] }) {
  return (
    <section
      aria-labelledby="practice-plan"
      className="flex flex-col gap-5 rounded-2xl border border-accent/25 bg-accent-wash p-6 shadow-[var(--shadow-sm)] sm:p-7"
    >
      <div className="flex flex-col gap-1">
        <h2 id="practice-plan" className="text-heading text-ink">
          Do this before your next attempt
        </h2>
        <p className="text-caption text-ink-subtle">In this order — each one earns the next.</p>
      </div>

      <ol className="flex flex-col gap-5">
        {items.map((item, index) => (
          <li key={item.focus} className="flex gap-4">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-accent-wash font-mono text-caption font-medium text-accent-strong">
              {index + 1}
            </span>
            <div className="flex flex-col gap-1 pt-0.5">
              <h3 className="text-body font-medium text-ink">{item.focus}</h3>
              <p className="max-w-prose text-body text-ink-muted">{item.why}</p>
              <p className="max-w-prose text-caption text-ink-subtle">{item.drill}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * What held up and what did not, beside each other rather than forty lines apart.
 *
 * They used to be two sections in sequence, which meant the strengths were read, then
 * scrolled past, then the weaknesses were read on their own — and a page of weaknesses
 * with the good news off screen is a harsher report than the one that was written. Set
 * side by side they read as the single assessment they are, and the two column rules do
 * the telling apart without either list having to shout.
 *
 * Both columns are rendered whenever either has anything in it, empty one included. An
 * absent column would silently turn a split into a verdict — a candidate seeing only the
 * right-hand list has no way to know whether the left was empty or was never drawn.
 */
function AssessedAreas({
  strengths,
  developmentAreas,
}: {
  strengths: ReportAssessedArea[];
  developmentAreas: ReportAssessedArea[];
}) {
  if (strengths.length === 0 && developmentAreas.length === 0) return null;

  return (
    <Section
      title="What held up, and what did not"
      lead="Named plainly, because a soft report is a real rejection later."
    >
      <div className="grid gap-10 lg:grid-cols-2 lg:gap-12">
        <AreaColumn
          heading="What held up"
          tone="positive"
          areas={strengths}
          empty="Nothing in this round could be quoted as a strength. That is a finding about the round, not about you — a short answer leaves nothing to point at."
        />
        <AreaColumn
          heading="What did not"
          tone="critical"
          areas={developmentAreas}
          empty="Nothing in this round was weak enough to name against a quote."
        />
      </div>
    </Section>
  );
}

/**
 * One side of the split: what it was, the words that show it, why it matters at this
 * level, and one thing to do. The quote is the load-bearing part — anything without one
 * was dropped server-side before it reached here.
 */
function AreaColumn({
  heading,
  tone,
  areas,
  empty,
}: {
  heading: string;
  tone: "positive" | "critical";
  areas: ReportAssessedArea[];
  empty: string;
}) {
  const rule = tone === "positive" ? "border-positive" : "border-danger";
  const wash = tone === "positive" ? "bg-positive-wash" : "bg-danger-wash";
  const mark = tone === "positive" ? "bg-positive" : "bg-danger";

  return (
    <section aria-label={heading} className={cn("flex flex-col gap-5 rounded-xl p-5", wash)}>
      <div className={cn("flex items-baseline justify-between gap-3 border-t-2 pt-3", rule)}>
        <h3 className="flex items-center gap-2 text-heading text-ink">
          <span aria-hidden="true" className={cn("grid size-6 place-items-center rounded-full text-micro font-bold text-surface-raised", mark)}>
            {tone === "positive" ? "✓" : "!"}
          </span>
          {heading}
        </h3>
        <span className="shrink-0 font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {areas.length} {areas.length === 1 ? "thing" : "things"}
        </span>
      </div>

      {areas.length === 0 ? (
        <p className="max-w-prose text-body text-ink-muted">{empty}</p>
      ) : (
        <ul className="flex flex-col divide-y divide-line">
          {areas.map((item) => (
            <li key={item.area} className="flex flex-col gap-3 py-5 first:pt-0 last:pb-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <h4 className="text-body font-medium text-ink">{item.area}</h4>
                {item.turnIndex !== null ? (
                  <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                    question {item.turnIndex + 1}
                  </span>
                ) : null}
              </div>

              <blockquote className={cn("border-l-2 pl-4 text-body text-ink-muted italic", rule)}>
                &ldquo;{item.evidenceQuote}&rdquo;
              </blockquote>

              <dl className="flex flex-col gap-3">
                <Note term="Why it matters" detail={item.whyItMatters} />
                <Note term="What to do" detail={item.whatToDo} />
              </dl>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/**
 * Where the questions came from.
 *
 * The disclosure is not a footnote to be tucked away — it is the reason this section can
 * be believed. Only a question the server matched to the question bank carries `sources`
 * and the `published_source` tier; follow-ups and model-written questions say they are
 * general knowledge, and the page says which is which before it shows anything else. A
 * candidate who reads "asked at Google in March", checks, and finds nothing will never
 * trust this report again, and they would be right.
 */
function QuestionSources({ sources }: { sources: ReportQuestionSources | undefined }) {
  // A report written before provenance existed has no sources section at all.
  const entries = sources?.entries ?? [];
  if (!sources || entries.length === 0) return null;

  return (
    <Section title="Why you were asked these" lead={sources.headline}>
      <p className="max-w-prose rounded-lg border border-line bg-surface-sunken p-4 text-caption text-ink-muted">
        {sources.disclosure}
      </p>

      <ol className="flex flex-col divide-y divide-line border-y border-line">
        {entries.map((entry) => (
          <li key={entry.turnIndex} className="flex flex-col gap-3 py-6">
            <div className="flex flex-wrap items-baseline gap-3">
              <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                question {entry.turnIndex + 1}
              </span>
              {entry.phase === "warmup" ? (
                <span className="pill pill-accent">warm-up</span>
              ) : null}
            </div>

            <p className="max-w-prose text-body text-ink">{entry.question}</p>

            <dl className="grid gap-3 sm:grid-cols-2">
              <Note term="What it was testing" detail={entry.probes} />
              <Note term="Why you got it" detail={entry.askedBecause} />
            </dl>

            <div className="flex flex-col gap-1 border-l-2 border-line-strong pl-4">
              <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
                Basis
              </span>
              {/* A pool question has no basis beside its label, which arrives as the disclosure. */}
              {entry.basis ? <p className="max-w-prose text-caption text-ink-muted">{entry.basis}</p> : null}
              <p className="max-w-prose text-caption text-ink-subtle">{entry.tierDisclosure}</p>
            </div>

            {(entry.sources ?? []).length > 0 ? (
              <ul className="flex flex-col gap-1 pl-4">
                {entry.sources.map((source) => (
                  <li key={`${source.title}-${source.url ?? ""}`} className="text-caption text-ink-muted">
                    {source.url ? (
                      <a
                        href={source.url}
                        target="_blank"
                        rel="noreferrer noopener"
                        className="text-accent underline-offset-4 hover:underline"
                      >
                        {source.title}
                      </a>
                    ) : (
                      source.title
                    )}
                    {source.publisher ? ` · ${source.publisher}` : ""}
                    {source.year ? ` · ${source.year}` : ""}
                  </li>
                ))}
              </ul>
            ) : null}
          </li>
        ))}
      </ol>
    </Section>
  );
}

function Section({
  title,
  lead,
  children,
}: {
  title: string;
  lead: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-6 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
      <div className="flex flex-col gap-1">
        <h2 className="text-title text-ink">{title}</h2>
        <p className="text-caption text-ink-subtle">{lead}</p>
      </div>
      {children}
    </section>
  );
}

function Note({ term, detail }: { term: string; detail: string | null }) {
  if (!detail) return null;
  return (
    <div className="flex flex-col gap-1">
      <dt className="text-caption text-ink-subtle">{term}</dt>
      <dd className="text-body text-ink-muted">{detail}</dd>
    </div>
  );
}
