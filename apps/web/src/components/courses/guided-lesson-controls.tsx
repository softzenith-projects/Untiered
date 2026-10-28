"use client";

import type { ReactNode } from "react";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { GuidedLessonProgressProvider } from "@/components/courses/guided-lesson-progress";

type BeatKey = "see" | "predict" | "interact" | "explain" | "check";

export type GuidedBeat = {
  key: BeatKey;
  label: string;
  shortLabel: string;
  description: string;
  itemCount: number;
  content: ReactNode;
};

function BeatIcon({ beat }: { beat: BeatKey }) {
  const paths: Record<BeatKey, ReactNode> = {
    see: <><circle cx="12" cy="12" r="3" /><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /></>,
    predict: <><path d="M9.1 9a3 3 0 1 1 5.8 1c0 2-2.9 2-2.9 4" /><path d="M12 18h.01" /><circle cx="12" cy="12" r="10" /></>,
    interact: <path d="m8 5 11 7-11 7V5Z" />,
    explain: <><path d="M9 18h6" /><path d="M10 22h4" /><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.5 15.2 14 16 14 17h-4c0-1-.5-1.8-1.5-2.5Z" /></>,
    check: <><path d="m9 12 2 2 4-4" /><circle cx="12" cy="12" r="9" /></>,
  };
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-4">{paths[beat]}</svg>;
}

