# Public launch runbook — `untiered.tech`

Use this with [the audited hosting decision](../docs/audits/launch-day-plan-2026-10-17.md). It prepares the existing Next.js web app for Vercel and the existing Spring Boot API for one VM. No interview logic moves to Vercel. The release source is a **green `develop` commit**; the owner alone advances `main`.

## Accounts and cost gate

The public signup choice needs a Vercel Pro project on the organization repository, the existing Mumbai Supabase project on Pro, and a VM. Use an AWS Lightsail **Small 2 GB Linux with public IPv4 in Mumbai (`ap-south-1`)** for the dependable option. Its published VM rate is $12/month; combined with the current Vercel Pro $20 and Supabase Pro $25 list prices, fixed platform cost is about **$57/month**, before Gemini, email, domain renewal, taxes, and overages. Do not buy or upgrade any service until the owner reviews the provider's actual checkout. The API subdomain is a DNS record under the already-owned `untiered.tech` and does not need a second domain purchase. An Oracle A1 Always Free VM could reduce the VM charge if the account's home region and capacity work, but it is not the public availability baseline. [Lightsail regions](https://docs.aws.amazon.com/lightsail/latest/userguide/understanding-regions-and-availability-zones-in-amazon-lightsail.html), [instance bundles](https://docs.aws.amazon.com/lightsail/latest/userguide/amazon-lightsail-bundles.html).

## 1. Pin the release

1. Read `git rev-parse origin/develop` and inspect all four jobs of its latest GitHub CI run: web, API, database, and images. Do not deploy a different SHA on the strength of an older run.
2. Run `npm run supabase -- migration list --linked` from the **release commit**. Every local migration must have a remote version. A migration visible only on another work-in-progress branch does not belong to this release.
3. Keep the payments branch and its unapplied migration out of this launch until its human-reviewed PR is ready.

## 2. Prepare Supabase for public signup

In the existing project `moeronogmgtmbdnzfzgu` (Mumbai), upgrade the currently **Free** organization to Pro after reviewing checkout. In Auth, configure a **verified custom SMTP sender** for confirmation and password reset mail; the app's optional `RESEND_API_KEY` is for interview reminders and does not configure Supabase Auth email. Resend's current Free tier includes SMTP, 3,000 emails/month and 100/day, which is a reasonable low-volume starting point after verifying `untiered.tech` (or a sending subdomain) and its DNS records. Disable email link tracking so confirmation links are not rewritten. [Resend pricing](https://resend.com/pricing), [Supabase SMTP guidance](https://supabase.com/docs/guides/auth/auth-smtp).

Set Site URL to `https://untiered.tech` and allow `https://untiered.tech/auth/callback`. Keep email confirmation enabled. Check the Google OAuth provider and its Supabase callback URL, then test both Google and email signup with an address outside the project team. Turnstile requires both the public web site key and Supabase's matching secret in Auth CAPTCHA settings. Record a successful restore drill using an isolated target before public data is accepted; do not restore over the live project. Review Supabase Security Advisor, RLS, SSL, and auth rate limits. [Supabase production checklist](https://supabase.com/docs/guides/deployment/going-into-prod), [backups](https://supabase.com/docs/guides/platform/backups).

## 3. Deploy the API VM

Provision the VM with a **static public IP**, Docker Engine and Compose plugin, SSH key access, and firewall inbound TCP 22 restricted to the operator's IP plus TCP 80/443 from the internet. Do not expose port 8080 or Postgres. Add an `A` record for `api.untiered.tech` pointing to that static IP and wait for it to resolve before starting Caddy. Caddy obtains and renews HTTPS certificates; its data volume must persist across releases.

Copy `deploy/compose.yaml`, `deploy/Caddyfile`, `deploy/.env.example`, and `deploy/api.env.example` into one private directory on the VM. Rename the examples to `.env` and `api.env`; fill the values, set both files to mode `600`, and keep them outside Git. `DATABASE_URL` uses Supabase's **session pooler on port 5432** with TLS. `WEB_ALLOWED_ORIGINS=https://untiered.tech`. Choose `AI_DAILY_SPEND_CAP_MICRO_USD` and confirm the provider-side Gemini budget before opening interviews; the app limit guards only optional calls and is not a hard bill cap. Leave the optional second AI provider key empty for the first release.

Build the API image on a machine with enough memory from the verified release checkout, then transfer the saved image to the VM. Building the Gradle image on a 2 GB VM may exhaust its memory. Example, substituting the verified 12-character SHA for `<sha>`:

```sh
docker build -t untiered-api:<sha> apps/api
docker save -o untiered-api.tar untiered-api:<sha>
scp untiered-api.tar ubuntu@<vm-ip>:~/untiered/
ssh ubuntu@<vm-ip> 'docker load -i ~/untiered/untiered-api.tar'
```

Set `RELEASE_TAG=<sha>` in the VM's `deploy/.env`, then from that directory run `docker compose config -q` and `docker compose up -d`. Check `https://api.untiered.tech/actuator/health/readiness` and `docker compose logs --tail=100 api proxy`. The proxy is the only published service. Observe VM memory and restarts under actual traffic. For rollback, set `RELEASE_TAG` to the previous loaded green image and run `docker compose up -d` again; database migration compatibility must be checked separately.

## 4. Configure Vercel web

Import the GitHub repository as **one Next.js project**, with Root Directory `apps/web`; enable “Include source files outside of the Root Directory” for `packages/shared` and the workspace lockfile. Set the Production branch to **`develop` before the first production deploy**. Set Node.js 22 and use the repository's normal install/build commands unless Vercel's detected workspace build proves inadequate. Add `untiered.tech` as its production domain; follow Vercel's displayed DNS records for the apex. Avoid pointing `api.untiered.tech` to Vercel. [Vercel monorepos](https://vercel.com/docs/monorepos/monorepo-faq), [production branch](https://vercel.com/docs/git#production-branch).

Set these **Production** variables before building:

| Variable | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Existing project's public URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Existing publishable/anon key; public by design |
| `NEXT_PUBLIC_API_BASE_URL` | `https://api.untiered.tech` |
| `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | Site key paired with Supabase Auth secret |
| `NEXT_PUBLIC_LEGAL_OPERATOR_NAME` | Owner-approved legal operator name |
| `NEXT_PUBLIC_GRIEVANCE_OFFICER_NAME` | Owner-approved grievance contact name |
| `NEXT_PUBLIC_FEATURE_MOCK_INTERVIEWS` | `true` only when API and AI budgets are ready |

The legal details need the owner's judgement. Do not publish their placeholder text as a finished legal page. Other feature flags may retain repo defaults. Public `NEXT_PUBLIC_*` values are compiled into the bundle; changing them requires redeployment. Keep Preview deployments away from production Supabase credentials until their callback URLs and access policy are defined. Do not put `SUPABASE_SERVICE_ROLE_KEY`, `DATABASE_PASSWORD`, or `GEMINI_API_KEY` in Vercel.

## 5. Release checks and rollback

1. Confirm apex DNS, `api` DNS, TLS, and the exact deployed commit in Vercel and on the VM.
2. Visit `/`, `/login`, `/privacy`, `/terms`, and `/contact` on the production domain. Check the legal details and mobile layout.
3. Test email confirmation, password reset, Google OAuth, an authenticated dashboard, resume upload, and resume deletion with controlled test data. Check browser CORS and API logs. These checks must not start a live interview or invoke Gemini.
4. Confirm Supabase backup availability and the isolated restore evidence; observe auth and API error rates, storage use, Gemini ledger and provider budget, and VM memory.
5. A complete spoken interview/report and human assessment of voice and latency require the owner's explicit go-ahead for live AI calls. If the checks above fail, leave public signup closed until fixed. Roll back Vercel to the last green deployment and the API to the previous loaded image where appropriate.

**Status on 18 October 2026:** configuration prepared, **not deployed**. The available browser reaches Vercel's login page, so no Vercel project or plan has been verified here. The apex already resolves to `2.57.91.91` and serves an `hcdn` page; confirm its existing content before switching DNS to Vercel. `api.untiered.tech` has no DNS record yet. The linked Supabase organization is **Free**; Auth Site URL and redirect allow-list still point to `localhost:3000`, custom SMTP and CAPTCHA are off, and the backup API returns zero backups. Supabase is healthy in Mumbai and `develop` migrations are applied. Security Advisor has five warnings for review. No VM, API DNS/TLS, production signup, backup restore, or live AI check has been completed.
