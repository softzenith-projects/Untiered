# Testing Untiered Campus on your own machine

Invites cannot be accepted locally (the invite email goes through SES), and every college
dashboard is empty until students have completed work. `scripts/campus-demo-seed.mjs` fills a
**local** database with a demo college so you can click through the whole portal.

The scores it writes are **synthetic demo data, not real interviews**. Report payloads are
marked as demo reports, and no AI is called.

## One-time setup

1. Start local Supabase and apply every migration:
   `npm run db:start`, then `npm run supabase -- migration up --local`.
2. In `.env`, set `NEXT_PUBLIC_FEATURE_CAMPUS=true` (the API and the web app both read it),
   then restart `npm run dev`.
3. Optional, for the platform-admin pages (`/admin/campus`): put your email in `ADMIN_EMAILS`.
4. Sign in once in the running app with each account you want to use (Google). The seed links
   *existing* accounts; it never creates real ones.

## Seed

```bash
npm run campus:seed-demo -- --yes --staff you@gmail.com
# several accounts, other roles, and a student:
npm run campus:seed-demo -- --yes --staff you@gmail.com:tpo --staff second@gmail.com:faculty --student third@gmail.com
```

- `--staff <email>[:role]` — `tpo` (default), `college_admin` or `faculty`. A faculty member is
  scoped to the CSE department and the IT 2027 batch.
- `--student <email>` — joins "CSE 2027" as a student with no synthetic work, so you see the
  student side (assignments to take).
- `--yes` is required. The script prints the target (`host:port/db`) first and refuses unless
  `DATABASE_URL` points at `localhost` or `127.0.0.1` (default `localhost:54322`, the Supabase
  CLI port). It runs SQL through `docker exec` into the container publishing that port, so Docker
  must be running. A linked account that is already a student of a different college is rejected.

Re-running replaces the demo data. An email with no local account fails with "sign in once first".

## What you get

"Demo Engineering College (demo data)": departments CSE, ECE, IT; batches CSE 2026, CSE 2027,
ECE 2027, IT 2027; 60 synthetic students (`demo-student-NN@example.invalid`, "Demo Student NN")
across every readiness band, some inactive or with no evidence; open invites; twelve published
assignments plus a draft (interview rounds of several types and components, Arena scenario sets
built from live scenarios, one in-progress and overdue work); completed attempts spread over
the last eight weeks with demo reports; one programme run from a demo template; staff notes; some
integrity counters; and two demo leads (new, contacted).

## Where to click

Signed in as your staff account: `/campus` (overview, bands, heatmap, pipeline, trends, batches),
`/campus/students`, `/campus/readiness`, `/campus/attention`, `/campus/assignments`,
`/campus/programmes`, `/campus/structure`, `/campus/staff`, `/campus/reports`.
As a student account: `/campus/me`. As a platform admin: `/admin/campus` (colleges, leads,
programmes, usage).

## Reset

```bash
npm run campus:seed-demo -- --yes --reset
```

Deletes exactly the demo college (slug `demo-engineering-college-demo`), the synthetic users,
the demo leads and the demo programme template. Your linked accounts are kept; only their demo
memberships go.

## Checking the script

`CAMPUS_SEED_TEST_DATABASE_URL=jdbc:postgresql://127.0.0.1:55322/postgres node --test scripts/campus-demo-seed.test.mjs`
runs seed, counts, re-seed and reset against a throwaway local database (the database test is
skipped when the variable is unset).
