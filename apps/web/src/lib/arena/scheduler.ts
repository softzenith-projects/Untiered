import { createEmptyCard, fsrs, Rating, State, type Card, type CardInput } from "ts-fsrs";

/**
 * The one place `ts-fsrs` is imported (task 055) — everything else in the Arena talks to
 * `ReviewState`, a plain, JSON-serialisable record, so the scheduling library can be
 * swapped later without touching storage or the session UI.
 *
 * FSRS's own grades are Again/Hard/Good/Easy. A quiz-style challenge only ever tells us
 * right or wrong, so this wrapper deliberately narrows to two of the four: wrong maps to
 * `Again` (forgotten, needs to come back soon) and right maps to `Good` (recalled
 * correctly, needs no special handling). Never `Hard` or `Easy` — we have no honest signal
 * for "recalled but it was a struggle" versus "trivial", and guessing would just be
 * inventing precision the interaction doesn't support.
 */

export interface ReviewState {
  due: string; // ISO 8601
  stability: number;
  difficulty: number;
  scheduledDays: number;
  learningSteps: number;
  reps: number;
  lapses: number;
  state: number; // ts-fsrs `State` enum value: 0 New, 1 Learning, 2 Review, 3 Relearning
  lastReview: string | null; // ISO 8601
}

/**
 * The stored state number, as a `ts-fsrs` `State`. ts-fsrs 6 types the field as its own enum
 * rather than `number`. What comes back from storage is whatever was saved, so anything that is
 * not one of the four states is read as `New`: rescheduled from scratch, never a crash.
 */
function toState(value: number): State {
  switch (value) {
    case State.Learning:
      return State.Learning;
    case State.Review:
      return State.Review;
    case State.Relearning:
      return State.Relearning;
    default:
      return State.New;
  }
}

function toCard(state: ReviewState): CardInput {
  return {
    due: state.due,
    stability: state.stability,
    difficulty: state.difficulty,
    scheduled_days: state.scheduledDays,
    learning_steps: state.learningSteps,
    reps: state.reps,
    lapses: state.lapses,
    state: toState(state.state),
    last_review: state.lastReview,
  };
}

function toReviewState(card: Card): ReviewState {
  return {
    due: card.due.toISOString(),
    stability: card.stability,
    difficulty: card.difficulty,
    scheduledDays: card.scheduled_days,
    learningSteps: card.learning_steps,
    reps: card.reps,
    lapses: card.lapses,
    state: card.state,
    lastReview: card.last_review ? card.last_review.toISOString() : null,
  };
}

/** A brand-new card, never reviewed — due immediately, as `ts-fsrs` initialises it. */
export function newReviewState(now: Date = new Date()): ReviewState {
  return toReviewState(createEmptyCard(now));
}

const scheduler = fsrs();

/**
 * Advances one card by one review. `current` is `undefined` for a challenge the learner
 * has never seen before, which this treats identically to a fresh `newReviewState`.
 */
export function scheduleNext(current: ReviewState | undefined, correct: boolean, now: Date = new Date()): ReviewState {
  const card = current ? toCard(current) : createEmptyCard(now);
  const grade = correct ? Rating.Good : Rating.Again;
  const { card: nextCard } = scheduler.next(card, now, grade);
  return toReviewState(nextCard);
}

/** Whether a card is due for review at `now` — never reviewed counts as due. */
export function isDue(state: ReviewState | undefined, now: Date = new Date()): boolean {
  if (!state) return true;
  return new Date(state.due).getTime() <= now.getTime();
}
