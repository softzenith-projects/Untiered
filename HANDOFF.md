# Handoff — 18 October 2026

## Task

Prepare the public signup launch for `untiered.tech` and a separate `api.untiered.tech` backend (no task file; follows `docs/audits/launch-day-plan-2026-10-17.md`).

## What I built

- `deploy/compose.yaml`, `deploy/Caddyfile`, and `deploy/*.env.example`: single VM deployment for the existing Spring Boot API, with Caddy HTTPS and only ports 80/443 published.
- `deploy/README.md`: exact release, Supabase, DNS, Vercel, VM, checks, and rollback sequence.
- `docs/audits/launch-day-plan-2026-10-17.md`: dated live account findings and link to the execution runbook.
- `.github/workflows/ci.yml`: validates Compose and Caddy configuration in CI before building the existing images.
- `.gitignore`: keep the filled VM API environment file out of Git.

## Assumptions I made

- The user chose public signup and supplied `untiered.tech`; `api.untiered.tech` is a DNS subdomain of the existing domain.
- For a public release, the reliability baseline is a 2 GB AWS Lightsail VM in Mumbai, Vercel Pro, and Supabase Pro; current list price is about $57/month before AI and extras. The owner reviews actual checkout and legal details.
- The green `develop` commit is the release source. An unapplied migration in the unrelated payments worktree is excluded from this release.
- Resend Free is a candidate SMTP service within its current 100/day and 3,000/month quota; no account was created.

## What I could NOT verify

- Vercel project, plan, or deployment: the available browser reaches its login page. No AWS, DNS, SMTP, or Turnstile account was connected here.
- `untiered.tech` already resolves to `2.57.91.91` and serves an `hcdn` page; `api.untiered.tech` has no DNS record. Confirm the apex's current content before redirecting it to Vercel.
- Supabase Pro, production Auth configuration, backup restore, HTTPS, signup flows, VM memory headroom, and the running API. Current read-only checks instead show a Free organization, localhost Auth URLs, custom SMTP/CAPTCHA disabled, and zero listed backups.
- Five Supabase Security Advisor warnings need review, particularly the Security Definer function grants. No database or Auth settings were changed.
- A complete spoken round, voice quality, or latency. No live Gemini call or interview occurred.
- Docker image build/runtime: Docker CLI and Compose are installed, but the Docker Desktop daemon is not running.

## Verification status

- Linked Supabase project: `ACTIVE_HEALTHY` in `ap-south-1`; all migrations on `develop` are applied. A newer local-only payments migration was deliberately not applied.
- `docker compose config -q` with the blank example environment: pass locally.
- [CI run 39134563654](https://github.com/softzenith-projects/Untiered/actions/runs/39134563654) on `310e420`: web, API, database, and image jobs all passed; the image job validated Compose and Caddy and built both existing images.
- `git diff --check`: pass. No live integration test or production deploy was run.

## Merge status

- Branch `feat/public-launch-deploy` (`310e420`) merged into `develop` by this merge commit after green CI. Nothing was deployed or billed.

## Suggested next task

- Complete the account gates in `deploy/README.md`, then deploy the exact green `develop` SHA and run public signup checks.

## Open questions for you

- Confirm the legal operator and grievance contact, and review the actual Vercel, Supabase, and VM checkout before any paid subscription or VM creation.
- Decide the initial Gemini provider budget and when a live interview test may be run.
