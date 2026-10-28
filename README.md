# Untiered

Voice-first AI mock interviews grounded in how interviews at real employers actually
run. The candidate names a company and a role at the start of each session and takes a
spoken interview conducted the way that employer runs one, then gets an
evidence-backed report.

Requirements live in [`docs/InterviewOS_PRD_v1.1.pdf`](docs/InterviewOS_PRD_v1.1.pdf).
Working agreements for this repository live in [`CLAUDE.md`](CLAUDE.md).

---

## Layout

```
apps/web            Next.js frontend (App Router, TypeScript, Tailwind)
apps/api            Spring Boot backend (Kotlin, Gradle)
packages/shared     TypeScript types for the public API contract
supabase/           Database schema, seed data and local-stack config (Supabase CLI)
docs                PRD and design notes
tasks               Task files for autonomous runs
scripts             Local development helpers
```

The database schema is owned by the Supabase CLI, in `supabase/migrations`. The API
reads and writes rows; it never runs DDL.

---

## Running it locally

You need **Node 20.12+** and a **JDK** (Gradle fetches Java 21 itself if you have a
different one).

### 1. Configure

```bash
cp .env.example .env
npm install
```

Fill in `.env` — both apps read this one file, and every key is documented there.

### 2. Point at a database

**Hosted Supabase** (the default; required for Google sign-in):

```bash
npm run db:login         # once per machine
npm run db:link          # once per clone; also sets up the IPv4 connection
npm run db:push          # applies supabase/migrations
```

If you are signed in to more than one Supabase account, skip `db:login` and put a
personal access token for the owning account in `.env` as `SUPABASE_ACCESS_TOKEN`
instead — see "Two Supabase accounts" below.

Then set the `DATABASE_*` values in `.env`, taking the password from **Settings →
Database**:

```
DATABASE_URL=jdbc:postgresql://aws-0-<region>.pooler.supabase.com:6543/postgres?sslmode=require&prepareThreshold=0
DATABASE_USER=postgres.<project-ref>
DATABASE_PASSWORD=<database password>
```

Two things that will otherwise cost you an afternoon:

- **Use the pooler host, not `db.<ref>.supabase.co`.** The direct host is IPv6-only, and
  most networks cannot reach it. The CLI reports this as
  `IPv6 is not supported on your current network`.
- **On a laptop, use port 6543 with `prepareThreshold=0`, not 5432.** Both ports are on
  the pooler host. 5432 is session mode: each API holds its connections (up to 10) for as
  long as it runs, and the project's session pool is 15 clients shared with production, so
  two laptops running `npm run dev` can starve the deployed API. 6543 is transaction mode,
  which lends a connection per transaction. `prepareThreshold=0` is required there: it
  stops the JDBC driver using server-side prepared statements, which transaction mode
  cannot carry between transactions. The deployed API stays on 5432.

**Local stack** (needs Docker; gives you Postgres, Auth, Storage and Studio):

```bash
npm run db:start         # prints local URLs and keys
npm run db:reset         # applies migrations, then supabase/seed.sql
```

Point `.env` at it — `jdbc:postgresql://localhost:54322/postgres`, user `postgres`,
password `postgres` — and use the local URL and anon key it printed for the
`NEXT_PUBLIC_SUPABASE_*` and `SUPABASE_URL` values.

### 3. Enable Google sign-in

Google is the only way in, so nothing works until this is configured. For the hosted
project, in the Supabase dashboard — **Authentication → Sign In / Providers → Google**:

1. Create an OAuth client in the Google Cloud console (type: *Web application*).
2. Add `https://<project-ref>.supabase.co/auth/v1/callback` as an authorised redirect
   URI there.
3. Paste the client ID and secret into Supabase and enable the provider.
4. Under **Authentication → URL Configuration**, add `http://localhost:3000/**` to the
   redirect allow list.

For the local stack, put the same client ID and secret in `.env` as
`SUPABASE_AUTH_EXTERNAL_GOOGLE_CLIENT_ID` / `_SECRET` and add
`http://localhost:54321/auth/v1/callback` to the Google client's redirect URIs.

### 4. Start both apps

```bash
npm run dev
```

The API serves on [localhost:8080](http://localhost:8080), the web app on
[localhost:3000](http://localhost:3000). Sign in, and you land on an empty
authenticated dashboard.

Check the API on its own:

```bash
curl http://localhost:8080/api/health
curl -i http://localhost:8080/api/v1/me            # 401 without a token
curl http://localhost:8080/api/v1/me -H "Authorization: Bearer <access token>"
```

---

## Database workflow

**Always drive the CLI through `npm run db:*`, never a bare `supabase`.** Those scripts
run the pinned CLI with `.env` loaded. A globally installed CLI — scoop, brew, the
installer — will usually be older, and an older CLI cannot parse a
`supabase/config.toml` written by a newer one:

```
failed to parse config: 'experimental' has invalid keys: pgdelta
```

That is a version mismatch, not a broken config.

### Two Supabase accounts

`supabase login` stores exactly one token per machine, so if you belong to more than one
account the last login wins — and every command then fails with:

```
Your account does not have the necessary privileges to access this endpoint
```

That message reads like a permissions tier, but it usually means the wrong account.
`npm run supabase -- projects list` shows what the current token can actually see; if
this project is not in that list, that is the problem.

The fix is to pin the repository rather than the machine: create a personal access
token at <https://supabase.com/dashboard/account/tokens> while signed in as the account
that owns the project, and put it in `.env` as `SUPABASE_ACCESS_TOKEN`. It overrides the
global login for this repo only, so your other account keeps working everywhere else.

| Command | What it does |
|---|---|
| `npm run db:login` | Store a CLI login for this machine |
| `npm run db:link` | Link this clone to the hosted project (once) |
| `npm run db:start` / `db:stop` | Local Supabase stack (Docker) |
| `npm run db:reset` | Rebuild the local database from migrations, then seed |
| `npm run db:push` | Apply pending migrations to the linked hosted project |
| `npm run db:diff <name>` | Write a new migration from local schema changes |
| `npm run db:lint` | Static checks on the schema |

Never edit an applied migration. Add a new one.

---

## Verification loop

Run before opening a PR. CI runs exactly this on every push.

```bash
# frontend and shared types
npm run typecheck && npm run lint && npm run test && npm run build

# backend
cd apps/api && ./gradlew ktlintCheck test build
```

---

## Conventions

- Branch as `feat/<slug>` or `fix/<slug>`, merge into `develop`. `main` is
  release-only and moves through a pull request, by hand — agents push to `develop`
  and nothing else.
- Conventional commits, referencing the PRD section: `feat: resume upload (PRD 05)`.
- Never commit `.env`. New secrets go into `.env.example` with an empty value.
