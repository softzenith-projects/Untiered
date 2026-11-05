# Handoff — 5 November 2026

## Task
Check every unresolved Sentry issue (13, across `untiered-api` and `untiered-web`) against the
code as it stands after today's API deploy (`8e7937c`). Fix only what is still broken, one
branch per fix. Owner request in session; no task file.

## Triage: which issues still need fixing

| Issue | Events | Verdict | Evidence |
|---|---|---|---|
| API-7 `column "delta" does not exist` on `/entitlement` | 120 | **Fixed by today's deploy** | The old API queried `sum(delta)`; migration `20261104120000_half_credit_ledger` had already changed the ledger to `half_credits`. Current code uses `half_credits` (`SessionRepository.kt:74`). No events since 07:08 UTC, against about 7 an hour before that. |
| WEB-4, WEB-6 "Something went wrong" on `/dashboard` | 115 | **Fixed by today's deploy** | Tagged `api_path`: 96 from `/entitlement` (API-7), 15 from `/me` (API-5), 4 from `/me/avatar` (API-8). They are the browser side of those API issues. |
| WEB-5 "Something went wrong" on `/interview/new` | 30 | **Fixed by today's deploy** (most likely) | All from `POST /sessions`, which runs the same entitlement check as API-7, and API-6. Nothing since 04:40 UTC. |
| API-8 `GET /me/avatar` not supported | 4 | **Fixed by the deploy; one defect left** | The old API had no `GET /avatar` route (`git show 4197206`); the new web app calls it. The defect left: a wrong HTTP method came back as **500** and paged Sentry. → branch 1 |
| API-5, API-6 `users_id_fkey` violation on `/me`, `/sessions` | 23 | **Still broken** | Not a race. `public.users.id` references `auth.users`, and this user had no `auth.users` row while their token still verified. The likely cause is an open tab after account deletion, since access tokens last up to an hour. The current code still answers with a 500. → branch 2 |
| (found during triage) Sentry release tag stuck on `4197206` | — | **Still broken** | `4197206` is from 26 October, yet events from three different containers (`73da726f`, `628e7209`, `400fdf56`) all carry it. `SENTRY_RELEASE` is set by hand in the VM's `api.env`. This is why Sentry couldn't tell whether a deploy fixed anything. → branch 3 |
| API-9 SES delivery failed, not retryable | 3 | Owner says sorted | From the new container. No code change made. |
| API-3 `interview_events` purge: can't bind `Instant` | 4 | **Already fixed** | `69da849` (27 October) binds `Timestamp.from(cutoff)`. The purge runs twice a day and has not failed since 29 October. |
| API-2 `OPTIONS /` no static resource | 1 | **Already fixed** | The same commit maps `NoResourceFoundException` to a quiet 404. |
| API-4 AI fallback rate over 5% (1 of 19 calls) | 2 | **Working as designed** | The hourly alert in `DailyAiSpendGuard` fired correctly on one fallback. Not a defect. See the open questions. |
| WEB-2, WEB-3 call stack overflow on `/about` | 6 | **No fix: not our code, as far as I can tell** | One iPhone (Chrome iOS) on 31 October, within 7 seconds. The recursion is in an inline script in the HTML document (`app:///:230`). `/about` is a static server component with no scripts. Has not recurred through several web deploys. |

## What I built
1. **`fix/api-method-not-allowed`** (UNTIERED-API-8). `ApiExceptionHandler` maps
   `HttpRequestMethodNotSupportedException` to 405 `method_not_allowed`, with an `Allow` header,
   in the shared `ApiError` envelope. Previously it fell through to the catch-all, which logged
   an error and returned a 500. Test: `common/ApiExceptionHandlerTest.kt`.
2. **`fix/deleted-account-token`** (UNTIERED-API-5, API-6), **PR #147**.
   `UserRepository.provision` recognises exactly `users_id_fkey` / SQLSTATE 23503 and returns
   the same 401 `unauthorized` a missing token gets. Every other integrity failure is still
   rethrown. Tests: `user/MissingAuthUserTest.kt` (unit) and
   `user/UserProvisioningDatabaseIntegrationTest.kt`, run against migrated Postgres both locally
   and in CI.
3. **`fix/sentry-release-from-image-tag`**. `deploy/compose.yaml` passes `RELEASE_TAG` to the API
   as `SENTRY_RELEASE`. Compose `environment` overrides `env_file`, so a stale value left in
   `api.env` can no longer win. `docker compose config` was checked with a stale value in place.
   README and `api.env.example` updated.

## Assumptions I made
- I took the account-deletion explanation for API-5/6 from the code path. I could not confirm in
  the database that user `1d080836-…` is gone: the production Supabase project
  (`moeronogmgtmbdnzfzgu`) is not in the org the Supabase connector can reach.
- I chose 401 rather than 410 for the deleted account, so the web app needs no new handling.
- API-9 is left alone because the owner said the SES problem is sorted.

## What I could NOT verify
- Whether API-7, API-8, WEB-4/5/6 stay quiet under real traffic. Recheck Sentry in a day; after
  branch 3 is deployed, filter by `release:<sha>` to be sure.
- How the web app presents the new 401 to a tab whose account was deleted.
- The cause of WEB-2/3. The Sentry web project has no readable source maps for inline scripts.

## Verification status
- Backend `ktlintCheck test build`: passed locally on branches 1 and 2.
- The new database test passed locally against Supabase's local Postgres, and in CI.
- CI is green on all four branches. Branch 1's first run failed on a flaky web test, which branch 4
  fixes; its re-run was green.
- **Flaky test found and fixed (branch 4, `fix/flaky-avatar-race-test`).** Two avatar tests in
  `account-summary.test.tsx` failed about one run in three, locally and on CI, on unchanged code.
  They announced a new photo before the menu's effects had registered the listener. Each now
  waits until the lookup has started. Assertions are unchanged; 12 of 12 local runs passed.

## Merge status
- Merged into `develop`: branches 4, 1 and 3, in that order. See `git log develop` for the merge
  commits. No migrations involved.
- Branch 2 is **PR #147**, not merged, because it touches the sign-in and account-deletion path.
  Its push run was green. The PR run hit the flaky test; that will pass on a re-run now that
  branch 4 is in `develop`.

## Suggested next task
- Redeploy the API with the merged `develop`, and remove `SENTRY_RELEASE` from the VM's `api.env`.

## Open questions for you
- API-4: should the fallback alert need a minimum sample (say 50 calls an hour)? At current
  traffic, one fallback in 19 calls is enough to fire it.
- Resolve the "already fixed" Sentry issues now, or after a day of quiet? I left them open.
