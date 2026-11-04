"use client";

import type { ArenaProgressView, MeResponse, ProfileDetails, ResumeView, SessionSummary } from "@untiered/shared";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { announceAvatarChanged } from "@/components/account-summary";
import { Avatar } from "@/components/ui/avatar";
import { Tabs } from "@/components/ui/tabs";
import { CONTROL_CLASS } from "@/components/ui/field";
import {
  ApiRequestError,
  deleteSkill,
  fetchArenaProgress,
  fetchMe,
  fetchProfile,
  fetchSessions,
  updateProfile,
  uploadAvatar,
  uploadResume,
  upsertSkill,
} from "@/lib/api";
import type { CourseOutline } from "@/lib/course-outline";
import { summarizeChapters } from "@/lib/course-progress";
import { featureEnabled } from "@/lib/flags";
import { useAccessToken } from "@/lib/use-access-token";
import { useAllCourseProgress } from "@/lib/use-course-progress";
import { displayNameFor } from "@/lib/display-name";

/**
 * The candidate's profile.
 *
 * The resume is the point of this page. Without one, a project deep-dive has a company
 * and a job title to work from and has to invent something to ask about; with one, the
 * interviewer can ask about the settlement pipeline they actually built. Everything else
 * here is secondary and says so by being below it.
 *
 * The parse is shown back in full, and **what we were unsure of is shown first**. A
 * mis-read employer degrades every future round, and the candidate is the only person who
 * can catch it.
 */
