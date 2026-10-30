"use client";

import type { Route } from "next";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";

import { InlineText } from "@/components/courses/inline-text";
import { useGuidedLessonProgress } from "@/components/courses/guided-lesson-progress";
import { summarizeChapters } from "@/lib/course-progress";
import { useAccessToken } from "@/lib/use-access-token";
import { useCourseProgress } from "@/lib/use-course-progress";

/** The chapter data the client needs — slugs and titles only, never chapter content. */
export interface ChapterRef {
  slug: string;
  title: string;
}

export function CheckIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" fill="none" aria-hidden="true" className={className}>
      <path d="M3.5 8.5l3 3 6-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** A labelled bar. The numbers are the meaning; the fill is only a scan aid. */
export function ProgressBar({ done, total, label }: { done: number; total: number; label: string }) {
  const percent = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <div className="flex flex-col gap-1.5">
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-valuenow={done}
        aria-valuetext={`${done} of ${total} chapters complete`}
        className="h-2 w-full overflow-hidden rounded-full bg-surface-sunken"
      >
        <div className="h-full rounded-full bg-positive transition-[width] duration-300" style={{ width: `${percent}%` }} />
      </div>
      <p className="font-mono text-micro tracking-widest text-ink-subtle uppercase">
        {done} of {total} chapters · {percent}%
      </p>
    </div>
  );
}

/**
 * A link to a chapter. Chapters need an account, so signed out a prefetch only fetches the
 * redirect to sign-in, once for every row of a syllabus. Prefetching waits until signed in.
 */
export function ChapterLink({ href, className, children }: { href: string; className: string; children: React.ReactNode }) {
  const token = useAccessToken();
  return <Link href={href as Route} prefetch={token ? undefined : false} className={className}>{children}</Link>;
}

const subscribeToNothing = () => () => {};

/**
 * False on the server and while hydrating, true after. The header hydrates first and caches
 * the session, so by the time a page section hydrates the token can already differ from what
 * the server rendered with, and anything that branches on it directly is a hydration error.
 */
function useHydrated(): boolean {
  return useSyncExternalStore(subscribeToNothing, () => true, () => false);
}

/** Course-page hero: how far along, and one button that goes to the right place. */
export function CourseHeroProgress({ courseSlug, chapters }: { courseSlug: string; chapters: ChapterRef[] }) {
  const token = useAccessToken();
  const hydrated = useHydrated();
  const { completed, ready } = useCourseProgress(courseSlug);
  const summary = summarizeChapters(chapters, completed);
  const first = chapters[0];
  const target = summary.next ?? first;
  // Until the account's progress has loaded, "Start course" would be a guess — and the
  // wrong one for anyone returning. Say "Continue" only when it is known to be true.
  const started = ready && summary.started;

  return (
    <div className="flex max-w-md flex-col gap-4">
      {started ? <ProgressBar done={summary.done} total={summary.total} label="Course progress" /> : null}
      {target ? (
        <ChapterLink
          href={`/courses/${courseSlug}/${target.slug}`}
          className="w-fit rounded-md bg-accent px-5 py-2.5 text-caption font-medium text-accent-contrast transition-colors hover:bg-accent-strong"
        >
          {ready && summary.finished ? "Review from the start" : started ? "Continue learning" : "Start course"}
        </ChapterLink>
      ) : null}
      {/* The space is held from the start, so the note appearing does not move the page. */}
      {!started ? (
        <p className="min-h-10 text-caption text-ink-muted sm:min-h-5">
          {hydrated && token === null ? "Free. Sign in or create an account to open the chapters." : null}
        </p>
      ) : null}
      {started && !summary.finished && summary.next ? (
        <p className="text-caption text-ink-muted">
          Up next: <InlineText text={summary.next.title} />
        </p>
      ) : null}
      {ready && summary.finished ? <p className="text-caption font-medium text-positive">Every chapter complete.</p> : null}
    </div>
  );
}

/** A catalogue card's progress line; renders nothing until the learner has started. */
export function CourseCardProgress({ courseSlug, chapters }: { courseSlug: string; chapters: ChapterRef[] }) {
  const { completed, ready } = useCourseProgress(courseSlug);
  const summary = summarizeChapters(chapters, completed);
  if (!ready || !summary.started) return null;
  return <ProgressBar done={summary.done} total={summary.total} label="Course progress" />;
}

