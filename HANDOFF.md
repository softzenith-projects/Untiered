# Handoff — 2 November 2026

## Task
Deploy the website from GitHub Actions, because Netlify's free plan stopped building this private
organisation repository ("organization-owned private repository detected"). Owner's request in this
session.

## What I built
- A `deploy-web` job in `.github/workflows/ci.yml`. It runs `netlify-cli@27.16.1 deploy --prod
  --filter @untiered/web` after `web`, `api`, `database` and `images` are all green, on a push to the
  branch named in the `NETLIFY_PRODUCTION_BRANCH` repository variable. With the variable unset it is
  skipped, so merging this changes nothing until you configure it.
- It is a job in CI rather than its own workflow because `workflow_run` and `workflow_dispatch` only
  work from the default branch (`main`). The job deploys from whichever branch you name.
- `deploy/README.md` has a "Web on Netlify" section with the setup steps.

## Assumptions I made
- Which branch Netlify treated as production is not recorded. The runbook says releases come from a
  green `develop`, and `CLAUDE.md` says `main` is release-only. So the branch is a variable you set.
- Build settings and environment variables stay in Netlify's dashboard. The CLI fetches them with the
  token, so `NEXT_PUBLIC_GA_MEASUREMENT_ID` and the Supabase keys are still set in Netlify.
- Node 24, as in the CI web job.

## What I could NOT verify
- **A real deploy.** There is no Netlify token or site id here. The first run after you add them is
  the test. Watch the `deploy web (Netlify)` job log.
- That the free plan accepts CLI deploys from this repository. The block is on Netlify's Git
  integration, and CLI deploys do not use it, but I have not seen Netlify state this for this case.
- That the CLI picks up the base directory and build command from the Netlify dashboard in this
  monorepo. If it does not, the job log will say so, and a `netlify.toml` is the fix.

## Verification status
- The workflow parses. CI on this branch: see the run; `deploy-web` is expected to be skipped.

## Merge status
- See the commit and CI run for this branch. Merged into `develop` once CI is green.

## Suggested next task
- Once the first deploy works, remove the Vercel sections from `deploy/README.md`.

## Open questions for you
- Set in GitHub (Settings → Secrets and variables → Actions): secrets `NETLIFY_AUTH_TOKEN` and
  `NETLIFY_SITE_ID`, and the variable `NETLIFY_PRODUCTION_BRANCH` (`develop` or `main`).
- In Netlify, stop builds or unlink the repository, so the failing Git builds stop.
