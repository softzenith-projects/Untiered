"use client";

import Link from "next/link";
import { useCallback, useEffect, useId, useRef, useState } from "react";

import { InlineText } from "@/components/courses/inline-text";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Alert, EmptyState, Skeleton } from "@/components/ui/feedback";
import { Radio } from "@/components/ui/field";
import { fetchMcqAttempt, fetchStudentMcqAttempt, submitMcqAttempt } from "@/lib/api";
import { useAccessToken } from "@/lib/use-access-token";
import type { McqAttemptView, McqQuestionView, McqResult } from "@untiered/shared";

import { campusHref, useCampusOrg } from "./campus-context";
import { errorText, useLoad } from "./use-load";

const NEVER = new Promise<never>(() => {});

type Answers = Record<string, string>;

/** The answers chosen so far are kept in this browser only, so a reload does not lose them. */
function draftKey(attemptId: string): string {
  return `untiered.mcq-draft.${attemptId}`;
}

function readDraft(attemptId: string): Answers {
  try {
    const raw = window.localStorage.getItem(draftKey(attemptId));
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    if (parsed && typeof parsed === "object") {
      return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === "string"));
    }
  } catch {
    // Storage may be unavailable; the test still works, it just will not survive a reload.
  }
  return {};
}

function writeDraft(attemptId: string, answers: Answers | null) {
  try {
    if (answers === null) window.localStorage.removeItem(draftKey(attemptId));
    else window.localStorage.setItem(draftKey(attemptId), JSON.stringify(answers));
  } catch {
    // As above: a convenience, never required.
  }
}