export function ProfilePanel({ outlines = [] }: { outlines?: CourseOutline[] }) {
  const coursesEnabled = featureEnabled("courses");
  const arenaEnabled = featureEnabled("arena");
  const mockInterviewsEnabled = featureEnabled("mockInterviews");
  const reportsEnabled = featureEnabled("reports");
  const accessToken = useAccessToken();
  // Read by async work after it awaits, to drop a result that belongs to a token that is
  // no longer signed in. Synced in an effect: a ref must not be written during render.
  const accessTokenRef = useRef(accessToken);
  useEffect(() => {
    accessTokenRef.current = accessToken;
  }, [accessToken]);
  const courseProgress = useAllCourseProgress(coursesEnabled);
  const [profile, setProfile] = useState<ProfileState>(() => emptyProfile(null));
  const visible =
    typeof accessToken === "string" && profile.ownerToken === accessToken
      ? profile
      : emptyProfile(accessToken ?? null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "resume" | "avatar" | "profile" | "skill">(null);
  /**
   * What just happened, so a save is visibly a save.
   *
   * Pressing Save and getting nothing back is indistinguishable from pressing Save and
   * having it fail silently, and a candidate who cannot tell will fill the form in twice.
   */
  const [saved, setSaved] = useState<string | null>(null);
  // Which action the current message is about. A photo's result is shown beside the photo,
  // not at the foot of a long page where nobody looking at the photo would see it.
  const [lastAction, setLastAction] = useState<NonNullable<typeof busy> | null>(null);
  const [activeTab, setActiveTab] = useState<ProfileTab>("overview");

  // A message, spinner or "Saved" belongs to the account that caused it. Reset while
  // rendering, not in an effect, so the next account never sees one for even a frame.
  const [feedbackOwner, setFeedbackOwner] = useState(accessToken);
  if (feedbackOwner !== accessToken) {
    setFeedbackOwner(accessToken);
    setError(null);
    setBusy(null);
    setSaved(null);
  }

  const resumeInput = useRef<HTMLInputElement | null>(null);
  const avatarInput = useRef<HTMLInputElement | null>(null);

  // As on the dashboard, `visible` hides another token's data, so nothing is cleared here.
  useEffect(() => {
    if (!accessToken) return;
    let active = true;
    const update = (change: Partial<ProfileState>) => {
      if (!active) return;
      setProfile((current) => ({
        ...(current.ownerToken === accessToken ? current : emptyProfile(accessToken)),
        ...change,
      }));
    };
    void fetchProfile({ accessToken }).then(
      (details) => update({ details, loaded: true }),
      () => update({ details: null, loaded: true }),
    );
    void fetchMe({ accessToken }).then(
      (me) => update({ me }),
      () => update({ me: null }),
    );
    if (mockInterviewsEnabled || reportsEnabled) {
      void fetchSessions({ accessToken }).then(
        (sessions) => update({ sessions, sessionsReady: true }),
        () => update({ sessions: [], sessionsReady: true }),
      );
    } else {
      update({ sessionsReady: true });
    }
    if (arenaEnabled) {
      void fetchArenaProgress({ accessToken }).then(
        (arena) => update({ arena, arenaReady: true }),
        () => update({ arena: null, arenaReady: true }),
      );
    } else {
      update({ arenaReady: true });
    }
    return () => {
      active = false;
    };
  }, [accessToken, arenaEnabled, mockInterviewsEnabled, reportsEnabled]);

  const run = useCallback(
    async (kind: NonNullable<typeof busy>, work: (operationToken: string) => Promise<void>) => {
      if (!accessToken) return;
      const operationToken = accessToken;
      setBusy(kind);
      setLastAction(kind);
      setError(null);
      setSaved(null);
      try {
        await work(operationToken);
        if (accessTokenRef.current === operationToken) setSaved(DONE[kind]);
      } catch (cause) {
        if (accessTokenRef.current === operationToken) {
          setError(
            cause instanceof ApiRequestError ? cause.message : "That did not work. Please try again.",
          );
        }
      } finally {
        if (accessTokenRef.current === operationToken) setBusy(null);
      }
    },
    [accessToken],
  );

  // The confirmation clears itself. A "Saved" that stays on screen stops meaning
  // "just now" and starts meaning nothing.
  useEffect(() => {
    if (!saved) return;
    const timer = setTimeout(() => setSaved(null), 4_000);
    return () => clearTimeout(timer);
  }, [saved]);

  // A photo error is a toast too, so it goes away once read; the photo is still there to retry.
  useEffect(() => {
    if (!error || lastAction !== "avatar") return;
    const timer = setTimeout(() => setError(null), 6_000);
    return () => clearTimeout(timer);
  }, [error, lastAction]);

  const photoNotice =
    lastAction === "avatar" && (error || saved) ? { tone: error ? ("danger" as const) : ("positive" as const), text: (error ?? saved)! } : null;

  const onResume = (file: File) =>
    run("resume", async (operationToken) => {
      const resume = await uploadResume(operationToken, file);
      setProfile((current) =>
        current.ownerToken === operationToken
          ? {
              ...current,
              details: {
                ...(current.details ?? {
                  skills: [],
                  avatarUrl: null,
                  currentLevel: null,
                  targetLevel: null,
                  linkedinUrl: null,
                }),
                resume,
              },
            }
          : current,
      );
      // Detected skills land server-side, so the list is re-read rather than guessed at.
      const details = await fetchProfile({ accessToken: operationToken });
      setProfile((current) =>
        current.ownerToken === operationToken ? { ...current, details } : current,
      );
    });

  if (!visible.loaded) {
    return <ProfileLoadingState />;
  }

  const resume = visible.details?.resume ?? null;

  return (
    <div className="flex flex-col gap-6">
      <ProfileHeader
        details={visible.details}
        me={visible.me}
        avatarInput={avatarInput}
        avatarBusy={busy === "avatar"}
        photoNotice={photoNotice}
        disabled={busy !== null}
        onEdit={() => {
          setActiveTab("overview");
          window.setTimeout(() => document.getElementById("profile-details")?.scrollIntoView({ behavior: "smooth", block: "start" }), 0);
        }}
        onAvatar={(file) =>
          run("avatar", async (operationToken) => {
            const details = await uploadAvatar(operationToken, file);
            announceAvatarChanged(details.avatarUrl);
            setProfile((current) =>
              current.ownerToken === operationToken ? { ...current, details } : current,
            );
          })
        }
      />

      <Tabs tabs={PROFILE_TABS.filter((tab) => tab.id !== "reports" || reportsEnabled)} active={activeTab} onChange={(value) => setActiveTab(value as typeof activeTab)} label="Profile sections" idPrefix="profile" />

      <div
        id="profile-panel-overview"
        role="tabpanel"
        aria-labelledby="profile-tab-overview"
        hidden={activeTab !== "overview"}
        className="space-y-6"
      >
        <ProfileOverview
          details={visible.details}
          sessions={visible.sessions}
          sessionsReady={visible.sessionsReady}
          arena={visible.arena}
          arenaReady={visible.arenaReady}
          outlines={outlines}
          completed={courseProgress.completed}
          progressReady={courseProgress.status === "ready"}
        />
        <div id="profile-details" className="scroll-mt-28">
          <ProfileForm
          key={visible.ownerToken ?? "signed-out"}
          details={visible.details}
          disabled={busy !== null}
          onSave={(body) =>
            run("profile", async (operationToken) => {
              const details = await updateProfile(operationToken, body);
              setProfile((current) =>
                current.ownerToken === operationToken ? { ...current, details } : current,
              );
            })
          }
          />
        </div>
      </div>

      <div
        id="profile-panel-resume"
        role="tabpanel"
        aria-labelledby="profile-tab-resume"
        hidden={activeTab !== "resume"}
        className="flex flex-col gap-6"
      >
        <section
          aria-labelledby="resume"
          className="flex flex-col gap-5 rounded-2xl border border-accent/20 bg-accent-wash p-6 shadow-[var(--shadow-sm)] sm:p-8"
        >
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-accent">Primary resume</p>
            <h2 id="resume" className="text-title text-ink">Your resume</h2>
            <p className="max-w-prose text-body text-ink-muted">
              This is what makes an interview about your work rather than about your job title.
              Upload it once and every round can dig into what you actually built.
            </p>
          </div>

          <input
            ref={resumeInput}
            type="file"
            accept=".pdf,.doc,.docx,.txt,application/pdf,text/plain"
            className="sr-only"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void onResume(file);
              event.target.value = "";
            }}
          />

          {resume ? <ResumeSummary resume={resume} /> : null}

          <div className="flex flex-wrap items-center gap-4">
            <Button
              type="button"
              onClick={() => resumeInput.current?.click()}
              disabled={busy !== null}
              aria-busy={busy === "resume"}
            >
              {busy === "resume" ? "Reading it…" : resume ? "Replace resume" : "Upload resume"}
            </Button>
            <span className="text-caption text-ink-subtle">
              PDF, Word or plain text. We read it once — this takes a few seconds.
            </span>
          </div>
        </section>

        <section
          aria-labelledby="skills"
          className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8"
        >
          <div className="flex flex-col gap-1">
            <p className="eyebrow text-accent">Skills and expertise</p>
            <h2 id="skills" className="text-title text-ink">What you know</h2>
            <p className="text-caption text-ink-subtle">
              Pulled from your resume. Mark the ones you would rather not be asked about — the
              interviewer will know they are a stretch, not that they are off limits.
            </p>
          </div>

          <SkillList
            skills={visible.details?.skills ?? []}
            disabled={busy !== null}
            onToggleWeak={(skill) =>
              run("skill", async (operationToken) => {
                const skills = await upsertSkill(operationToken, {
                  name: skill.name,
                  selfRatedConfidence: skill.selfRatedConfidence ?? undefined,
                  flaggedAsWeak: !skill.flaggedAsWeak,
                });
                setProfile((current) =>
                  current.ownerToken === operationToken && current.details
                    ? { ...current, details: { ...current.details, skills } }
                    : current,
                );
              })
            }
            onRemove={(name) =>
              run("skill", async (operationToken) => {
                await deleteSkill(operationToken, name);
                const details = await fetchProfile({ accessToken: operationToken });
                setProfile((current) =>
                  current.ownerToken === operationToken ? { ...current, details } : current,
                );
              })
            }
          />
        </section>
      </div>

      {reportsEnabled ? (
        <div
          id="profile-panel-reports"
          role="tabpanel"
          aria-labelledby="profile-tab-reports"
          hidden={activeTab !== "reports"}
        >
          <ProfileReports sessions={visible.sessions} ready={visible.sessionsReady} />
        </div>
      ) : null}

      {/*
        * Both live at the bottom, both announced. `role="status"` rather than `alert`
        * for the success case: a screen reader should mention it, not interrupt for it.
        */}
      {error && lastAction !== "avatar" ? (
        <p role="alert" className="rounded-xl border border-danger/25 bg-danger/5 px-4 py-3 text-body text-danger">
          {error}
        </p>
      ) : null}

      {saved && !error && lastAction !== "avatar" ? (
        <p role="status" className="rounded-xl border border-positive/25 bg-positive/5 px-4 py-3 text-body text-positive">
          {saved}
        </p>
      ) : null}
    </div>
  );
}

