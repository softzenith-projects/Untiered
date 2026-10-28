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
- The configured AI cap protects optional preparation calls only; the provider billing budget remains the hard limit and must be configured separately.

## What I could NOT verify
- Local Docker was unavailable, so the database integration tests and migration were verified only by CI.
- The linked database migration has not been applied. Apply it with the eventual reviewed merge, then confirm it appears on both sides of `npm run supabase -- migration list --linked`.
- A positive `AI_DAILY_SPEND_CAP_MICRO_USD` still needs an owner-selected value in the VM environment. Configure the provider-side Gemini billing budget too.
- Production Turnstile needs the Vercel site key and the matching secret configured in Supabase Auth; I did not change production settings.
- Actual storage deletion and upload behavior against production Supabase were not run.

## Verification status
- Backend: `ktlintCheck test build` passed locally.
- Frontend: `typecheck`, `lint`, 3,187 tests, and `build` passed locally; build used CI placeholder public environment values.
- CI PR #129 at commit `8a20a61`: API, web, image, and database jobs all passed, including migration application and database integration tests. Later fail-closed spend and CAPTCHA changes are locally verified; CI is pending for those commits.

## Merge status
- Branch `fix/private-file-lifecycle` pushed; PR #129 opened against `develop` for human review because this changes personal-data deletion. Not merged and migration not applied.

## Suggested next task
- Review PR #129 after its latest CI is green. Apply its migration with the reviewed merge; set the owner-chosen AI cap and configure both Turnstile keys before opening signup.

## Open questions for you
- What positive global daily AI cap should be enforced for optional preparation calls?
