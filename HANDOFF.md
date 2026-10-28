# Handoff — 28 October 2026

## Task

Revamp the landing page: less verbose, interactive, modern, not "AI-generated looking" (owner's request in session; PRD §11; no task file).

## What I built

- `apps/web/src/app/page.tsx`: cut from eight sections of paragraphs to six short ones, one line of copy each. VoiceSection, TranscriptSample, Coverage and HowItWorks are gone. What they said is now shown by the interactive pieces below.
- `components/landing/sample-turn.tsx`: the hero demo. The visitor picks an interview type (Service IT / Product / Big Four / Europe) and presses play. The answer types in word by word over a live waveform, the drawn interviewer (`InterviewerPresence`) switches between listening, thinking and speaking, and the follow-up appears tagged *challenge*, *probe* or *interrupts*.
- `components/landing/loop-picker.tsx`: pick an archetype to see its rounds in order. Replaces the coverage grid and "How it works".
- `components/landing/report-preview.tsx`: a sample report. Clicking a competency score shows the quote it was scored on.
- `components/landing/segmented-tabs.tsx`: a shared pill tablist following the ARIA tabs pattern (arrow keys, Home/End, one tab stop).
- Employer strip is now a scrolling marquee that pauses on hover. Under reduced motion it is still and wrapped, with each name shown once.
- Course cards reuse `CourseArtwork` from the catalogue. The Arena is a single compact row.
- `globals.css`: `marquee`, `wave-bar` and `rise-in` animations, all disabled under `prefers-reduced-motion`.
- `components/landing/landing.test.tsx`: 9 behaviour and a11y tests (playback, reduced motion, screen-reader text, keyboard tabs, real vs illustrative labels, loop rounds, quote reveal).

## Assumptions I made

- **Fixed a false claim.** The old page said "every round is free … as many times as you want", but `2be9314` set the allowance to one round a day. The hero and CTA now read `DAILY_ROUNDS_TEXT` from `lib/legal.ts`, the same constant the terms use.
- Only the service-IT exchange and its "operational depth 2/5" score come from a real session (the page always said so). The other three exchanges and three report rows were written by me to show the format, and the UI labels them that way. None of them claims anything about a named employer.
- "Not AI-looking" was read as: no gradient text, glows, sparkle icons or icon-grid feature walls. Solid navy, crisp cards, and UI that looks like the real product.

## What I could NOT verify

- **Visual design.** I have not seen it rendered. Please look at `/` on desktop and phone width, in light and dark mode, and check the marquee speed and the playback pacing (110 ms per word, 0.9 s "thinking").
- Whether the illustrative exchanges read as realistic interviewer behaviour (owner judgement, per CLAUDE.md).

## Verification status

- typecheck / lint / tests (3,101 + 9 new) / build: all pass locally.
- The first `next build` stopped on a Next.js security-advisory notice and passed on retry. The notice recommends upgrading Next.js (currently 16.4.3). I did not upgrade; that is a separate dependency change.

## Merge status

- Merged `feat/landing-revamp` into `develop` at 48b2837 after CI run 40644895466 passed all four jobs (web, api, database, images). No migrations in this change.

## Suggested next task

- Act on the Next.js security advisory: run `next upgrade` on its own branch.

## Open questions for you

- None blocking.