function ProfileLoadingState() {
  return (
    <div role="status" aria-label="Loading your profile" className="flex animate-pulse flex-col gap-6">
      <div className="h-32 rounded-surface border border-line bg-surface-raised shadow-[var(--shadow-sm)]" />
      <div className="h-16 rounded-2xl border border-line bg-surface-raised" />
      <div className="h-28 rounded-2xl border border-line bg-surface-raised" />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(17rem,0.7fr)]">
        <div className="h-80 rounded-2xl border border-line bg-surface-raised" />
        <div className="h-80 rounded-2xl border border-line bg-surface-raised" />
      </div>
      <span className="sr-only">Loading your profile…</span>
    </div>
  );
}

type ProfileTab = "overview" | "resume" | "reports";

const PROFILE_TABS: { id: ProfileTab; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "resume", label: "Resume & Skills" },
  { id: "reports", label: "Reports" },
];

interface ProfileState {
  ownerToken: string | null;
  details: ProfileDetails | null;
  me: MeResponse | null;
  sessions: SessionSummary[];
  arena: ArenaProgressView | null;
  sessionsReady: boolean;
  arenaReady: boolean;
  loaded: boolean;
}

function emptyProfile(ownerToken: string | null): ProfileState {
  return { ownerToken, details: null, me: null, sessions: [], arena: null, sessionsReady: false, arenaReady: false, loaded: false };
}

