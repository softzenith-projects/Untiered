# Handoff — 4 November 2026

## Task
A candidate's 40-minute round ended at 18 minutes. Find out why, fix it, then (owner's follow-up
in the same session) offer only 30/45/60-minute rounds, with a 30-minute round costing half a
credit. No task file; owner requests in session.

## What I built
**1. Turn ceiling and echoed answers** — merged into `develop` (PRD §06)
- Cause: a flat `MAX_TURNS = 16` ended the round. The candidate answered in about a minute a
  turn and reached 16 answers at 18 minutes. Two of those 16 were transcribed by Gemini as exact
  copies of the previous answer.
- `InterviewPlan.maxTurnsFor(duration)`: 1.5 turns a minute, floor 16 (30 → 45, 45 → 67, 60 → 90).
- `EchoedAnswer.kt`: a transcript of 40+ characters identical to the previous answer is refused
  with `answer_not_heard`. Nothing is recorded and the claim is released. Exempt when End is
  pressed or time is up.
- `interview-room.tsx`: on `answer_not_heard`, shows "We didn't catch that answer clearly"
  and reopens the mic on the same question with a fresh request id. The silence detector is
  now keyed per take (`answerTake`): otherwise a fast failure left it stopped.

**2. Round lengths and half-credit pricing** — PR #142 (payments, so not merged by me)
- `RoundLength.kt`: lengths 30/45/60 (default 45); custom topic 30 only; price 1 half-credit
  for 30 minutes, 2 for longer.
- Migration `20261104120000_half_credit_ledger.sql`: `interview_credits.delta` →
  `half_credits`, existing rows doubled.
- Entitlement, charge, refund and grant SQL use half-credits. New refusal `CREDIT_SHORT`.
  `creditBalance` in the API is now a number that can be a half.
- Web: length picker, credit copy (`lib/credits.ts`), pricing/upgrade/pack text.
- CLAUDE.md product decisions record the new pricing.

## Assumptions I made
- 1.5 turns a minute is above any real pace, so only a runaway session reaches the ceiling.
- Echo threshold of 40 characters, so "I don't know" twice is still accepted.
- Free tier stays "3 free interviews", each a whole interview at any length (owner chose this).
- Custom topic is 30 minutes only (owner chose this). Default length is 45 (closest to the old 40).
- Rounds already stored at other lengths keep running. Only new starts are restricted.

## What I could NOT verify
- Live behaviour of the re-ask prompt in a real round: no live interviews without your go-ahead.
- Whether Gemini's echo has another cause (e.g. near-silent audio). The fix catches the
  symptom, not the cause.
- The credit-ledger DB integration test runs only in CI's database job.

## Verification status
- Branch 1: web typecheck/lint/test (4069)/build and API ktlint/test/build pass locally;
  CI green on all jobs (run 41831996656).
- Branch 2: web (4070 tests) and API pass locally; CI result is on PR #142.

## Merge status
- `fix/turn-ceiling-and-echoed-answers` merged into `develop` at `e8ef1ca`. No migration.
- `feat/round-durations-and-half-credits` → PR #142, unmerged: it touches payments.
  **Apply the migration and deploy the API together.** The column rename breaks the running
  API until the new build is live. That is deliberate: it fails closed rather than misreading
  balances.

## Suggested next task
- Decide whether the 4 November candidate (session `63d9d088-c666-423c-887c-edc06d9cfb08`)
  gets their round back. It was cut short by our bug.

## Open questions for you
- Refund terms for a half-used credit (`refund-terms.tsx` still says "a pack you have not used").