/** A deliberately small client island: state and controls only; lesson blocks stay server-rendered. */
export function GuidedLessonControls({
  beats,
  completion,
}: {
  beats: GuidedBeat[];
  completion?: ReactNode;
}) {
  const [activeBeat, setActiveBeat] = useState(0);
  const [visitedBeats, setVisitedBeats] = useState<ReadonlySet<number>>(
    () => new Set(beats.length > 0 ? [0] : []),
  );
  const beatSections = useRef<Array<HTMLElement | null>>([]);
  const lessonId = useId();
  const allBeatsVisited = visitedBeats.size === beats.length;

  const markVisited = useCallback((index: number) => {
    setActiveBeat(index);
    setVisitedBeats((current) => {
      if (current.has(index)) return current;
      return new Set([...current, index]);
    });
  }, []);

  function visitBeat(index: number) {
    markVisited(index);
    beatSections.current[index]?.scrollIntoView?.({ block: "start", behavior: "smooth" });
  }

  // Reading the article normally counts too. Navigation buttons are useful shortcuts,
  // not a five-click tax before somebody can mark a chapter complete.
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.beatIndex);
        if (Number.isInteger(index)) markVisited(index);
      },
      { rootMargin: "-15% 0px -60% 0px", threshold: [0.05, 0.25] },
    );
    beatSections.current.forEach((section) => section && observer.observe(section));
    return () => observer.disconnect();
  }, [beats.length, markVisited]);

  return (
    <GuidedLessonProgressProvider
      progress={{ allBeatsVisited, totalCount: beats.length, visitedCount: visitedBeats.size }}
    >
      <section aria-labelledby={`${lessonId}-title`}>
        <header className="rounded-surface border border-line bg-surface-raised px-5 py-6 shadow-[var(--shadow-sm)] sm:px-8 sm:py-7">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="font-mono text-micro font-semibold tracking-widest text-accent-strong uppercase">Guided lesson</p>
              <h2 id={`${lessonId}-title`} className="mt-2 text-title text-ink">Learn it. Try it. Make it yours.</h2>
              <p className="mt-2 max-w-[68ch] text-caption leading-relaxed text-ink-muted">Five short steps take you from the first idea to an answer you can explain.</p>
            </div>
            <p className="rounded-full border border-accent/25 bg-surface-raised px-3 py-1 font-mono text-micro text-accent" aria-live="polite">Section {activeBeat + 1} of {beats.length}</p>
          </div>

          <nav aria-label="Lesson sections" className="mt-6 grid grid-cols-5 gap-1.5 sm:gap-2">
            {beats.map((beat, index) => (
              <button key={beat.key} type="button" aria-label={beat.label} aria-current={activeBeat === index ? "step" : undefined} aria-controls={`${lessonId}-${beat.key}`} onClick={() => visitBeat(index)} className={["group flex min-h-11 items-center justify-center gap-2 rounded-lg border px-2 py-2 text-left text-caption font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:justify-start sm:px-3", activeBeat === index ? "border-accent/40 bg-accent text-accent-contrast" : "border-line bg-surface-raised text-ink-muted hover:border-accent/40 hover:text-ink"].join(" ")}>
                <span className="shrink-0"><BeatIcon beat={beat.key} /></span>
                <span className="hidden min-w-0 sm:block"><span className="block truncate">{beat.shortLabel}</span></span>
              </button>
            ))}
          </nav>
        </header>

        <div className="mt-5 space-y-5">
          {beats.map((beat, index) => (
            <section
              key={beat.key}
              ref={(node) => { beatSections.current[index] = node; }}
              id={`${lessonId}-${beat.key}`}
              data-beat-index={index}
              data-testid={`lesson-beat-${beat.key}`}
              data-visited={visitedBeats.has(index) ? "true" : "false"}
              aria-labelledby={`${lessonId}-${beat.key}-title`}
              className="scroll-mt-28 rounded-surface border border-line bg-surface-raised px-5 py-8 shadow-[var(--shadow-sm)] sm:px-8 sm:py-10"
            >
              <div className="relative flex items-start gap-4">
                <span className={`mt-0.5 grid size-10 shrink-0 place-items-center rounded-xl border ${visitedBeats.has(index) ? "border-accent bg-accent text-accent-contrast" : "border-accent/25 bg-accent-wash text-accent"}`}><BeatIcon beat={beat.key} /></span>
                <div className="min-w-0">
                  <p className="font-mono text-micro font-semibold tracking-widest text-accent-strong uppercase">Step {String(index + 1).padStart(2, "0")}</p>
                  <h3 id={`${lessonId}-${beat.key}-title`} className="mt-1 text-title text-ink">{beat.label}</h3>
                  <p className="mt-2 max-w-[68ch] text-body leading-relaxed text-ink-muted">{beat.description}</p>
                </div>
              </div>
              <div className="relative mt-8 sm:pl-14">
                {beat.content ?? <p className="max-w-[65ch] rounded-xl border border-dashed border-line-strong bg-surface-sunken px-5 py-4 text-caption leading-relaxed text-ink-muted">This chapter does not need a separate activity for this section. Continue when you are ready.</p>}
                <div className="mt-9 flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
                  <p className="font-mono text-micro text-ink-subtle">{beat.itemCount} lesson {beat.itemCount === 1 ? "item" : "items"}</p>
                  {index < beats.length - 1 ? <button type="button" onClick={() => visitBeat(index + 1)} className="inline-flex min-h-11 items-center rounded-lg bg-accent px-4 py-2 text-caption font-semibold text-accent-contrast transition-colors hover:bg-accent-strong focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">Continue to {beats[index + 1]!.shortLabel} <span aria-hidden="true" className="ml-1">↓</span></button> : null}
                </div>
              </div>
            </section>
          ))}

          {completion ? (
            <div className={`flex flex-wrap items-center justify-between gap-5 rounded-2xl border px-5 py-5 shadow-[var(--shadow-sm)] transition-colors sm:px-7 ${allBeatsVisited ? "border-positive/30 bg-[linear-gradient(110deg,var(--positive-wash),var(--surface-raised))]" : "border-line bg-surface-raised"}`}>
              <div className="flex min-w-0 items-start gap-4">
                <span aria-hidden="true" className={`grid size-11 shrink-0 place-items-center rounded-xl ${allBeatsVisited ? "bg-positive text-positive-contrast" : "bg-surface-sunken text-ink-muted"}`}>
                  <BeatIcon beat="check" />
                </span>
                <div>
                  <p className="text-heading font-semibold text-ink">Your chapter checkpoint</p>
                  <p className="mt-1 max-w-[52ch] text-caption leading-relaxed text-ink-muted" aria-live="polite">
                    {allBeatsVisited
                      ? "You reached every section. Mark the chapter complete when you feel ready."
                      : `${visitedBeats.size} of ${beats.length} sections reached. Read or use the lesson map to unlock completion.`}
                  </p>
                </div>
              </div>
              {completion}
            </div>
          ) : null}
        </div>
      </section>
    </GuidedLessonProgressProvider>
  );
}
