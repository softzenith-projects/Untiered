"use client";

import type { EntitlementView, MeResponse, ReadinessGroup, SessionSummary } from "@untiered/shared";
import type { Route } from "next";
import Link from "next/link";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

import { DailyLimitNotice, isDailyLimitReached } from "@/components/daily-limit-notice";
import { deleteSession, fetchEntitlement, fetchMe, fetchProfile, fetchReadiness, fetchSessions, SESSION_PAGE_SIZE } from "@/lib/api";
import { featureEnabled } from "@/lib/flags";
import { useAccessToken } from "@/lib/use-access-token";

/**
 * The dashboard's job is to start the next interview, so there is one primary action and
 * nothing competing with it. History and readiness sit below, as evidence rather than
 * as scores to collect.
 *
 * The composition was the thing wrong with it. Everything was set within one step of
 * `text-body`, in a single 768px column pinned to the left of the window, so the most
 * consequential number on the page — how a candidate is actually doing — was rendered in
 * the smallest type on it, and the right-hand half of the screen held nothing. That is
 * not restraint; restraint is a decision about what to leave out, and this was an absence
 * of decisions. There is a real scale now, and the page is composed across the width it
 * has: the score is the largest thing here after the heading, because it is the most
 * important thing here after the heading.
 */
export function DashboardPanel() {
  const { visible, handleDelete } = useRoundData();

  if (!visible.loaded) {
    return <DashboardLoadingState />;
  }

  return (
    <DashboardView
      entitlement={visible.entitlement}
      me={visible.me}
      sessions={visible.sessions}
      readiness={visible.readiness}
      loaded={visible.loaded}
      resumeUploaded={visible.resumeUploaded}
      onDelete={handleDelete}
    />
  );
}

/**
 * The first authenticated paint keeps the final page's geometry without briefly showing
 * made-up allowance copy or a nameless greeting. Data replaces this once, as a whole.
 */
export function DashboardLoadingState() {
  return (
    <div role="status" aria-label="Loading your dashboard" className="flex flex-col gap-9 md:gap-11">
      <div className="flex animate-pulse flex-col gap-4" aria-hidden="true">
        <div className="h-3 w-44 rounded-full bg-accent/15" />
        <div className="h-14 w-full max-w-2xl rounded-2xl bg-surface-sunken" />
        <div className="h-5 w-full max-w-xl rounded-full bg-surface-sunken" />
      </div>
      <div className="hero-band min-h-44 animate-pulse px-6 py-7 sm:px-9 sm:py-8" aria-hidden="true">
        <div className="grid gap-7 lg:grid-cols-2 lg:gap-14">
          <div className="space-y-4">
            <div className="h-3 w-32 rounded-full bg-on-navy/15" />
            <div className="h-9 w-full max-w-lg rounded-xl bg-on-navy/12" />
            <div className="h-4 w-full max-w-xl rounded-full bg-on-navy/10" />
          </div>
          <div className="space-y-5">
            <div className="h-5 rounded-full bg-on-navy/10" />
            <div className="h-5 rounded-full bg-on-navy/10" />
          </div>
        </div>
      </div>
      <span className="sr-only">Loading your dashboard…</span>
    </div>
  );
}

/**
 * Every round, on its own page. The dashboard shows only the latest few so starting the
 * next interview stays the first thing on it; this is where the rest live, with the same
 * report links and the same delete.
 */
