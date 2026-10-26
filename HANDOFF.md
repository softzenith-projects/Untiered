# Handoff — 26 October 2026

## Task

Finish Untiered SES email integration and production checks (owner's pasted request; PRD §05 and §15; no task file).

## What I built

- Extended the existing draft lifecycle-email PR #121 rather than adding another email service. `SesEmailSender.kt` now sends responsive HTML and plain text through the AWS SDK SES v2, with the verified sender and support Reply-To. `LifecycleEmailJob.kt` uses the existing durable queue for bounded transient retries and records permanent or ambiguous failures without sensitive logs.
- `20261026000000_ses_delivery_retries.sql` adds claim and retry state. The older lifecycle migration remains unchanged.
- Added branded Supabase Auth confirmation, recovery, and email-change templates, local Auth rate limits, and tests for templates, CAPTCHA reset flow, MIME content, SES errors, configuration, and outbox retry state.
- Updated `.env.example`, `deploy/api.env.example`, `application.yml`, and `docs/lifecycle-email-operations.md` for separate API SES v2 and Supabase Auth SMTP configuration in Sydney. The existing SNS email subscription remains the manual bounce/complaint monitor.
- Patched Next.js and its ESLint config from 16.4.0 to 16.4.3 after the production build blocked on a documented critical advisory. No new web dependency was introduced.

## Assumptions I made

- Supabase Auth remains the owner of registration, verification, and reset tokens. Its hosted custom SMTP settings send those messages through SES; the Kotlin API uses SES v2 for its own queued lifecycle messages. Routing Auth through a new backend hook would duplicate token handling and create another sensitive queue.
- Explicit SES 429/5xx and ThrottlingException responses are retryable; SDK client failures are ambiguous and require manual review. Three total attempts are the limit, without an exactly-once claim.
- Hosted Supabase settings and templates need a human to apply. The repository's `config.toml` only configures local Supabase Auth. The owner's stated SNS and suppression setup is taken as reported, not remotely verified.
- PR #121 is already over the 800-line review guideline. Keeping this follow-up on it avoids duplicating the existing queue, preferences, and signup flow; the SES transport and retry migration depend on those unmerged changes.

## What I could NOT verify

- No live AWS call or mailbox-simulator send was made, per the owner's instruction. SES credentials, quota, sender reputation, actual inbox MIME, callbacks, SNS delivery, and account-level suppression remain unverified.
- `npm run supabase -- migration list --linked` could not check the remote: this worktree has no linked project ref or `.env`. Neither migration was applied. Both must be applied before merging into `develop`.
- Hosted Supabase Auth SMTP, rate limits, CAPTCHA, and HTML templates need manual deployment. Confirm Auth mail has a plain-text MIME alternative during the controlled mailbox test; Supabase's template editor accepts HTML only.
- Legal/consent wording and final inbox appearance need owner review. `npm install` still reported dependency advisories outside this focused patch update.

## Verification status

- Web: `npm run typecheck` pass; `npm run lint` pass; `npm run test` pass (85 files, 3,089 tests); standard `npm run build` pass with CI placeholder environment after Next.js 16.4.3 patch.
- API: `./gradlew.bat ktlintCheck test build` pass. SES sender tests 4/4 pass. Migrated-PostgreSQL tests guarded by `TEST_DB_URL` skipped locally; the CI database job passed them.
- Repository: `npm run scenario:check` pass; `node --test scripts/*.test.mjs` pass (85 tests, including two new Auth config/template checks). Frontend bundle/static scan found no AWS variable references. No live email, AI call, or migration application occurred.
- Early local test/build attempts failed from Windows worker contention, font network isolation, missing CI placeholder environment, and the pre-patch Next.js security block. The final commands above passed after these were resolved. [CI run 40319915682](https://github.com/softzenith-projects/Untiered/actions/runs/40319915682) passed all four jobs: web, API, migrated database integration, and container images.

## Merge status

- Draft [PR #121](https://github.com/softzenith-projects/Untiered/pull/121) on `feat/lifecycle-emails` targets `develop`. It remains unmerged for human review because it changes auth and personal-data handling. No push to `main`.
- The PR description still describes the former SMTP sender. The GitHub connector returned 403 when updating it, and local `gh` credentials are invalid. This handoff and the current diff describe the SES v2 implementation.

## Suggested next task

- Review PR #121, update its description, apply both migrations to the linked Supabase project, configure hosted Supabase SMTP/rate limits/CAPTCHA/templates, then merge into `develop`; test SES simulator and Auth callbacks with the owner's explicit live-test approval before setting `EMAIL_ENABLED=true`.

## Open questions for you

- Confirm the production SES send-rate/daily quota and whether Supabase Auth mail includes a plain-text MIME alternative. The sender, region, support address, and app hosting are now specified by the owner.
