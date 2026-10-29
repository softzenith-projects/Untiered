"use client";

import { useCallback, useState } from "react";

import { ChallengeCard } from "@/components/arena/challenge-card";
import { localDateKey } from "@/lib/arena/progression";
import { useArenaProgress } from "@/lib/arena/progress-store";
import { scheduleNext } from "@/lib/arena/scheduler";
import type { Challenge } from "@/lib/arena/types";

/**
 * One reviewed Arena question, stable for the learner's local calendar day. Completion
 * is account-backed, so a solved card stays green after refresh and on another device.
 *
 * On the dashboard it starts collapsed to the question and one button. Opened in full it
 * was the largest thing on the page, above anything to do with the candidate's interviews,
 * and the dashboard's job is the next interview.
 */
export function DashboardQuestionOfDay({ questionsByDate, focused = false }: { questionsByDate: Record<string, Challenge>; focused?: boolean }) {
  const [dateKey] = useState(() => localDateKey(new Date()));
  const question = questionsByDate[dateKey];
  const { progress, ready, status, recordAnswer, retry } = useArenaProgress();
  const [selected, setSelected] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [wasCorrect, setWasCorrect] = useState<boolean | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  const [completedNow, setCompletedNow] = useState(false);
  const [open, setOpen] = useState(focused);

  const completed = completedNow || progress.dailyQuestionCompletions[dateKey] !== undefined;

  const submit = useCallback(() => {
    if (!question || selected === null || submitted || saving) return;
    const correct = selected === question.correctIndex;
    const now = new Date();
    const nextCard = scheduleNext(progress.cards[question.id], correct, now);

    setSubmitted(true);
    setWasCorrect(correct);
    setSaving(true);
    setSaveFailed(false);
    void recordAnswer(question.id, correct, nextCard, now, correct ? dateKey : undefined).then((saved) => {
      setSaving(false);
      if (saved && correct) setCompletedNow(true);
      if (!saved) setSaveFailed(true);
    });
  }, [dateKey, progress.cards, question, recordAnswer, saving, selected, submitted]);

  const tryAgain = useCallback(() => {
    if (saving) return;
    setSelected(null);
    setSubmitted(false);
    setWasCorrect(null);
    setSaveFailed(false);
  }, [saving]);

  if (!question) return null;

  return (
    <section
      aria-labelledby="question-of-the-day-heading"
      className={focused ? "" : "rounded-2xl border border-line bg-surface-raised p-5 shadow-[var(--shadow-sm)] sm:p-6"}
    >
      <div className={`flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-6 ${focused ? "mb-6 text-center sm:text-left" : "mb-4"}`}>
        <div>
          <p className="eyebrow text-accent">Daily practice</p>
          <h2 id="question-of-the-day-heading" className={`${focused ? "mt-2 text-display" : "mt-1 text-heading"} text-ink`}>
            Question of the day
          </h2>
          {focused ? (
            <p className="mt-1 max-w-2xl text-caption text-ink-muted">
              One focused question from your learning paths. Take your time, then check your reasoning.
            </p>
          ) : null}
        </div>
        <span className="pill w-fit bg-surface-raised text-ink-muted shadow-[var(--shadow-sm)]">Changes tomorrow</span>
      </div>

      {!ready ? (
        <div className="rounded-2xl border border-line bg-surface-raised px-5 py-8 text-center shadow-[var(--shadow-sm)]">
          {status === "error" ? (
            <div role="alert">
              <p className="text-body font-semibold text-ink">Your daily progress is temporarily unavailable.</p>
              <p className="mt-2 text-caption text-ink-muted">Your answers are safe. Check your connection and try again.</p>
              <button type="button" onClick={retry} className="mt-4 rounded-lg bg-accent px-4 py-2 text-caption font-semibold text-accent-contrast hover:bg-accent-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2">Retry</button>
            </div>
          ) : <p role="status" className="text-body font-medium text-ink">Loading today&apos;s question…</p>}
        </div>
      ) : completed ? (
        <div role="status" aria-live="polite" className={`flex items-start gap-4 rounded-2xl border border-positive/30 bg-positive/10 ${focused ? "p-5 sm:p-6" : "p-4"}`}>
          <span className="grid size-11 shrink-0 place-items-center rounded-full bg-positive text-positive-contrast shadow-[var(--shadow-sm)]">
            <svg aria-hidden="true" viewBox="0 0 24 24" className="size-6 fill-none stroke-current stroke-2.5">
              <polyline points="5,13 10,18 19,7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </span>
          <div>
            <p className="text-heading font-bold text-positive">Awesome job — you solved the Question of the Day.</p>
            <p className="mt-1 text-caption text-ink-muted">Come back tomorrow for a fresh question.</p>
          </div>
        </div>
      ) : !open ? (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-body font-semibold text-ink">{question.prompt}</p>
            <p className="mt-1 text-caption text-ink-subtle">{question.chapterTitle ?? question.moduleTitle} · about a minute</p>
          </div>
          <button type="button" onClick={() => setOpen(true)} className="action-secondary shrink-0 px-5">
            Answer it
          </button>
        </div>
      ) : (
        <div className="mx-auto max-w-4xl">
          <ChallengeCard
            challenge={question}
            selected={selected}
            submitted={submitted}
            wasCorrect={wasCorrect}
            onSelect={setSelected}
            onSubmit={submit}
            onNext={tryAgain}
            nextLabel={saving ? "Saving…" : wasCorrect && !saveFailed ? "Finishing…" : "Try again"}
            nextDisabled={saving || (wasCorrect === true && !saveFailed)}
          />
          {saveFailed ? (
            <p role="alert" className="mt-3 text-caption text-danger">
              Your answer could not be saved. Check your connection and try again.
            </p>
          ) : null}
        </div>
      )}
    </section>
  );
}