function ProfileHeader({
  details,
  me,
  avatarInput,
  avatarBusy,
  photoNotice,
  disabled,
  onAvatar,
  onEdit,
}: {
  details: ProfileDetails | null;
  me: MeResponse | null;
  avatarInput: React.RefObject<HTMLInputElement | null>;
  avatarBusy: boolean;
  /** The photo upload's result, shown as a small toast under the photo. */
  photoNotice: { tone: "danger" | "positive"; text: string } | null;
  disabled: boolean;
  onAvatar: (file: File) => void;
  onEdit: () => void;
}) {
  const name = me ? displayNameFor(me) : "Your profile";
  const role = currentRoleFrom(details) ?? details?.currentLevel;
  const location = me?.profile.location;
  const resume = details?.resume ?? null;
  const profileChecks = [
    Boolean(me?.displayName),
    Boolean(details?.avatarUrl),
    Boolean(resume),
    Boolean(details?.currentLevel),
    Boolean(details?.targetLevel),
    Boolean(details?.linkedinUrl),
    (details?.skills.length ?? 0) > 0,
  ];
  const completedProfileChecks = profileChecks.filter(Boolean).length;
  const profileStrength = Math.round((completedProfileChecks / profileChecks.length) * 100);

  return (
    <section aria-label="Profile identity" className="space-y-4">
      <div className="hero-band relative overflow-hidden px-6 py-8 text-on-navy sm:px-9 sm:py-10">
        <div aria-hidden="true" className="absolute -right-20 -top-28 size-72 rounded-full bg-on-navy/8 blur-3xl" />
        <div className="relative flex flex-wrap items-center justify-between gap-6">
          <div className="flex min-w-0 items-center gap-5 sm:gap-6">
            <div className="relative shrink-0">
              <Avatar src={details?.avatarUrl} alt="Profile photo" fallback={initialsOf(name)} className="border-2 border-on-navy/40 shadow-[var(--shadow-md)] sm:size-24" />
              <button type="button" onClick={() => avatarInput.current?.click()} disabled={disabled} aria-label={details?.avatarUrl ? "Change profile photo" : "Add profile photo"} className="absolute -bottom-2 -right-2 grid size-11 place-items-center rounded-full border-2 border-navy bg-accent text-heading text-accent-contrast shadow-[var(--shadow-sm)] transition-transform hover:scale-105 disabled:opacity-50">
                <span aria-hidden>{avatarBusy ? "…" : "+"}</span>
              </button>
              <input ref={avatarInput} type="file" accept="image/png,image/jpeg" className="sr-only" onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) onAvatar(file);
                event.target.value = "";
              }} />
              {photoNotice ? (
                <p
                  role={photoNotice.tone === "danger" ? "alert" : "status"}
                  className={`rise-in absolute top-full left-0 z-toast mt-4 w-max max-w-64 rounded-lg px-3 py-2 text-caption font-semibold shadow-[var(--shadow-lg)] ${
                    photoNotice.tone === "danger" ? "bg-danger text-danger-contrast" : "bg-positive text-positive-contrast"
                  }`}
                >
                  {photoNotice.text}
                </p>
              ) : null}
            </div>
            <div className="min-w-0">
              <p className="text-micro font-bold tracking-widest text-accent-on-navy uppercase">Your practice profile</p>
              <h1 className="mt-2 truncate text-display text-on-navy">{name}</h1>
              <p className="mt-2 text-caption text-on-navy-muted sm:text-body">
                {[role, location].filter(Boolean).join(" · ") || "Make this space yours before your next round."}
              </p>
              {details?.targetLevel ? <p className="mt-3 inline-flex rounded-full border border-on-navy/20 bg-on-navy/10 px-3 py-1 text-micro font-semibold text-on-navy">Working toward {details.targetLevel}</p> : null}
            </div>
          </div>
          <button type="button" onClick={onEdit} className="inline-flex min-h-11 items-center rounded-xl bg-on-navy px-5 py-2.5 text-caption font-bold text-navy shadow-[var(--shadow-sm)] transition-[background-color,transform] hover:-translate-y-0.5 hover:bg-on-navy/85">
            Edit profile
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-2xl border border-line bg-surface-raised px-5 py-4 shadow-[var(--shadow-sm)] sm:grid-cols-[minmax(0,1fr)_minmax(12rem,0.65fr)_auto] sm:items-center sm:px-6">
        <div>
          <p className="text-caption font-semibold text-ink">Profile strength</p>
          <p className="mt-0.5 text-micro text-ink-subtle">{completedProfileChecks} of {profileChecks.length} useful details complete</p>
        </div>
        <div role="progressbar" aria-label="Profile strength" aria-valuemin={0} aria-valuemax={100} aria-valuenow={profileStrength} className="h-2 overflow-hidden rounded-full bg-surface-sunken">
          <span className="block h-full rounded-full bg-[linear-gradient(90deg,var(--accent),var(--positive))]" style={{ width: `${profileStrength}%` }} />
        </div>
        <span className="text-caption font-bold tabular-nums text-positive">{profileStrength}%</span>
      </div>
    </section>
  );
}