/** "4:05", "12:00": minutes and seconds left, never negative. */
export function formatRemaining(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(total / 60);
  const seconds = total % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

/**
 * A student's MCQ test (contract "Module 4b"): the open attempt to answer, or its result.
 * The attempt was created by "Start test"; reloading this page resumes it, with the answers
 * chosen so far restored from this browser. The questions never carry their key: correct
 * answers and explanations arrive only in the submission's response.
 */
export function McqTestPage({ attemptId }: { attemptId: string }) {
  const accessToken = useAccessToken();
  const load = useCallback(
    (signal: AbortSignal): Promise<McqAttemptView> => (accessToken ? fetchMcqAttempt(attemptId, { accessToken, signal }) : NEVER),
    [attemptId, accessToken],
  );
  const { data, error, loading, setData } = useLoad(load);

  if (accessToken === null) return <Alert tone="warning">Sign in to take this test.</Alert>;
  if (error?.status === 404) {
    return (
      <EmptyState
        title="This test is not available"
        description="It may belong to someone else, or your college may have removed it."
        action={
          <Link href="/dashboard" className={buttonStyles({ variant: "secondary" })}>
            Back to your dashboard
          </Link>
        }
      />
    );
  }
  if (error) return <Alert tone="error">{error.message}</Alert>;
  if (loading || !data || !accessToken) return <Skeleton aria-label="Loading your test" className="h-96 w-full" />;

  if (data.result) {
    return (
      <div className="flex flex-col gap-6">
        <h1 className="text-display text-ink">{data.assignmentTitle}</h1>
        <McqResultView attempt={data} result={data.result} />
        <Link href="/dashboard" className={buttonStyles({ variant: "secondary", className: "self-start" })}>
          Back to your dashboard
        </Link>
      </div>
    );
  }
  return <McqTakeView attempt={data} accessToken={accessToken} onSubmitted={(graded) => setData(graded)} />;
}

function McqTakeView({
  attempt,
  accessToken,
  onSubmitted,
}: {
  attempt: McqAttemptView;
  accessToken: string;
  onSubmitted: (graded: McqAttemptView) => void;
}) {
  const id = useId();
  const [answers, setAnswers] = useState<Answers>(() => readDraft(attempt.attemptId));
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const autoSubmitted = useRef(false);
  const confirmRef = useRef<HTMLDivElement>(null);

  const deadline = attempt.deadlineAt ? new Date(attempt.deadlineAt).getTime() : null;
  const remaining = deadline === null ? null : deadline - now;
  const timeUp = remaining !== null && remaining <= 0;
  const answered = attempt.questions.filter((q) => answers[q.id]).length;
  const total = attempt.questions.length;

  useEffect(() => {
    if (deadline === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [deadline]);

  useEffect(() => {
    if (confirming) confirmRef.current?.querySelector("button")?.focus();
  }, [confirming]);

  const submit = useCallback(async () => {
    setPending(true);
    setSubmitError(null);
    try {
      const body = {
        answers: attempt.questions.flatMap((q) => (answers[q.id] ? [{ questionId: q.id, optionId: answers[q.id]! }] : [])),
      };
      const graded = await submitMcqAttempt(accessToken, attempt.attemptId, body);
      writeDraft(attempt.attemptId, null);
      onSubmitted(graded);
    } catch (cause) {
      setSubmitError(errorText(cause, "Your answers could not be submitted just now. Try again in a moment."));
      setPending(false);
    }
  }, [accessToken, answers, attempt.attemptId, attempt.questions, onSubmitted]);

  // When the time runs out, what has been answered is submitted, once.
  useEffect(() => {
    if (timeUp && !autoSubmitted.current) {
      autoSubmitted.current = true;
      setConfirming(false);
      void submit();
    }
  }, [timeUp, submit]);

  function choose(questionId: string, optionId: string) {
    setAnswers((current) => {
      const next = { ...current, [questionId]: optionId };
      writeDraft(attempt.attemptId, next);
      return next;
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-surface py-3">
        <h1 className="text-heading text-ink">{attempt.assignmentTitle}</h1>
        <div className="flex items-center gap-4">
          <p className="text-caption text-ink-muted" aria-live="polite">
            {answered} of {total} answered
          </p>
          {remaining !== null ? (
            <p className="text-body font-semibold text-ink">
              <span className="sr-only">Time left: </span>
              <span role="timer" aria-label={`Time left ${formatRemaining(remaining)}`}>
                {formatRemaining(remaining)}
              </span>
            </p>
          ) : null}
        </div>
      </div>
      <TimeWarning remaining={remaining} />

      <p className="text-caption text-ink-muted">
        Choose one answer for each question. An unanswered question counts as wrong.
        {deadline !== null ? " Your answers are submitted automatically when the time runs out." : ""}
      </p>

      <ol className="flex flex-col gap-4">
        {attempt.questions.map((question, index) => (
          <li key={question.id}>
            <QuestionField
              name={`${id}-${index}`}
              question={question}
              index={index}
              total={total}
              chosen={answers[question.id] ?? null}
              disabled={pending || timeUp}
              onChoose={(optionId) => choose(question.id, optionId)}
            />
          </li>
        ))}
      </ol>

      {submitError ? <Alert tone="error">{submitError}</Alert> : null}
      {timeUp && pending ? <Alert tone="info">Time is up. Your answers are being submitted.</Alert> : null}

      {confirming ? (
        <div
          ref={confirmRef}
          role="alertdialog"
          aria-labelledby={`${id}-confirm-title`}
          aria-describedby={`${id}-confirm-text`}
          className="card flex flex-col gap-3 p-5"
          onKeyDown={(event) => {
            if (event.key === "Escape") setConfirming(false);
          }}
        >
          <h2 id={`${id}-confirm-title`} className="text-body font-semibold text-ink">
            Submit your answers?
          </h2>
          <p id={`${id}-confirm-text`} className="text-caption text-ink-muted">
            You have answered {answered} of {total} questions.
            {answered < total ? ` ${total - answered} unanswered will count as wrong.` : ""} You cannot change your answers after
            submitting.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button type="button" disabled={pending} onClick={() => void submit()}>
              Submit now
            </Button>
            <Button type="button" variant="secondary" disabled={pending} onClick={() => setConfirming(false)}>
              Keep working
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" className="self-start" disabled={pending || timeUp} onClick={() => setConfirming(true)}>
          Submit test
        </Button>
      )}
    </div>
  );
}

/** One polite announcement at five minutes and at one minute, so a screen reader user is not surprised. */
function TimeWarning({ remaining }: { remaining: number | null }) {
  const message =
    remaining === null || remaining <= 0
      ? ""
      : remaining <= 60_000
        ? "Less than one minute left."
        : remaining <= 5 * 60_000
          ? "Less than five minutes left."
          : "";
  return (
    <p className={message ? "text-caption font-semibold text-warning" : "sr-only"} aria-live="polite">
      {message}
    </p>
  );
}

function QuestionField({
  name,
  question,
  index,
  total,
  chosen,
  disabled,
  onChoose,
}: {
  name: string;
  question: McqQuestionView;
  index: number;
  total: number;
  chosen: string | null;
  disabled: boolean;
  onChoose: (optionId: string) => void;
}) {
  return (
    <fieldset className="card flex flex-col gap-3 p-5">
      <legend className="sr-only">
        Question {index + 1} of {total}
      </legend>
      <p className="text-caption font-semibold text-ink-muted" aria-hidden>
        Question {index + 1} of {total}
      </p>
      <p className="text-body text-ink">
        <InlineText text={question.prompt} />
      </p>
      {question.code ? (
        <pre className="overflow-x-auto rounded-xl bg-navy px-5 py-4 font-mono text-caption text-on-navy">{question.code}</pre>
      ) : null}
      <div className="flex flex-col gap-2">
        {question.options.map((option) => (
          <label key={option.id} className="flex cursor-pointer items-start gap-3 rounded-lg border border-line p-3 text-body">
            <Radio
              name={name}
              value={option.id}
              checked={chosen === option.id}
              disabled={disabled}
              onChange={() => onChoose(option.id)}
            />
            <span>
              <InlineText text={option.text} />
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

/** The graded attempt: the score, then every question with the answer given, the right one and why. */
export function McqResultView({ attempt, result }: { attempt: McqAttemptView; result: McqResult }) {
  const review = new Map(result.review.map((item) => [item.questionId, item]));
  return (
    <div className="flex flex-col gap-6">
      <section aria-labelledby="mcq-score" className="card flex flex-wrap items-center justify-between gap-4 p-6">
        <div>
          <h2 id="mcq-score" className="text-heading text-ink">
            Score {result.score} / 100
          </h2>
          <p className="text-caption text-ink-muted">
            {result.correct} of {result.total} correct
            {attempt.submittedAt ? ` · submitted ${new Date(attempt.submittedAt).toLocaleString("en-IN")}` : ""}
          </p>
        </div>
        {result.late ? <Badge tone="highlight">Submitted after the time limit</Badge> : null}
      </section>

      <section aria-labelledby="mcq-review" className="flex flex-col gap-3">
        <h2 id="mcq-review" className="text-heading text-ink">
          Review
        </h2>
        <ol className="flex flex-col gap-4">
          {attempt.questions.map((question, index) => {
            const item = review.get(question.id);
            const chosen = item?.chosenOptionId ?? null;
            const right = chosen !== null && chosen === item?.correctOptionId;
            return (
              <li key={question.id} className="card flex flex-col gap-3 p-5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-caption font-semibold text-ink-muted">
                    Question {index + 1} of {attempt.questions.length}
                  </p>
                  <Badge tone={right ? "positive" : chosen === null ? "info" : "danger"}>
                    {right ? "Correct" : chosen === null ? "Not answered" : "Incorrect"}
                  </Badge>
                </div>
                <p className="text-body text-ink">
                  <InlineText text={question.prompt} />
                </p>
                {question.code ? (
                  <pre className="overflow-x-auto rounded-xl bg-navy px-5 py-4 font-mono text-caption text-on-navy">{question.code}</pre>
                ) : null}
                <ul className="flex flex-col gap-2">
                  {question.options.map((option) => {
                    const isCorrect = option.id === item?.correctOptionId;
                    const isChosen = option.id === chosen;
                    return (
                      <li
                        key={option.id}
                        className={`flex flex-wrap items-start justify-between gap-2 rounded-lg border p-3 text-body ${
                          isCorrect ? "border-positive/40 bg-positive-wash" : isChosen ? "border-danger/40 bg-danger-wash" : "border-line"
                        }`}
                      >
                        <span>
                          <InlineText text={option.text} />
                        </span>
                        <span className="flex gap-2">
                          {isChosen ? <Badge tone={isCorrect ? "positive" : "danger"}>Your answer</Badge> : null}
                          {isCorrect ? <Badge tone="positive">Correct answer</Badge> : null}
                        </span>
                      </li>
                    );
                  })}
                </ul>
                {item ? (
                  <p className="rounded-lg bg-surface-sunken p-3 text-caption text-ink">
                    <span className="font-semibold">Why: </span>
                    <InlineText text={item.explanation} />
                  </p>
                ) : null}
              </li>
            );
          })}
        </ol>
      </section>
    </div>
  );
}

/** A student's attempt as college staff see it. The key appears only once the student has submitted. */
export function StaffMcqAttempt({ memberId, attemptId }: { memberId: string; attemptId: string }) {
  const { orgId, orgName, accessToken } = useCampusOrg();
  const load = useCallback(
    (signal: AbortSignal) => fetchStudentMcqAttempt(orgId, memberId, attemptId, { accessToken, signal }),
    [orgId, memberId, attemptId, accessToken],
  );
  const { data, error, loading } = useLoad(load);

  return (
    <div className="flex flex-col gap-4">
      <Link
        href={campusHref(`/campus/readiness/${memberId}`, orgId)}
        className="w-fit text-caption font-semibold text-accent hover:underline"
      >
        <span aria-hidden>←</span> Back to the student
      </Link>
      <Alert tone="info">Viewed as {orgName} staff. This test is read-only.</Alert>
      {error ? (
        <Alert tone="error">{error.status === 404 ? "This test attempt could not be found for this student." : error.message}</Alert>
      ) : null}
      {loading && !data ? <Skeleton className="h-64 w-full" /> : null}
      {data ? (
        <>
          <h1 className="text-display text-ink">{data.assignmentTitle}</h1>
          {data.result ? (
            <McqResultView attempt={data} result={data.result} />
          ) : (
            <Alert tone="info">
              This attempt has not been submitted yet. Its {data.questions.length} questions and answers appear here once it is.
            </Alert>
          )}
        </>
      ) : null}
    </div>
  );
}