export function RoundHistoryPanel() {
  const { visible, handleDelete, loadMore } = useRoundData();

  if (!visible.loaded) {
    return <p className="text-body text-ink-muted">Loading your rounds…</p>;
  }
  if (visible.sessions.length === 0 && !visible.hasMore) {
    const mockInterviewsEnabled = featureEnabled("mockInterviews");
    return (
      <div className="flex flex-col items-start gap-4 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)]">
        <p className="text-body text-ink-muted">No rounds yet. Your finished interviews will be listed here.</p>
        {mockInterviewsEnabled ? (
          <Link
            href="/interview/new"
            className="rounded-lg bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            Start an interview
          </Link>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-5">
      <PastRoundsSection sessions={visible.sessions} onDelete={handleDelete} />
      {visible.hasMore ? (
        <button
          type="button"
          onClick={() => void loadMore()}
          disabled={visible.loadingMore}
          className="action-secondary self-center disabled:cursor-wait disabled:opacity-60"
        >
          {visible.loadingMore ? "Loading more rounds…" : "Load more rounds"}
        </button>
      ) : null}
      {visible.loadError ? (
        <p role="alert" className="text-center text-caption text-warning">
          More rounds could not be loaded. Please try again.
        </p>
      ) : null}
    </div>
  );
}

/**
 * The last dashboard this tab loaded. The panel mounts afresh on every visit, and without
 * this each return to the dashboard showed the loading state until four API calls came
 * back. Now the previous data paints on the first frame and is replaced when the refetch
 * lands. Keyed to the token that fetched it, memory only, and cleared on sign-out — the
 * same rules as the account block's cache.
 */
let lastDashboard: DashboardState | null = null;

/** Drops the remembered dashboard; called with the rest of the account caches on sign-out. */
export function forgetDashboard(): void {
  lastDashboard = null;
}

/** Sessions, entitlement and readiness for the signed-in account, plus round deletion. */
function useRoundData() {
  const accessToken = useAccessToken();
  const [dashboard, setDashboard] = useState<DashboardState>(() =>
    lastDashboard && accessToken && lastDashboard.ownerToken === accessToken ? lastDashboard : emptyDashboard(null),
  );
  const loadingToken = useRef<string | null>(null);

  useEffect(() => {
    if (dashboard.loaded) lastDashboard = { ...dashboard, loadingMore: false, loadError: false };
  }, [dashboard]);

  // Identity changes are visible during render, before effects run. Never render data
  // whose owner is the token from a previous render, even for a single frame.
  const visible =
    typeof accessToken === "string" && dashboard.ownerToken === accessToken
      ? dashboard
      : emptyDashboard(accessToken ?? null);

  // No reset here: `visible` already hides anything another token fetched, so clearing
  // state on a token change would only add a render.
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const mockInterviewsEnabled = featureEnabled("mockInterviews");
    const reportsEnabled = featureEnabled("reports");

    // Readiness can take longer as an account accumulates reports. It enriches the page,
    // but must not hold the greeting and next-round action behind that work.
    Promise.allSettled([
      mockInterviewsEnabled ? fetchEntitlement({ accessToken }) : Promise.resolve(null),
      mockInterviewsEnabled || reportsEnabled ? fetchSessions({ accessToken }) : Promise.resolve([]),
      fetchMe({ accessToken }),
      // Only the first-run checklist reads this, to tick "Upload your resume" from fact.
      mockInterviewsEnabled ? fetchProfile({ accessToken }) : Promise.resolve(null),
    ]).then(([ent, list, candidate, profile]) => {
      if (!active) return;
      const sessions = list.status === "fulfilled" ? list.value : [];
      setDashboard((current) => ({
        ownerToken: accessToken,
        entitlement: ent.status === "fulfilled" ? ent.value : null,
        me: candidate.status === "fulfilled" ? candidate.value : null,
        resumeUploaded: profile.status === "fulfilled" && profile.value ? profile.value.resume !== null : null,
        sessions,
        nextOffset: sessions.length,
        hasMore: sessions.length === SESSION_PAGE_SIZE,
        loadingMore: false,
        loadError: false,
        readiness: current.ownerToken === accessToken ? current.readiness : [],
        loaded: true,
      }));
    });

    if (reportsEnabled) {
      fetchReadiness({ accessToken })
        .then((readiness) => {
          if (!active) return;
          setDashboard((current) =>
            current.ownerToken === accessToken
              ? { ...current, readiness }
              : { ...emptyDashboard(accessToken), readiness },
          );
        })
        .catch(() => {
          // A failed readiness request must not hold the next interview action.
        });
    }

    return () => {
      active = false;
    };
  }, [accessToken]);

  /**
   * Deleting a round is irreversible on the server, so it is reflected here rather than
   * refetched: the row goes the moment the request succeeds, and a failure is raised to
   * the row that asked for it. Readiness *is* refetched, because it is derived from the
   * reports that just stopped existing — the grouping and the averages are the server's
   * arithmetic and recomputing them here would be a second implementation of it.
   */
  const handleDelete = useCallback(
    async (id: string) => {
      if (!accessToken) return;
      const operationToken = accessToken;
      await deleteSession(operationToken, id);
      setDashboard((current) =>
        current.ownerToken === operationToken
          ? {
              ...current,
              sessions: current.sessions.filter((session) => session.id !== id),
              nextOffset: current.nextOffset - Number(current.sessions.some((session) => session.id === id)),
            }
          : current,
      );
      try {
        const nextReadiness = await fetchReadiness({ accessToken: operationToken });
        setDashboard((current) =>
          current.ownerToken === operationToken
            ? { ...current, readiness: nextReadiness }
            : current,
        );
      } catch {
        // The deletion itself succeeded. Leaving the previous readiness on screen makes
        // it briefly stale, which is a far smaller lie than reporting a failed delete.
      }
    },
    [accessToken],
  );

  const loadMore = useCallback(async () => {
    if (
      !accessToken ||
      !visible.loaded ||
      !visible.hasMore ||
      visible.loadingMore ||
      loadingToken.current === accessToken
    ) return;
    const operationToken = accessToken;
    const offset = visible.nextOffset;
    loadingToken.current = operationToken;
    setDashboard((current) =>
      current.ownerToken === operationToken
        ? { ...current, loadingMore: true, loadError: false }
        : current,
    );
    try {
      const page = await fetchSessions({ accessToken: operationToken }, { limit: SESSION_PAGE_SIZE, offset });
      setDashboard((current) => {
        if (current.ownerToken !== operationToken) return current;
        const existing = new Set(current.sessions.map((session) => session.id));
        return {
          ...current,
          sessions: [...current.sessions, ...page.filter((session) => !existing.has(session.id))],
          nextOffset: offset + page.length,
          hasMore: page.length === SESSION_PAGE_SIZE,
          loadingMore: false,
        };
      });
    } catch {
      setDashboard((current) =>
        current.ownerToken === operationToken
          ? { ...current, loadingMore: false, loadError: true }
          : current,
      );
    } finally {
      if (loadingToken.current === operationToken) loadingToken.current = null;
    }
  }, [accessToken, visible]);

  return { visible, handleDelete, loadMore };
}

interface DashboardState {
  ownerToken: string | null;
  entitlement: EntitlementView | null;
  me: MeResponse | null;
  resumeUploaded: boolean | null;
  sessions: SessionSummary[];
  nextOffset: number;
  hasMore: boolean;
  loadingMore: boolean;
  loadError: boolean;
  readiness: ReadinessGroup[];
  loaded: boolean;
}

function emptyDashboard(ownerToken: string | null): DashboardState {
  return {
    ownerToken,
    entitlement: null,
    me: null,
    resumeUploaded: null,
    sessions: [],
    nextOffset: 0,
    hasMore: false,
    loadingMore: false,
    loadError: false,
    readiness: [],
    loaded: false,
  };
}

/**
 * The dashboard as pure markup over data it is handed.
 *
 * Split out from the fetching so it can be rendered from a test or a preview with whatever
 * history you want to look at. A page that can only be seen by signing in, finishing a
 * round and waiting for a report is a page whose layout never actually gets checked — and
 * this one had gone a long way wrong without anybody being able to see it.
 *
 * The navy band changes with where the candidate is. Before a first finished round it is
 * a checklist ticked from real data, plus one-click starts; after, it names the next round
 * from their own history. The allowance used to hold this band, and a quota is the least
 * useful thing to show somebody who has not yet seen what the product does.
 */
export function DashboardView({
  entitlement,
  me = null,
  sessions,
  readiness,
  loaded,
  resumeUploaded = null,
  onDelete,
}: {
  entitlement: EntitlementView | null;
  me?: MeResponse | null;
  sessions: SessionSummary[];
  readiness: ReadinessGroup[];
  loaded: boolean;
  /** Null when unknown — the profile could not be read, or has not been yet. */
  resumeUploaded?: boolean | null;
  onDelete?: (id: string) => Promise<void>;
}) {
  const mockInterviewsEnabled = featureEnabled("mockInterviews");
  const reportsEnabled = featureEnabled("reports");
  const coursesEnabled = featureEnabled("courses");
  const arenaEnabled = featureEnabled("arena");
  const visibleSessions = reportsEnabled ? sessions : [];
  const visibleReadiness = reportsEnabled ? readiness : [];
  const openSessionId = mockInterviewsEnabled ? findOpenSessionId(entitlement, sessions) : null;
  const primaryHref = (openSessionId ? `/interview/${openSessionId}` : "/interview/new") as Route;
  const primaryLabel = openSessionId ? "Resume interview" : "Start an interview";
  const disabled = !openSessionId && entitlement?.allowed === false;
  const canStart = !openSessionId && !disabled;
  const completed = sessions.filter((s) => s.status === "completed");
  const lastCompleted = completed[0];
  const { greeting, dateLabel } = useTimeBoundGreeting();
  const firstName = formatFirstName(me?.displayName);

  return (
    <div className="flex flex-col gap-9 md:gap-11">
      {mockInterviewsEnabled ? (
        <>
          <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="eyebrow text-accent">{dateLabel}</p>
              <h1 id="next-interview" className="mt-2 max-w-3xl text-display text-balance text-ink">
                {greeting}{firstName ? `, ${firstName}` : ""}.
              </h1>
              <p className="mt-2 max-w-2xl text-body text-ink-muted">{headerLine(openSessionId, lastCompleted)}</p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-end">
              <Link
                href={primaryHref}
                aria-disabled={disabled}
                className={`action-primary min-h-12 px-6 text-body ${disabled ? "pointer-events-none opacity-50" : ""}`}
              >
                {primaryLabel} <span aria-hidden>→</span>
              </Link>
              <AllowanceLine entitlement={entitlement} loaded={loaded} />
            </div>
          </header>

          {loaded && entitlement && isDailyLimitReached(entitlement) ? (
            <DailyLimitNotice entitlement={entitlement} />
          ) : null}

          {lastCompleted ? (
            <NextRound last={lastCompleted} readiness={visibleReadiness} canStart={canStart} reportsEnabled={reportsEnabled} />
          ) : (
            <>
              <GettingStarted resumeUploaded={resumeUploaded} primaryHref={primaryHref} resuming={openSessionId !== null} />
              {canStart ? <QuickStart /> : null}
            </>
          )}
        </>
      ) : (
        <header className="hero-band flex flex-col items-start gap-5 px-7 py-9 sm:px-10">
          <p className="eyebrow text-accent-on-navy">Your learning workspace</p>
          <h1 className="max-w-3xl text-display text-balance text-on-navy">Keep moving one focused step at a time.</h1>
          <p className="max-w-2xl text-body text-on-navy-muted">Continue a learning path or sharpen recall with a short Arena session.</p>
          {coursesEnabled || arenaEnabled ? (
            <Link href={(coursesEnabled ? "/courses" : "/arena") as Route} className="action-primary">
              {coursesEnabled ? "Continue learning" : "Open the Arena"} <span aria-hidden>→</span>
            </Link>
          ) : null}
        </header>
      )}

      {visibleSessions.length > 0 || visibleReadiness.length > 0 ? (
        <div className="grid gap-7 lg:grid-cols-[minmax(0,1.55fr)_minmax(0,1fr)]">
          {visibleSessions.length > 0 ? (
            <PastRoundsSection sessions={visibleSessions} onDelete={onDelete} limit={DASHBOARD_ROUNDS} />
          ) : null}

          {visibleReadiness.length > 0 ? (
            <section aria-labelledby="readiness" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
              <SectionHead title="Where you stand" id="readiness" note="Readiness by goal" />
              <ul className="flex flex-col gap-3">
                {visibleReadiness.slice(0, DASHBOARD_READINESS_GROUPS).map((group) => (
                  <li
                    key={`${group.companyName}-${group.roleTitle}`}
                    className="flex flex-col gap-3 rounded-xl bg-surface-sunken/75 px-4 py-4"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <span className="text-body text-ink">
                        {group.companyName}
                        <span className="block text-caption text-ink-subtle">{group.roleTitle}</span>
                      </span>
                      {group.latestAverageScore !== null ? (
                        <span className="flex shrink-0 items-baseline font-mono text-display leading-none tabular-nums text-ink">
                          {group.latestAverageScore}
                          <span className="pl-0.5 text-caption text-ink-subtle">%</span>
                        </span>
                      ) : null}
                    </div>
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-t border-line pt-2">
                      <span className="text-caption text-ink-subtle">
                        {group.sessionsCompleted}{" "}
                        {group.sessionsCompleted === 1 ? "attempt" : "attempts"}
                      </span>
                      {group.latestAverageScore !== null ? (
                        <Trend first={group.firstAverageScore} latest={group.latestAverageScore} />
                      ) : null}
                    </div>
                    {group.recurringWeaknesses.length > 0 ? (
                      <p className="text-caption text-ink-muted">
                        <span className="text-ink-subtle">Recurring: </span>
                        {group.recurringWeaknesses.join(", ")}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
              {visibleReadiness.length > DASHBOARD_READINESS_GROUPS ? (
                <Link
                  href="/history"
                  className="self-start rounded-sm text-caption font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
                >
                  See all reports
                </Link>
              ) : null}
            </section>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * The round that blocks a new one. The server's answer wins when it gave one: it counts a
 * `created` round as open too, and it is still right when the session list failed to load,
 * which is how a candidate once saw "in progress" beside a disabled Start and no way back.
 */
export function findOpenSessionId(entitlement: EntitlementView | null, sessions: SessionSummary[]): string | null {
  if (entitlement?.openSessionId !== undefined) return entitlement.openSessionId;
  return sessions.find((s) => s.status === "in_progress" || s.status === "created")?.id ?? null;
}

function headerLine(openSessionId: string | null, lastCompleted: SessionSummary | undefined): string {
  if (openSessionId) return "You have a round in progress. Pick it up where you left off.";
  if (!lastCompleted) return "Pick a company and role, answer out loud, and get a report on what to work on.";
  return `Your last round was ${lastCompleted.companyName} · ${lastCompleted.roleTitle}.`;
}

/**
 * Today's allowance as one line under the action it limits. Said only while a daily limit
 * is active and practice remains: a used-up day has its own notice, and an open round is
 * answered by the Resume button.
 */
function AllowanceLine({ entitlement, loaded }: { entitlement: EntitlementView | null; loaded: boolean }) {
  if (!loaded || !entitlement?.allowed) return null;
  if (entitlement.dailyRoundLimit === null && entitlement.dailyMinuteLimit === null) return null;
  return <p className="text-caption text-ink-subtle sm:text-right">{entitlement.message}</p>;
}

interface StartStep {
  label: string;
  detail: string;
  done: boolean;
  href?: Route;
  action?: string;
}

/**
 * The first-run checklist. Every tick is read from the account, never from a click on the
 * checklist itself, so it cannot claim a step the candidate has not taken. It only shows
 * before a first finished round, so the last two steps are never done here.
 */
function GettingStarted({
  resumeUploaded,
  primaryHref,
  resuming,
}: {
  resumeUploaded: boolean | null;
  primaryHref: Route;
  resuming: boolean;
}) {
  const steps: StartStep[] = [
    { label: "Create your account", detail: "Signed in and ready.", done: true },
    {
      label: "Upload your resume",
      detail: "So the interviewer can ask about your own projects.",
      done: resumeUploaded === true,
      href: "/profile#resume" as Route,
      action: "Upload resume",
    },
    {
      label: "Take your first mock interview",
      detail: "Pick a company and role, then answer out loud in your browser.",
      done: false,
      href: primaryHref,
      action: resuming ? "Resume interview" : "Start interview",
    },
    {
      label: "Read your feedback report",
      detail: "Each score is tied to something you actually said.",
      done: false,
    },
  ];
  const doneCount = steps.filter((step) => step.done).length;
  const nextIndex = steps.findIndex((step) => !step.done);

  return (
    <section aria-labelledby="getting-started" className="hero-band overflow-hidden px-6 py-7 sm:px-9 sm:py-8">
      <div className="grid gap-7 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
        <div>
          <p className="eyebrow text-accent-on-navy">Getting started</p>
          <h2 id="getting-started" className="mt-3 text-title text-on-navy">
            Get interview-ready in four steps.
          </h2>
          <p className="mt-2 text-caption text-on-navy-muted">
            {doneCount} of {steps.length} done
          </p>
          <div
            role="progressbar"
            aria-label="Getting started progress"
            aria-valuemin={0}
            aria-valuemax={steps.length}
            aria-valuenow={doneCount}
            className="mt-3 h-1.5 max-w-xs overflow-hidden rounded-full bg-on-navy/15"
          >
            <span className="block h-full rounded-full bg-positive" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
          </div>
        </div>

        <ol className="flex flex-col gap-3">
          {steps.map((step, index) => (
            <li
              key={step.label}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 rounded-xl px-4 py-3 ${index === nextIndex ? "bg-on-navy/12" : "bg-on-navy/5"}`}
            >
              <span
                aria-hidden
                className={`grid size-8 shrink-0 place-items-center rounded-full text-caption font-bold ${step.done ? "bg-positive text-positive-contrast" : "border border-on-navy/30 text-on-navy"}`}
              >
                {step.done ? (
                  <svg viewBox="0 0 24 24" className="size-4 fill-none stroke-current stroke-[3]">
                    <polyline points="5,13 10,18 19,7" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                ) : (
                  index + 1
                )}
              </span>
              <div className="min-w-0 flex-1">
                <p className={`text-body font-semibold ${step.done ? "text-on-navy-muted" : "text-on-navy"}`}>
                  {step.label}
                  <span className="sr-only">{step.done ? " — done" : " — to do"}</span>
                </p>
                <p className="text-caption text-on-navy-muted">{step.detail}</p>
              </div>
              {!step.done && step.href && step.action ? (
                <Link
                  href={step.href}
                  className={`${index === nextIndex ? "action-primary" : "action-on-dark"} shrink-0 px-4 py-2 text-caption`}
                >
                  {step.action}
                </Link>
              ) : null}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

/**
 * Pairings that open the setup form already filled in. They are a shortcut, not a claim:
 * the names say nothing about how these employers interview, and the round is still the
 * candidate's choice on the next screen. The spread is deliberate — product, services and
 * a non-engineering function — because that coverage is the product.
 */
export const QUICK_STARTS: readonly { company: string; role: string }[] = [
  { company: "Google", role: "Software Engineer" },
  { company: "Amazon", role: "SDE" },
  { company: "Microsoft", role: "Software Engineer" },
  { company: "TCS", role: "Software Engineer" },
  { company: "Infosys", role: "Systems Engineer" },
  { company: "Deloitte", role: "Business Analyst" },
];

export function quickStartHref(company: string, role: string): Route {
  return `/interview/new?${new URLSearchParams({ company, role }).toString()}` as Route;
}

function QuickStart() {
  return (
    <section aria-labelledby="quick-start" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <div className="flex flex-col gap-1">
        <h2 id="quick-start" className="text-heading text-ink">Quick start</h2>
        <p className="text-caption text-ink-muted">Pick one to fill in the setup. You choose the round on the next screen.</p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {QUICK_STARTS.map(({ company, role }) => (
          <li key={`${company}-${role}`}>
            <Link
              href={quickStartHref(company, role)}
              className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-4 py-3 transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:border-accent/40 hover:shadow-[var(--shadow-md)]"
            >
              <span className="min-w-0">
                <span className="block truncate text-body font-semibold text-ink">{company}</span>
                <span className="block truncate text-caption text-ink-subtle">{role}</span>
              </span>
              <span aria-hidden className="text-accent">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * After a first finished round, the band names the next one from the candidate's own
 * history: the latest company and role, and what their reports keep flagging there.
 */
function NextRound({
  last,
  readiness,
  canStart,
  reportsEnabled,
}: {
  last: SessionSummary;
  readiness: ReadinessGroup[];
  canStart: boolean;
  reportsEnabled: boolean;
}) {
  const group = readiness.find((g) => g.companyName === last.companyName && g.roleTitle === last.roleTitle);
  const weaknesses = group?.recurringWeaknesses ?? [];
  const score = group?.latestAverageScore ?? null;
  const reportHref = reportsEnabled && last.hasReport && !last.reportExpired ? (`/report/${last.id}` as Route) : null;

  let summary = "Run it again to see what changes between attempts.";
  if (weaknesses.length > 0) {
    summary = `Your reports keep flagging ${weaknesses.slice(0, 3).join(", ")}. Another round shows whether that has moved.`;
  } else if (group && score !== null) {
    summary = `Latest score ${score}% over ${group.sessionsCompleted} ${group.sessionsCompleted === 1 ? "attempt" : "attempts"}. Run it again to see what changes.`;
  }

  return (
    <section aria-labelledby="next-round" className="hero-band overflow-hidden px-6 py-7 sm:px-9 sm:py-8">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between lg:gap-14">
        <div className="min-w-0">
          <p className="eyebrow text-accent-on-navy">Your next round</p>
          <h2 id="next-round" className="mt-3 text-title text-on-navy">
            {last.companyName} · {last.roleTitle}
          </h2>
          <p className="mt-2 max-w-2xl text-body text-on-navy-muted">{summary}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-3">
          {canStart ? (
            <Link href={quickStartHref(last.companyName, last.roleTitle)} className="action-primary px-5">
              Practise again <span aria-hidden>→</span>
            </Link>
          ) : null}
          {reportHref ? (
            <Link href={reportHref} className="action-on-dark px-5">
              Read last report
            </Link>
          ) : null}
        </div>
      </div>
    </section>
  );
}

/** Browser-local greeting, refreshed so a dashboard left open crosses day-parts correctly. */
function useTimeBoundGreeting(): { greeting: string; dateLabel: string } {
  const [greeting, setGreeting] = useState("Welcome back");
  const [dateLabel, setDateLabel] = useState("Your practice workspace");

  useLayoutEffect(() => {
    const update = () => {
      const now = new Date();
      setGreeting(greetingForHour(now.getHours()));
      setDateLabel(formatLocalDate(now));
    };
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  return { greeting, dateLabel };
}

export function greetingForHour(hour: number): string {
  if (hour < 5) return "Good night";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  if (hour < 21) return "Good evening";
  return "Good night";
}

export function formatFirstName(displayName?: string | null): string | null {
  const firstName = displayName?.trim().split(/\s+/)[0];
  if (!firstName) return null;
  return firstName.charAt(0).toLocaleUpperCase() + firstName.slice(1);
}

function formatLocalDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(date);
}

/** How many rounds the dashboard lists before pointing at the full history. */
const DASHBOARD_ROUNDS = 3;

/** Keep the readiness column as a summary; the complete report list lives in history. */
const DASHBOARD_READINESS_GROUPS = 3;

/**
 * The past-rounds list. With a `limit`, only the newest rounds are shown (the API returns
 * newest first) and the rest are a link away, so a long history never pushes the
 * readiness panel and the next interview out of view.
 */
export function PastRoundsSection({
  sessions,
  onDelete,
  limit,
}: {
  sessions: SessionSummary[];
  onDelete?: (id: string) => Promise<void>;
  limit?: number;
}) {
  const shown = limit === undefined ? sessions : sessions.slice(0, limit);
  const hidden = sessions.length - shown.length;
  // Every row carries the same window; the server is the authority on the number and
  // this page only repeats it. Nothing is claimed if the API has not said.
  const retentionDays = sessions.find((s) => s.reportRetentionDays > 0)?.reportRetentionDays ?? null;

  return (
    <section aria-labelledby="history" className="flex flex-col gap-4 rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6">
      <SectionHead
        title={limit === undefined ? "Interview history" : "Recent interviews"}
        id="history"
        note={limit === undefined ? `${sessions.length} shown` : undefined}
      />
      {/*
        * The rule, stated before it bites rather than explained afterwards. A
        * candidate who comes back in five weeks for the report they were promised
        * and finds it gone has been surprised by us, and being surprised by a
        * product holding your career anxiety is the thing to avoid.
        */}
      {retentionDays ? (
        <p className="max-w-prose text-caption text-ink-subtle">
          Reports are kept for {retentionDays} days after the round. After that the report
          and transcript are deleted, and the round stays here as a line
          without one. You can delete any round yourself before then.
        </p>
      ) : null}
      <ul className="grid gap-3">
        {shown.map((session, index) => (
          <PastRound key={session.id} session={session} onDelete={onDelete} toneIndex={index % ROUND_TONES.length} />
        ))}
      </ul>
      {hidden > 0 ? (
        <Link
          href="/history"
          className="self-start rounded-sm text-caption font-medium text-accent underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          See more rounds in your history
        </Link>
      ) : null}
    </section>
  );
}

/**
 * One round in the history list, with the two things that can be done to it: read the
 * report, and destroy it.
 *
 * The delete is guarded by a second click on the same button rather than by
 * `window.confirm`. A native dialog is untestable, unstyleable, and — the part that
 * actually matters — it looks like the browser asking rather than like this product
 * asking, at the one moment a candidate needs to be certain about what they are agreeing
 * to. The confirmation says what goes, in the words the retention notice above uses, so
 * the two cannot describe the same operation differently.
 *
 * Keeping the *same* button element across both states is deliberate: replacing it would
 * drop keyboard focus onto the body, stranding anybody who got here by tabbing. The
 * explanation is announced politely instead, and Cancel is one tab away.
 */
const ROUND_TONES = [
  { surface: "bg-[linear-gradient(110deg,var(--accent-wash),var(--surface-raised)_65%)]", edge: "border-l-accent", icon: "bg-accent text-accent-contrast" },
  { surface: "bg-[linear-gradient(110deg,var(--positive-wash),var(--surface-raised)_65%)]", edge: "border-l-positive", icon: "bg-positive text-positive-contrast" },
  { surface: "bg-[linear-gradient(110deg,var(--warning-wash),var(--surface-raised)_65%)]", edge: "border-l-warning", icon: "bg-warning text-warning-contrast" },
  { surface: "bg-[linear-gradient(110deg,var(--info-wash),var(--surface-raised)_65%)]", edge: "border-l-info", icon: "bg-info text-info-contrast" },
] as const;

function PastRound({
  session,
  onDelete,
  toneIndex,
}: {
  session: SessionSummary;
  onDelete?: (id: string) => Promise<void>;
  toneIndex: number;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const round = `${session.companyName}, ${session.roleTitle}`;
  const soon = expiringSoon(session);
  const tone = ROUND_TONES[toneIndex] ?? ROUND_TONES[0];

  return (
    <li className={`flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-l-4 border-line px-4 py-4 shadow-[var(--shadow-sm)] transition-[border-color,box-shadow,transform] hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)] sm:px-5 ${tone.surface} ${tone.edge}`}>
      <div className="flex min-w-0 items-start gap-3.5">
        <span aria-hidden="true" className={`grid size-10 shrink-0 place-items-center rounded-xl shadow-[var(--shadow-sm)] ${tone.icon}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
            <path d="M8 10.5a4 4 0 1 1 8 0v2a4 4 0 1 1-8 0v-2Z" />
            <path d="M5.5 12.5a6.5 6.5 0 0 0 13 0M12 19v3M9 22h6" />
          </svg>
        </span>
        <div className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-body font-semibold text-ink">
            {session.companyName} · {session.roleTitle}
          </span>
          <span className="flex flex-wrap items-center gap-2 text-caption text-ink-subtle">
            <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium text-ink-muted">
              {statusLabel(session.status)}
            </span>
            {session.endedAt ? <span>{formatDate(session.endedAt)}</span> : null}
            {soon ? <span className="font-medium text-warning">Report until {formatDate(soon)}</span> : null}
          </span>
        </div>
        <span aria-live="polite" className="empty:hidden">
          {confirming ? (
            <span className="text-caption text-ink-muted">
              Delete this round for good? The report and transcript go with it.
            </span>
          ) : null}
          {error ? <span className="text-caption text-danger">{error}</span> : null}
        </span>
      </div>

      <div className="flex shrink-0 items-center gap-3">
        {/*
          * No link once retention has cleared the round. Following it would reach a page
          * that can only apologise, which is exactly the dead end `reportExpired` exists
          * to stop — so the state is said here instead.
          */}
        {session.status === "completed" && !session.reportExpired ? (
          <Link
            href={`/report/${session.id}`}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-accent px-4 py-2 text-caption font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-accent-strong"
          >
            Read report <span aria-hidden="true">→</span>
          </Link>
        ) : null}
        {session.status === "completed" && session.reportExpired ? (
          <span className="text-caption text-ink-subtle">Report expired</span>
        ) : null}

        {onDelete ? (
          <>
            {confirming ? (
              <button
                type="button"
                onClick={() => setConfirming(false)}
                disabled={busy}
                className="text-caption text-ink-muted underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            ) : null}
            <button
              type="button"
              disabled={busy}
              aria-label={
                confirming
                  ? `Confirm deleting the ${round} round permanently`
                  : `Delete the ${round} round`
              }
              onClick={async () => {
                if (!confirming) {
                  setError(null);
                  setConfirming(true);
                  return;
                }
                setBusy(true);
                try {
                  await onDelete(session.id);
                } catch {
                  // The row is still on screen and still theirs. Say so and let them try
                  // again rather than removing it optimistically and being wrong.
                  setBusy(false);
                  setConfirming(false);
                  setError("That round could not be deleted. Try again in a moment.");
                }
              }}
              className={
                confirming
                  ? "text-caption text-danger underline-offset-4 hover:underline disabled:opacity-50"
                  : "text-caption text-ink-subtle underline-offset-4 hover:text-ink hover:underline disabled:opacity-50"
              }
            >
              {confirming ? "Delete for good" : "Delete"}
            </button>
          </>
        ) : null}
      </div>
    </li>
  );
}

/**
 * The expiry date, but only once it is close enough to act on.
 *
 * Four weeks out it is noise on every row; a week out it is the difference between saving
 * a report and losing one. The rule itself is stated once above the list, so this is a
 * reminder rather than the only warning.
 */
function expiringSoon(session: SessionSummary): string | null {
  if (session.reportExpired || !session.reportExpiresAt) return null;
  const at = new Date(session.reportExpiresAt).getTime();
  if (Number.isNaN(at)) return null;
  const daysLeft = (at - Date.now()) / 86_400_000;
  return daysLeft <= EXPIRY_NOTICE_DAYS ? session.reportExpiresAt : null;
}

/** How long before expiry a round starts saying so. One week is enough to act on. */
const EXPIRY_NOTICE_DAYS = 7;

/**
 * `08/09/2026` is the 8th of September to half this product's audience and the 9th of
 * August to the other half, and both halves are people we are explicitly building for.
 * Spelling the month out costs three characters and removes the question.
 *
 * Also fixed rather than locale-dependent, so the same string is produced wherever it is
 * rendered — `toLocaleDateString` on a server and in a browser do not have to agree, and
 * when they disagree React throws the page away and re-renders it.
 */
function formatDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getDate()} ${MONTHS[date.getMonth()]} ${date.getFullYear()}`;
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** A heading and its aside on one baseline, over a rule. Used for every list on the page. */
function SectionHead({ title, id, note }: { title: string; id: string; note?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
      <h2 id={id} className="text-heading text-ink">
        {title}
      </h2>
      {note ? <span className="text-caption text-ink-subtle">{note}</span> : null}
    </div>
  );
}

function Trend({ first, latest }: { first: number | null; latest: number }) {
  if (first === null || Math.abs(latest - first) < 1) return null;
  const up = latest > first;
  return (
    <span className={`text-caption ${up ? "text-positive" : "text-ink-subtle"}`}>
      {up ? "↑" : "↓"} {Math.abs(Math.round(latest - first))} since your first
    </span>
  );
}

function statusLabel(status: SessionSummary["status"]): string {
  switch (status) {
    case "completed":
      return "Completed";
    case "in_progress":
      return "In progress";
    case "abandoned":
      return "Left early";
    case "failed":
      return "Did not finish";
    default:
      return "Not started";
  }
}