/**
 * The overview uses only evidence already held by the account. There is no invented
 * readiness score or second profile model.
 */
function ProfileOverview({
  details,
  sessions,
  sessionsReady,
  arena,
  arenaReady,
  outlines,
  completed,
  progressReady,
}: {
  details: ProfileDetails | null;
  sessions: SessionSummary[];
  sessionsReady: boolean;
  arena: ArenaProgressView | null;
  arenaReady: boolean;
  outlines: CourseOutline[];
  completed: Record<string, string[]>;
  progressReady: boolean;
}) {
  const coursesEnabled = featureEnabled("courses") && outlines.length > 0;
  const arenaEnabled = featureEnabled("arena");
  const reportsEnabled = featureEnabled("reports");
  const courseSummaries = outlines.map((course) => ({
    course,
    summary: summarizeChapters(course.chapters, completed[course.slug] ?? []),
  }));
  const completedCourses = courseSummaries.filter(({ summary }) => summary.finished).length;
  const completedChapters = courseSummaries.reduce((total, { summary }) => total + summary.done, 0);
  const finishedRounds = sessions.filter((session) => session.status === "completed");
  const latestRound = [...finishedRounds].sort((a, b) =>
    (b.endedAt ?? b.startedAt ?? "").localeCompare(a.endedAt ?? a.startedAt ?? ""),
  )[0];
  const resume = details?.resume ?? null;
  const employments = resume?.employments ?? [];
  const nextCourse = courseSummaries.find(({ summary }) => summary.next)?.course;
  const nextChapter = courseSummaries.find(({ summary }) => summary.next)?.summary.next;

  return (
    <section aria-label="Profile overview" className="flex flex-col gap-6">
      <div className="grid overflow-hidden rounded-2xl border border-line bg-surface-raised shadow-[var(--shadow-sm)] sm:grid-cols-2 lg:grid-cols-4">
        {coursesEnabled ? <OverviewStat label="Courses complete" value={progressReady ? `${completedCourses} / ${outlines.length}` : "—"} /> : null}
        {coursesEnabled ? <OverviewStat label="Chapters complete" value={progressReady ? String(completedChapters) : "—"} /> : null}
        {reportsEnabled ? <OverviewStat label="Rounds completed" value={sessionsReady ? String(finishedRounds.length) : "—"} /> : null}
        {arenaEnabled ? <OverviewStat label="Arena streak" value={arenaReady && arena ? `${arena.streak.current} day${arena.streak.current === 1 ? "" : "s"}` : "—"} /> : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.45fr)_minmax(17rem,0.65fr)] lg:items-start">
        <article className="rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8">
          <p className="eyebrow text-accent">About</p>
          <h3 className="mt-2 text-title text-ink">Your professional story</h3>
          <p className="mt-5 max-w-3xl text-body leading-relaxed text-ink-muted">
            {resume?.headline ?? "Upload a resume to turn this space into a concise, evidence-based view of your experience."}
          </p>

          {employments.length > 0 ? (
            <ol className="mt-6 divide-y divide-line border-t border-line">
              {employments.slice(0, 4).map((employment, index) => (
                <li key={`${employment.employer}-${employment.title}-${index}`} className="grid gap-3 py-5 sm:grid-cols-[2.75rem_minmax(0,1fr)_auto] sm:items-start">
                  <span className={`grid size-10 place-items-center rounded-xl text-caption font-bold ${index % 2 === 0 ? "bg-accent text-accent-contrast" : "bg-warning-wash text-warning"}`}>
                    {employment.employer.trim().charAt(0).toUpperCase() || "W"}
                  </span>
                  <div>
                    <p className="text-caption font-semibold text-ink">{employment.title}</p>
                    <p className="mt-1 text-micro text-ink-muted">{employment.employer}</p>
                  </div>
                  <p className="text-micro text-ink-subtle sm:text-right">
                    {formatEmploymentDates(employment.startDate, employment.endDate, employment.current)}
                  </p>
                </li>
              ))}
            </ol>
          ) : null}
        </article>

        <aside className="grid gap-4">
          <div className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
            <p className="eyebrow text-accent">Primary resume</p>
            {resume ? (
              <>
                <p className="mt-3 break-words text-caption font-semibold text-ink">{resume.filename}</p>
                <p className="mt-1 text-micro text-ink-subtle">Uploaded {formatProfileDate(resume.uploadedAt)}</p>
                <p className="mt-4 rounded-lg bg-positive-wash px-3 py-2 text-micro font-semibold text-positive">
                  {resume.status === "parsed" ? "Ready for interview tailoring" : "Resume processing"}
                </p>
              </>
            ) : (
              <p className="mt-3 text-caption text-ink-muted">No resume uploaded yet.</p>
            )}
          </div>

          {arenaEnabled ? (
            <div className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
              <p className="eyebrow text-accent">Practice streak</p>
              <p className="mt-3 text-title text-ink">{arenaReady ? `${arena?.streak.current ?? 0}-day current streak` : "—"}</p>
              <p className="mt-1 text-micro text-ink-subtle">Longest streak: {arenaReady ? `${arena?.streak.longest ?? 0} days` : "—"}</p>
            </div>
          ) : null}

          {coursesEnabled && nextCourse && nextChapter ? (
            <div className="rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)]">
              <p className="eyebrow text-accent">Next lesson</p>
              <p className="mt-3 text-caption font-semibold text-ink">{nextChapter.title}</p>
              <p className="mt-1 text-micro text-ink-subtle">{nextCourse.title}</p>
              <Link href={`/courses/${nextCourse.slug}/${nextChapter.slug}`} className="mt-4 inline-flex text-caption font-semibold text-accent hover:underline">
                Continue
              </Link>
            </div>
          ) : null}

          {reportsEnabled && latestRound ? (
            <div className="rounded-2xl bg-navy p-5 text-on-navy shadow-[var(--shadow-sm)]">
              <p className="eyebrow text-accent-on-navy">Latest interview</p>
              <p className="mt-3 text-caption font-semibold text-on-navy">{latestRound.companyName}</p>
              <p className="mt-1 text-micro text-on-navy-muted">{latestRound.roleTitle}</p>
              <Link href="/history" className="mt-4 inline-flex text-caption font-semibold text-on-navy underline decoration-white/30 underline-offset-4">
                Open history
              </Link>
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}

function OverviewStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border-b border-line px-6 py-5 sm:[&:nth-child(odd)]:border-r sm:[&:nth-last-child(-n+2)]:border-b-0 lg:border-r lg:border-b-0 lg:last:border-r-0">
      <p className="font-mono text-heading font-bold tabular-nums text-ink">{value}</p>
      <p className="mt-1 text-micro text-ink-subtle">{label}</p>
    </div>
  );
}

