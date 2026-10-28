"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import type { Route } from "next";

import { ArenaVizFrame } from "@/components/arena/arena-viz-frame";
import type { Challenge } from "@/lib/arena/types";
import { featureEnabled } from "@/lib/flags";

export const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2";

const KIND_LABEL: Record<Challenge["kind"], string> = {
  mcq: "Quiz",
  "predict-output": "Predict the output",
  "spot-mistake": "Spot the mistake",
  "which-column": "Which one?",
  "what-next": "What happens next?",
};

/**
 * One challenge, full width, one at a time (task 055, §1). Keyboard-first by design, not
 * as an add-on: digits 1-4 select an option, Enter confirms the selection or — once
 * feedback is showing — advances. This is also the accessibility requirement, not a
 * power-user nicety, so there is no mouse-only path through a session.
 */
export function ChallengeCard({
  challenge,
  selected,
  submitted,
  wasCorrect,
  onSelect,
  onSubmit,
  onNext,
  nextLabel = "Next (Enter)",
  nextDisabled = false,
}: {
  challenge: Challenge;
  selected: number | null;
  submitted: boolean;
  wasCorrect: boolean | null;
  onSelect: (index: number) => void;
  onSubmit: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  const headingRef = useRef<HTMLHeadingElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  // Move focus to the new challenge's heading whenever it changes, so a screen-reader
  // user and a keyboard user both land somewhere sensible instead of on a stale element.
  useEffect(() => {
    headingRef.current?.focus();
  }, [challenge.id]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Shortcuts belong to this card. A focused link, a field, or a control elsewhere on
      // the page keeps its own Enter — otherwise "Revisit this chapter" or "Choose another
      // set" would advance the run instead of doing what they say.
      const target = event.target instanceof Element ? event.target : null;
      if (target?.closest("a, input, textarea, select, [contenteditable='true']")) return;
      const control = target?.closest("button");
      if (control && !cardRef.current?.contains(control)) return;
      if (event.key === "Enter") {
        event.preventDefault();
        if (submitted) onNext();
        else if (selected !== null) onSubmit();
        return;
      }
      if (!submitted) {
        const digit = Number(event.key);
        if (Number.isInteger(digit) && digit >= 1 && digit <= challenge.options.length) {
          event.preventDefault();
          onSelect(digit - 1);
        }
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [submitted, selected, challenge.options.length, onSelect, onSubmit, onNext]);

  return (
    <div ref={cardRef} className="flex flex-col gap-6 rounded-surface border border-line bg-surface-raised p-6 shadow-[var(--shadow-md)] sm:p-9">
      <div className="flex flex-wrap items-center gap-2.5">
        <span className="rounded-full bg-accent-wash px-3 py-1 font-mono text-micro tracking-widest text-accent-strong uppercase">
          {KIND_LABEL[challenge.kind]}
        </span>
        <span className="font-mono text-micro tracking-widest text-ink-subtle uppercase">{challenge.moduleTitle}</span>
      </div>

      <h2 ref={headingRef} tabIndex={-1} className="text-title text-balance text-ink whitespace-pre-line outline-none focus:shadow-none focus-visible:shadow-none">
        {challenge.prompt}
      </h2>

      {challenge.context ? (
        <p className="rounded-xl border border-line bg-surface-sunken px-4 py-3 text-body leading-relaxed text-ink-muted">
          {challenge.context}
        </p>
      ) : null}

      {challenge.kind === "what-next" && challenge.viz && challenge.frameIndex !== undefined ? (
        <div className="flex justify-center rounded-xl border border-line bg-surface-sunken px-3 py-5">
          <ArenaVizFrame viz={challenge.viz} frameIndex={challenge.frameIndex} />
        </div>
      ) : null}

      {challenge.kind === "predict-output" && challenge.code ? (
        <pre className="overflow-x-auto rounded-xl bg-navy px-5 py-5 font-mono text-caption leading-relaxed text-on-navy">
          <code>{challenge.code}</code>
        </pre>
      ) : null}

      <ul className="grid gap-2.5 sm:grid-cols-2" role="list">
        {challenge.options.map((option, i) => {
          const isSelected = selected === i;
          const isCorrectOption = submitted && i === challenge.correctIndex;
          const isWrongPick = submitted && isSelected && i !== challenge.correctIndex;
          return (
            <li key={`${i}-${option}`}>
              <button
                type="button"
                disabled={submitted}
                aria-pressed={isSelected}
                onClick={() => onSelect(i)}
                className={[
                  `flex min-h-14 w-full items-center gap-3 rounded-xl border bg-surface-raised px-4 py-3 text-left text-caption transition-[border-color,background-color,transform] ${FOCUS_RING}`,
                  isCorrectOption
                    ? "border-positive/50 bg-positive/10 text-ink"
                    : isWrongPick
                      ? "border-danger/50 bg-danger/10 text-ink"
                      : isSelected
                        ? "border-accent bg-accent-wash text-ink"
                        : "border-line text-ink hover:-translate-y-0.5 hover:border-accent disabled:hover:translate-y-0 disabled:hover:border-line",
                ].join(" ")}
              >
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current font-mono text-micro">
                  {i + 1}
                </span>
                <span className="flex-1">{option}</span>
                {isCorrectOption ? <StatusIcon kind="correct" /> : null}
                {isWrongPick ? <StatusIcon kind="incorrect" /> : null}
              </button>
            </li>
          );
        })}
      </ul>

      {!submitted ? (
        <button
          type="button"
          onClick={onSubmit}
          disabled={selected === null}
          className={`self-end rounded-xl bg-accent px-5 py-3 text-caption font-semibold text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS_RING}`}
        >
          Confirm (Enter)
        </button>
      ) : (
        <div role="status" aria-live="polite" className="flex flex-col gap-3 rounded-xl border border-line bg-surface-sunken px-5 py-4">
          <p className={`flex items-center gap-2 text-body font-semibold ${wasCorrect ? "text-positive" : "text-danger"}`}>
            {wasCorrect ? <StatusIcon kind="correct" /> : <StatusIcon kind="incorrect" />}
            {wasCorrect ? "Correct" : "Not quite"}
          </p>
          <p className="text-caption leading-relaxed text-ink-muted">{challenge.why}</p>
          {challenge.source ? (
            <p className="text-caption text-ink-subtle">
              Adapted from{" "}
              <a
                href={challenge.source.url}
                target="_blank"
                rel="noreferrer"
                className="font-medium text-accent hover:underline"
              >
                {challenge.source.title}
              </a>{" "}
              by {challenge.source.publisher} ({challenge.source.license}).
            </p>
          ) : null}
          <div className="flex flex-wrap items-center gap-3">
            {featureEnabled("courses") ? (
              <Link
                href={`/courses/${challenge.courseSlug}/${challenge.chapterSlug}` as Route}
                className={`rounded-sm text-caption font-medium text-accent hover:underline ${FOCUS_RING}`}
              >
                {challenge.chapterTitle ? `Revisit ${challenge.chapterTitle}` : "Revisit this chapter"}
              </Link>
            ) : null}
            <button
              type="button"
              onClick={onNext}
              disabled={nextDisabled}
              className={`ml-auto rounded-xl bg-accent px-5 py-2.5 text-body font-medium text-accent-contrast shadow-[var(--shadow-sm)] transition-colors hover:bg-accent-strong disabled:cursor-wait disabled:opacity-60 ${FOCUS_RING}`}
            >
              {nextLabel}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Correct/incorrect is always paired with an icon and this text, never colour alone. */
function StatusIcon({ kind }: { kind: "correct" | "incorrect" }) {
  if (kind === "correct") {
    return (
      <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2">
        <polyline points="3,9 7,13 13,4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" className="h-4 w-4 shrink-0 fill-none stroke-current stroke-2">
      <line x1="4" y1="4" x2="12" y2="12" strokeLinecap="round" />
      <line x1="12" y1="4" x2="4" y2="12" strokeLinecap="round" />
    </svg>
  );
}
