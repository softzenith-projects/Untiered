# Handoff — 14 November 2026 (campus run, in progress)

## Task
Build Untiered Campus, the B2B college partnership, from the owner's spec "Untiered
Campus: College Partnership Features (v1)". The spec as adapted to this codebase is
`docs/campus-v1-spec.md`, the plan is `docs/campus-v1-plan.md`, and the wire contract is
`docs/campus-api-contract.md`. The owner asked to "do the remaining" and then to
"complete remaining".

## Status at a glance
- **Live on `develop`:** the public `/colleges` page and the home-page "For colleges"
  CTA (`4b26297`), plus the Shiki test fix (`cfedb51`).
- **Everything else is on `feat/campus-v1`** and has not been merged into `develop`. It
  is behind the `campus` feature switch, which is off by default, and it touches
  permissions, so it reaches `develop` only through a PR the owner reviews.

| Module | State on `feat/campus-v1` |
|---|---|
| 1–2 Organisations, roles | done (API + web) |
| 3 Onboarding (CSV, invites, join and consent) | done |
| 4 Assignments, college-funded admission with caps | done |
| 6 Readiness | done |
| 7 Placement dashboard, CSV export, printable batch report | done |
| 5 Integrity signals | done |
| 9 Notifications | done |
| 8 Faculty attention list and private staff notes | in progress: API committed on `feat/campus-m8-m10` (`ba6e878`); web not yet |
| 10 Programmes and certificates | not started (same branch as 8) |
| 11 Usage and cost, 12 Leaderboard | not started (contract written) |

## Blockers for the owner
1. **GitHub Actions is not running any job.** Every run since about 09:39 on 13 November
   fails before it starts: "recent account payments have failed or your spending limit
   needs to be increased". Fix this under Billing & plans. Until then nothing can pass
   the CI gate into `develop`.
2. **The plan's usage limit was reached.** It resets at 23:50 IST. The run resumes then
   from `runs/2026-11-13-progress.md`, but only while this editor session stays open.

## How it was verified, since CI could not run
- The campus work has been verified locally only, on the merged `feat/campus-v1`. CI
  has seen nothing after `2210ef2`.
- Backend: `./gradlew ktlintCheck test build` gives 1,156 tests and 0 failures, with
  every `*DatabaseIntegrationTest` running against a local Supabase Postgres that has all
  campus migrations applied.
- The campus database suites ran with nothing skipped:
  - isolation: 11
  - onboarding: 8
  - assignments: 5, including the race for the last allowance unit
  - readiness: 7
  - notifications: 11
  - integrity
- Web: typecheck, lint, build, and 4,226 tests in 121 files.
- Two web tests that cold-import whole modules got longer timeouts, each with a comment.
  No assertion was changed.

## Assumptions made, which the owner should confirm
1. **What a college can see:** only work it assigned, meaning assignment rounds, their
   reports and its integrity counts, plus Arena scenario sets. A student's personal
   practice is never shown.
2. **Exception — last active:** "last active" and "active in 14 days" do count personal
   practice, as a date only. The join consent copy says so.
3. **Mismatched email:** a student invited at a college address can accept while signed
   in with another account, after an explicit confirmation. The token proves they
   received the invite email.
4. **No accounts at import.** An existing account is linked only when its holder accepts.
   The import preview never reveals whether an email has an Untiered account.
5. **Funding:** college-assigned interviews come from a per-college `interview_allowance`
   that a platform admin sets by hand. They never use the student's free rounds or
   credits. A failed round hands its unit back.
6. **MCQ tests are deferred** (spec 4b). Course MCQs are graded in the browser. Arena
   scenario sets are graded on the server and can be assigned.
7. **PDFs are print pages.** The batch report and certificates are print-optimised pages
   ("Save as PDF"), so no PDF library was added.
8. **Integrity:** only assigned rounds are counted: tab and window switches, pastes, and
   answer timing. They are counts, never verdicts, and the student sees the same summary.
   The start screen says what is counted.
9. **Emails:**
   - The new-assignment email has no unsubscribe link, because it is a college
     instruction.
   - Reminders, report-ready and the weekly summary respect a "College reminders" toggle.
   - No email ever contains a score.
10. **Consent copy** lives on the server (`CampusJoinService`). Module 8 bumps it to
    `campus-2026-11-14` to disclose private staff notes.

## What I could NOT verify
- Anything in a browser: visual design, the print layouts, the heatmap colours, dark
  mode.
- Real SES delivery of invite and campus emails. With SES off, invites never get a
  usable link, so the join flow cannot be tried locally.
- Real-browser integrity events (the order of blur and visibility events, keepalive on
  tab close).
- Live report generation from the staff route (the AI is mocked).
- Latency at college scale.

## Before merging `feat/campus-v1` into `develop` (owner)
1. Fix GitHub billing and get green CI on the PR.
2. **Legal / data protection:** update the privacy policy and terms to cover colleges as
   recipients of student data (India's DPDP Act) before the first real invite. The
   `campus` switch must stay off until then.
3. Apply the six campus migrations (`20261113120000` to `20261113170000`, plus more as
   modules 8–12 land) with `npm run db:push` as part of the merge.
4. The size is far over the 800-line guideline: about 25,000 lines including tests. The
   history merges module by module, so it can be reviewed per module branch.

## Open questions
- Should "last active" exclude personal practice entirely? (Assumption 2.)
- Should college-funded interview allowances be billed? Payments for colleges are out of
  scope in v1.