function formatEmploymentDates(start: string | null, end: string | null, current: boolean): string {
  const year = (value: string | null) => (value ? new Date(value).getFullYear().toString() : "—");
  return `${year(start)} – ${current ? "Present" : year(end)}`;
}

function initialsOf(value: string): string {
  const parts = value.split(/[\s@._-]+/).filter(Boolean);
  return (parts.length > 1 ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}` : parts[0]?.slice(0, 2) ?? "ME").toUpperCase();
}

function roundLabel(value: SessionSummary["roundType"]): string {
  return value.replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function ProfileReports({ sessions, ready }: { sessions: SessionSummary[]; ready: boolean }) {
  const completed = sessions.filter((session) => session.status === "completed");
  const tones = [
    "border-accent/20 bg-accent-wash/55 text-accent-strong",
    "border-positive/20 bg-positive-wash/55 text-positive",
    "border-warning/20 bg-warning-wash/55 text-warning",
    "border-info/20 bg-info-wash/55 text-info",
  ];

  return (
    <section aria-labelledby="profile-reports" className="card p-6 sm:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-5">
        <div>
          <p className="eyebrow text-accent">Interview reports</p>
          <h2 id="profile-reports" className="mt-2 text-title text-ink">Recent interview reports</h2>
        </div>
        {completed.length > 0 ? (
          <Link href="/history" className="text-caption font-semibold text-accent hover:underline">
            Open full history <span aria-hidden>→</span>
          </Link>
        ) : null}
      </div>

      {!ready ? (
        <p role="status" className="py-8 text-body text-ink-muted">Loading practice history…</p>
      ) : completed.length === 0 ? (
        <div className="flex flex-col items-start gap-4 py-8">
          <p className="text-body text-ink-muted">Your completed interviews and reports will appear here.</p>
          <Link href="/interview/new" className="action-primary">Start an interview</Link>
        </div>
      ) : (
        <ul className="mt-5 grid gap-3">
          {completed.map((session, index) => (
            <li key={session.id} className={`grid gap-3 rounded-xl border p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center ${tones[index % tones.length]}`}>
              <div className="flex min-w-0 items-center gap-3">
                <span aria-hidden className="grid size-10 shrink-0 place-items-center rounded-xl bg-surface-raised text-caption font-bold shadow-[var(--shadow-sm)]">
                  {session.companyName.trim()[0]?.toUpperCase() ?? "U"}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-heading text-ink">{session.companyName}</p>
                  <p className="truncate text-caption text-ink-muted">{session.roleTitle} · {roundLabel(session.roundType)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 pl-[3.25rem] sm:pl-0">
                <span className="text-caption text-ink-subtle">{formatProfileDate(session.endedAt ?? session.startedAt)}</span>
                {session.hasReport && !session.reportExpired ? (
                  <Link href={`/report/${session.id}`} className="text-caption font-semibold text-accent hover:underline">
                    Read report <span aria-hidden>→</span>
                  </Link>
                ) : (
                  <span className="text-caption text-ink-subtle">{session.reportExpired ? "Report expired" : "Report pending"}</span>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function formatProfileDate(value: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en", { day: "numeric", month: "short", year: "numeric" }).format(date);
}

/**
 * What we read, shown back so it can be corrected.
 *
 * Uncertainty goes at the top, deliberately. Burying "we were not sure about your second
 * employer" under a tidy summary is how a wrong parse survives into every future round.
 */
function ResumeSummary({ resume }: { resume: ResumeView }) {
  const years = resume.totalExperienceMonths ? Math.round(resume.totalExperienceMonths / 12) : null;

  return (
    <div className="flex flex-col gap-5 rounded-xl border border-accent/20 bg-surface-raised p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <span className="text-body text-ink">{resume.filename}</span>
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
          {resume.status === "parsed" ? "read" : resume.status}
        </span>
      </div>

      {resume.status === "failed" ? (
        <p className="text-body text-danger">
          {resume.error ?? "We could not read that file."}
        </p>
      ) : null}

      {resume.lowConfidenceFields.length > 0 ? (
        <div className="flex flex-col gap-1 border-l-2 border-danger pl-4">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            Check these
          </span>
          <p className="max-w-prose text-caption text-ink-muted">
            We were not confident reading {resume.lowConfidenceFields.join(", ")}. If any of it is
            wrong, fix it in the document and upload again — a wrong employer changes every round
            built on it.
          </p>
        </div>
      ) : null}

      {resume.headline ? <p className="text-body text-ink-muted">{resume.headline}</p> : null}

      <dl className="grid gap-4 sm:grid-cols-3">
        <Stat term="Experience" value={years === null ? "—" : `${years} years`} />
        <Stat term="Roles" value={String(resume.employments.length)} />
        <Stat term="Projects" value={String(resume.projects.length)} />
      </dl>

      {resume.projects.length > 0 ? (
        <div className="flex flex-col gap-2">
          <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
            What an interviewer will dig into
          </span>
          <ul className="flex flex-col gap-1">
            {resume.projects.slice(0, 4).map((project) => (
              <li key={project.name} className="text-caption text-ink-muted">
                <span className="text-ink">{project.name}</span>
                {project.technologies.length > 0 ? ` · ${project.technologies.join(", ")}` : ""}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ term, value }: { term: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-caption text-ink-subtle">{term}</dt>
      <dd className="font-mono text-body text-ink">{value}</dd>
    </div>
  );
}

function SkillList({
  skills,
  disabled,
  onToggleWeak,
  onRemove,
}: {
  skills: ProfileDetails["skills"];
  disabled: boolean;
  onToggleWeak: (skill: ProfileDetails["skills"][number]) => void;
  onRemove: (name: string) => void;
}) {
  if (skills.length === 0) {
    return (
      <p className="text-caption text-ink-subtle">
        Nothing yet. Upload a resume and these fill in from what it evidences.
      </p>
    );
  }

  return (
    <ul className="flex flex-wrap gap-2">
      {skills.map((skill) => (
        <li
          key={skill.name}
          className={`flex items-center gap-2 rounded-full border px-3.5 py-2 text-caption transition-colors ${
            skill.flaggedAsWeak
              ? "border-line-strong bg-surface-sunken text-ink-subtle"
              : "border-line text-ink"
          }`}
        >
          <button
            type="button"
            disabled={disabled}
            onClick={() => onToggleWeak(skill)}
            title={skill.flaggedAsWeak ? "Marked as a stretch" : "Mark as a stretch"}
            className="disabled:opacity-50"
          >
            {skill.name}
          </button>
          <button
            type="button"
            disabled={disabled}
            onClick={() => onRemove(skill.name)}
            aria-label={`Remove ${skill.name}`}
            className="text-ink-subtle hover:text-ink disabled:opacity-50"
          >
            ×
          </button>
        </li>
      ))}
    </ul>
  );
}

function ProfileForm({
  details,
  disabled,
  onSave,
}: {
  details: ProfileDetails | null;
  disabled: boolean;
  onSave: (body: Record<string, string>) => void;
}) {
  /*
   * What the server has, and what the candidate has typed over the top of it, kept apart.
   *
   * The obvious version — copy the saved values into state and re-copy them in an effect
   * when they arrive — is wrong twice over. The profile is fetched after this mounts, so a
   * single copy at mount shows the blank form forever, which is the bug this had. And
   * re-copying inside an effect is a cascading render that React's own lint rejects.
   *
   * Holding only the edits and merging at render needs neither. Untouched fields follow
   * the server; a field the candidate has started typing in is theirs and a late response
   * cannot overwrite it underneath them.
   *
   * `currentLevel` falls back to the role the resume says they are in now. They told us
   * that by uploading the document; asking them to type it again is asking twice.
   */
  const saved = useMemo(
    () => ({
      currentLevel: details?.currentLevel ?? currentRoleFrom(details) ?? "",
      targetLevel: details?.targetLevel ?? "",
      linkedinUrl: details?.linkedinUrl ?? "",
    }),
    [details],
  );
  const [edits, setEdits] = useState<Partial<typeof saved>>({});
  const fields = { ...saved, ...edits };

  const set = (key: keyof typeof saved) => (event: React.ChangeEvent<HTMLInputElement>) => {
    const { value } = event.target;
    setEdits((current) => ({ ...current, [key]: value }));
  };

  return (
    <section
      aria-labelledby="details"
      className="flex flex-col gap-5 rounded-2xl border border-line bg-surface-raised p-6 shadow-[var(--shadow-sm)] sm:p-8"
    >
      <div className="flex flex-col gap-1">
        <h2 id="details" className="text-heading text-ink">
          Role and level
        </h2>
        <p className="text-caption text-ink-subtle">
          What a round is pitched at. A staff candidate who cannot estimate load is a different
          problem from a junior who cannot, and the report says so.
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Current level" hint="As your employer titles it.">
          <input value={fields.currentLevel} onChange={set("currentLevel")} className={CONTROL_CLASS} maxLength={60} />
        </Field>
        <Field label="Target level" hint="What you are interviewing for.">
          <input value={fields.targetLevel} onChange={set("targetLevel")} className={CONTROL_CLASS} maxLength={60} />
        </Field>
        <Field label="LinkedIn" hint="Optional. Stored, shown back to you, and not fetched.">
          <input
            value={fields.linkedinUrl}
            onChange={set("linkedinUrl")}
            placeholder="https://linkedin.com/in/…"
            className={CONTROL_CLASS}
            maxLength={300}
          />
        </Field>
      </div>

      <div>
        <Button
          type="button"
          disabled={disabled}
          /*
           * Blank fields are sent, not filtered out. The server reads absent as "leave it"
           * and blank as "clear it", so dropping them here made a field impossible to
           * empty once it had been filled in.
           */
          onClick={() => {
            // Handing the fields back to the server's copy: the response is the truth now.
            setEdits({});
            onSave(Object.fromEntries(Object.entries(fields).map(([k, v]) => [k, v.trim()])));
          }}
        >
          Save
        </Button>
      </div>
    </section>
  );
}

/** The role the resume says they are in now, which is what "current level" is asking for. */
function currentRoleFrom(details: ProfileDetails | null): string | null {
  const employments = details?.resume?.employments ?? [];
  const current = employments.find((it) => it.current) ?? employments[0];
  return current?.title ?? null;
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-body font-medium text-ink">{label}</span>
      {children}
      <span className="text-caption text-ink-subtle">{hint}</span>
    </label>
  );
}

/** What to say once each kind of change has actually landed. */
const DONE: Record<"resume" | "avatar" | "profile" | "skill", string> = {
  resume: "Resume saved and read.",
  avatar: "Photo saved.",
  profile: "Saved.",
  skill: "Skills updated.",
};