/** Compact, always-present progress summary for the chapter reader's context rail. */
export function CourseRailProgress({ courseSlug, chapters }: { courseSlug: string; chapters: ChapterRef[] }) {
  const { completed, ready } = useCourseProgress(courseSlug);
  if (!ready) {
    return <p className="text-caption text-ink-muted">Loading your course progress…</p>;
  }

  const summary = summarizeChapters(chapters, completed);
  return (
    <div className="flex flex-col gap-3">
      <ProgressBar done={summary.done} total={summary.total} label="Course progress" />
      {summary.finished ? (
        <p className="text-caption font-medium text-positive">Course complete. Revisit any chapter whenever you like.</p>
      ) : summary.next ? (
        <p className="text-caption leading-relaxed text-ink-muted">
          Up next: <span className="font-semibold text-ink"><InlineText text={summary.next.title} /></span>
        </p>
      ) : (
        <p className="text-caption text-ink-muted">Start with this chapter and build from here.</p>
      )}
    </div>
  );
}

/** "2 of 5 done" for a module heading. Empty until something in it is complete. */
export function ModuleProgress({ courseSlug, chapterSlugs }: { courseSlug: string; chapterSlugs: string[] }) {
  const { completed, ready } = useCourseProgress(courseSlug);
  const done = chapterSlugs.filter((slug) => completed.has(slug)).length;
  if (!ready || done === 0) return null;
  return (
    <span className="font-mono text-micro tracking-widest text-positive uppercase">
      {done === chapterSlugs.length ? "Complete" : `${done} of ${chapterSlugs.length} done`}
    </span>
  );
}

/** The tick in a chapter row: a check plus a visually hidden word, so it is not colour alone. */
export function ChapterDoneMark({ courseSlug, chapterSlug }: { courseSlug: string; chapterSlug: string }) {
  const { completed, ready } = useCourseProgress(courseSlug);
  const done = ready && completed.has(chapterSlug);
  return (
    <span
      className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${
        done ? "border-positive bg-positive text-positive-contrast" : "border-line-strong text-transparent"
      }`}
    >
      {done ? <CheckIcon className="size-3" /> : null}
      {/* Unknown until progress has loaded, and this is in the HTML a crawler reads. */}
      {ready ? <span className="sr-only">{done ? "Completed" : "Not completed"}</span> : null}
    </span>
  );
}

/**
 * End-of-chapter control. Completion is the learner's statement, never inferred from a
 * visit. The tick applies immediately and is reverted if the save fails, and the failure
 * is said out loud rather than leaving somebody believing it was recorded.
 */
export function MarkCompleteButton({ courseSlug, chapterSlug }: { courseSlug: string; chapterSlug: string }) {
  const { completed, status, setChapterDone } = useCourseProgress(courseSlug);
  const lessonProgress = useGuidedLessonProgress();
  const [failed, setFailed] = useState(false);
  const [saving, setSaving] = useState(false);
  const done = completed.has(chapterSlug);
  const lessonLocked = !done && lessonProgress !== null && !lessonProgress.allBeatsVisited;
  const progressLoading = status === "loading";

  async function toggle() {
    setSaving(true);
    setFailed(false);
    const ok = await setChapterDone(chapterSlug, !done);
    setSaving(false);
    if (!ok) setFailed(true);
  }

  return (
    <div className="flex min-w-0 max-w-full flex-col gap-2">
      <button
        type="button"
        aria-pressed={done}
        disabled={lessonLocked || progressLoading || saving}
        onClick={toggle}
        className={`inline-flex min-h-11 max-w-full items-center justify-center gap-2 self-start rounded-xl border px-4 py-2.5 text-center text-caption font-semibold shadow-[var(--shadow-sm)] transition-[background-color,border-color,transform] hover:-translate-y-px disabled:translate-y-0 disabled:opacity-60 ${
          done
            ? "border-positive/35 bg-surface-raised text-positive hover:bg-positive-wash"
            : "border-accent bg-accent text-accent-contrast hover:bg-accent-strong"
        }`}
      >
        {done ? <CheckIcon className="text-positive" /> : null}
        {done
          ? "Completed — click to undo"
          : lessonLocked
            ? "Visit all lesson sections to complete"
            : progressLoading
              ? "Loading progress…"
              : "Mark chapter as complete"}
      </button>
      {status === "error" && !failed ? (
        <p role="status" className="text-caption text-ink-muted">
          Saved progress could not be loaded. You can still try to mark this chapter complete.
        </p>
      ) : null}
      {failed ? (
        <p role="alert" className="text-caption text-danger">
          That didn&apos;t save. Check your connection and try again.
        </p>
      ) : null}
    </div>
  );
}
