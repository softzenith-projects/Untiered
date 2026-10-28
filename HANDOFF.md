# Handoff — 2026-10-28

## Task
Fix the security and privacy findings from the codebase audit (user request; no task file).

## What I built
- `apps/api/src/main/kotlin/com/interviewos/api/resume/ResumeRepository.kt`, `ResumeService.kt`, and `ResumeCleanupJob.kt`: retain only the latest upload and latest parsed resume, queue superseded objects for deletion, and retry cleanup hourly. Owned older resumes can now be deleted directly.
- `apps/api/src/main/kotlin/com/interviewos/api/resume/ProfileController.kt` and `AvatarImage.kt`: verify actual PNG/JPEG bytes, limit dimensions, resize and rewrite image data, and queue replaced avatar objects for deletion.
- `supabase/migrations/20261028180000_superseded_resume_cleanup.sql`: queue historical hidden resumes and orphaned avatar objects for deletion through the durable storage outbox.
- `apps/web/src/components/profile-panel.tsx`: align avatar file selection with supported formats.
- Focused unit, controller, and database integration tests for validation and cleanup.
- Production API configuration can require a positive optional-call AI cap at startup; the deployment template enables that requirement.
- Email signup and password reset require Turnstile in production, and fail closed when its public site key is absent.

## Assumptions I made
- Keep the latest parsed resume alongside the latest upload so a failed replacement does not remove the candidate's last usable resume.
- Historical avatar objects that are more than one hour old and unreferenced by a profile are superseded; newer objects are excluded to avoid active-upload races.
- Invalid legacy storage paths remain for manual review rather than risking deletion outside the user's folder.
- The owner chose a $10/day app cap for optional preparation calls; the provider billing budget remains the hard limit and must also be configured.

## What I could NOT verify
- Local Docker was unavailable, so the database integration tests and migration were verified only by CI.
- The linked database migration has not been applied. Apply it with the eventual reviewed merge, then confirm it appears on both sides of `npm run supabase -- migration list --linked`.
- The deployment template now sets the owner-approved $10/day app cap. The VM environment and provider-side Gemini billing budget still need configuration.
- Production Turnstile needs the Vercel site key and the matching secret configured in Supabase Auth; I did not change production settings.
- Actual storage deletion and upload behavior against production Supabase were not run.

## Verification status
- Backend: `ktlintCheck test build` passed locally.
- Frontend: `typecheck`, `lint`, 3,187 tests, and `build` passed locally; build used CI placeholder public environment values.
- CI PR #129 at commit `bf358e2`: API, web, image, and database jobs all passed, including migration application and database integration tests. The duplicate push-triggered CI run also passed.

## Merge status
- Branch `fix/private-file-lifecycle` pushed; PR #129 opened against `develop` for human review because this changes personal-data deletion.
- **Update (later the same day):** PR #129 was merged into `develop` (5f0f46a). Its migration `20261028180000_superseded_resume_cleanup.sql` was applied to the linked project by a later `npm run db:push`, which applies everything pending, alongside `20261028140000_arena_concept_names.sql`.
  - The resume rows it removes are gone at once.
  - Queued objects are deleted by the API's storage deletion worker after the 15-minute settle window.
  - Not yet counted: the applying session has no SQL access to the project. To see what was queued, run `select count(*), count(distinct user_id) from storage_deletion_jobs where reason = 'resume_deleted';` in the dashboard.

## Later still: signed-in end-to-end pass (merged at 276f921)
- **Test account.** The owner approved a test account, `naman.kaushik06+untiered-e2e@gmail.com`, created through the admin API. Its password is only in the session scratchpad, not the repo.
  - Supabase enforces a captcha on password sign-in, and local `.env` has no `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, so **the email/password form cannot sign anyone in locally**.
  - The test signed in with an admin-minted magic-link token, turned into the app's own cookies.
- **Fixed:**
  - **No scenario could be finished, in any course.** The last answer returned 500: `advance()` used a bare null parameter in `is null`, which PostgreSQL rejects. The parameter is now cast, and `ScenarioArenaRepositoryDatabaseIntegrationTest` finishes a scenario.
  - **"Concepts to practise"** showed the first three concepts alphabetically for a new user. It now shows only concepts the user has answered.
  - **The scenario card** showed its context sentence as an all-caps label. It now shows tier · minutes, with the context as a line of text.
  - **fest-night step 5's context note** gave away the answer.
  - **The chapter reader** had a different header (New interview / Sign out). It now uses the app's `AppHeader` at reader width.
  - **The guided "Explain and remember" step** put Common mistakes and the interview box at half width beside an empty column.
- **Migration** `20261028130000_arena_scenario_fixes.sql` was applied.
- **Checked and fine:**
  - Signed-in pages load with no console or network errors and no phone overflow: dashboard, courses, chapters, Arena (all courses), interview setup, history, profile, questions, daily challenge, rounds.
  - Arena steps 1–4 play correctly on desktop and phone, including feedback, Best answer and Key point.
- **Not checked live at first:** the finish fix, because the owner's local API still ran the old code. A second API on :3002 could not get a database connection, because the session pooler is capped at 15 clients, so it was stopped.

## Final pass the same evening (merged at 4cad9af)
- **Local stack restarted** on `develop` with the owner's go-ahead.
  - Verified live: scenarios finish in all four courses, the "Solution in brief" screen shows, and progress updates.
  - The new festive scenarios also play end to end (Toss-Time Teams).
  - **Redeploy the OCI API**: production still has the finish bug.
- **Local development uses the transaction pooler** (port 6543, `prepareThreshold=0`). See `.env.example`, `README.md` and `deploy/README.md`.
  - Production stays on 5432.
  - The owner's `.env` was switched, and verified with every signed-in page and two full scenarios.
- **Concept names** are sentence case everywhere, with acronyms kept (migration `20261028140000_arena_concept_names.sql`).
- **The daily question gave its answer away.** Derived questions opened with the chapter summary, which often stated the answer. They now name the chapter only, and a test checks this.
- **The question heading** no longer shows the focus-ring box.
- **Click-tested and fine:**
  - course quizzes (feedback shown)
  - step-throughs
  - Python playgrounds (output matches expected; every course playground is Python, run in the browser)
  - profile edit (saves, survives reload, the nudge disappears)
- **`/questions` returns "not found" by design**: the `questions` feature flag is off.
- **Cleanup:**
  - Removed the six merged agent worktrees and their branches, and the stale `C:/tmp/uquiz` and `C:/tmp/uquizai` copies.
  - Not mine and left alone: `C:/tmp/uadv`, `C:/tmp/ufix`, `C:/tmp/urel`, and the Codex worktree.
- **Still not run:** a mock round (live Gemini spend, needs the owner's go-ahead).

## Suggested next task
- Review PR #129 after its latest CI is green. Apply its migration with the reviewed merge; configure the $10/day cap, Gemini billing budget, and both Turnstile keys before opening signup.

## Open questions for you
- Confirm the provider-side Gemini billing budget and configure Turnstile in Supabase Auth before public signup.
