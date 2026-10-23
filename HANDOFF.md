# Handoff — 23 October 2026

## Task

Build opted-in welcome, daily-question, inactivity, announcement, and informative emails (owner request; PRD §05 and §15; no task file).

## What I built

- `supabase/migrations/20261023000000_lifecycle_email.sql`: confirmed-signup hook, account-owned preferences, deduplicated delivery queue, campaigns, RLS, and deletion cascades.
- `apps/api/src/main/kotlin/com/interviewos/api/email/`: preference and unsubscribe API, allow-listed campaign scheduling, SES SMTP delivery, daily question and inactivity jobs.
- `apps/web/src/app/api/internal/daily-question/route.ts`: token-protected access to the exact in-app Question of the Day, without its answer.
- Signup opt-in controls, Google OAuth choice handoff, Profile email settings, and a public unsubscribe confirmation page.
- `docs/lifecycle-email-operations.md`, `.env.example`, and `deploy/api.env.example`: deployment and operating instructions. Added Spring Boot Mail because the JDK/previous dependencies do not provide SMTP delivery.
- API, web, and migrated-PostgreSQL integration tests.

## Assumptions I made

- Amazon SES via SMTP is the lower-cost scalable option after the small free quota of Resend. No account or credentials were created.
- Welcome follows confirmed signup, including people who never open the app. Marketing categories remain off unless explicitly selected at signup or later in Profile.
- Daily mail begins from 09:00 Asia/Kolkata and contains that date's exact question and options, without the answer. People in other time zones may see a different live question on a different local date.
- Inactivity gets one reminder at 7 days and one at 21 days. Platform announcements and informative messages are manually scheduled through the existing admin allow-list API.
- The 1,289 added lines form one change because the auth trigger, preference flow, outbox, question source, and tests depend on the same schema.

## What I could NOT verify

- SES SMTP and inbox behavior, sender/domain reputation, bounce handling, and production send quota: no credentials or live sending.
- Legal/consent wording and final email appearance in real inboxes need owner review.
- The new migration has not been applied to the linked database. CI's local Supabase job is the first migrated-PostgreSQL check; applying it to the linked project is required before merge.
- The standard local Turbopack build failed with a child-process exit; the first sandbox build also could not fetch the existing Google font. A supported webpack production build passed. CI will determine Linux status.
- `npm ci` reported dependency advisories and the Next build emitted an upgrade recommendation; dependency upgrades are outside this feature PR.

## Verification status

- Web: typecheck pass; lint pass; full test pass (85 files, 3,088 tests); `next build --webpack` pass. Standard `npm run build` failed locally in Turbopack before application compilation.
- API: `ktlintCheck test build` pass. Database integration tests guarded by `TEST_DB_URL` were skipped locally and run in CI.
- `git diff --cached --check` passed before commit. No live AI call, email send, or migration application occurred.
- [CI run 39978193186](https://github.com/softzenith-projects/Untiered/actions/runs/39978193186) for PR #121: web, API, migrated database integration, and Docker image jobs all passed on commit `bb751a5`.

## Merge status

- Commit `bb751a5` on pushed branch `feat/lifecycle-emails`; draft PR #121 targets `develop` for human review because this changes auth, permissions, and personal-data handling. Unmerged. Never pushed to `main`.

## Suggested next task

- Finish PR #121 review and green CI, review legal copy and email rendering, apply the migration to the linked Supabase project, then merge into `develop`; configure SES and the deployment's secret/runtime variables before enabling `EMAIL_ENABLED`.

## Open questions for you

- Which verified sending domain/address and SES region should production use, and where will Web and API run? These only block activation, not code review.
