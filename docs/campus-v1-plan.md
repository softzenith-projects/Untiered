# Untiered Campus — plan for modules 1–4

Status: **for owner review. No backend code written.** Spec: [campus-v1-spec.md](campus-v1-spec.md).
Written 13 November 2026 against `develop` at `c984459`.

---

## Step 1 — What exists, what conflicts

### Reusable as is

| Need in the spec | What already exists | Where |
|---|---|---|
| Sign-in, identity | Supabase Auth (Google, email+password); API takes the user id only from the verified JWT | `SupabaseIdentity`, `SecurityConfig` |
| A user row on first visit | `UserRepository.provision` on `GET /me` | `user/` |
| `PLATFORM_ADMIN` | Config allow-list of emails + pinned user ids, 404 for everyone else | `sources/AdminAccess.kt` (`interviewos.admin`) |
| AI mock interview | `InterviewService.start` with `RoundType` (technical fundamentals, project deep-dive, coding practical, aptitude, HR fit, …), `RoundLength` (30/45/60) | `interview/` |
| Fresher-appropriate rounds | `DeclaredStage.STUDENT` and `CampusRounds` already change what a round covers for a student | `interview/CandidateStage.kt` |
| Per-interview detail (questions, evidence, strengths, gaps) | The existing report, evidence-checked | `ReportService` |
| Server-graded practice | Scenario Arena: answer keys in Postgres, graded server-side | `arena/ScenarioArenaController.kt`, `arena_scenario_steps` |
| Admission + funding in one transaction | Entitlement decision, then `insertSession` + charge, same transaction | `InterviewService` admission, `Entitlement.kt` |
| Email | SES sender, outbox + job pattern, per-user preferences and unsubscribe | `email/` |
| File storage (logos) | Supabase Storage client, deletion outbox | `storage/` |
| AI cost per interview | `ai_calls` ledger, already used for spend reporting | `ai/AiSpend.kt` |
| Integrity signals (module 5) | Client events per session, `answer_timing` | `InterviewTelemetry.kt` |
| Feature switches | `interviewos.features.*` + interceptor that 404s a switched-off surface | `config/ProductFeatures.kt`, `lib/flags.ts` |
| Real-Postgres tests in CI | `database` job: local Supabase, every migration applied, runs `*DatabaseIntegrationTest` | `.github/workflows/ci.yml` |

### Conflicts with the spec, and how the plan resolves each

1. **The API bypasses Postgres RLS.** It connects as the database owner; the existing RLS
   policies govern only direct PostgREST access (`20260825000000_initial_schema.sql`, line
   ~199). So "Postgres RLS as a safety net" does not protect API queries without changing
   the connection role. → See §2.
2. **No Hibernate.** Data access is `JdbcClient` with hand-written SQL. Hibernate filters
   are not an option.
3. **Arena MCQ correctness is decided by the browser.** `ArenaController.answer` stores
   `request.correct` as sent. Fine for personal practice, wrong for a score a college acts
   on. → MCQ tests deferred to 4b; scenario sets (server-graded) are assignable in v1.
4. **Funding.** `Entitlement` pays for a round from the student's free rounds or credits.
   A college-assigned round must not spend either. → New funding source `ORG` (§1, module 4).
5. **Email outbox is keyed by `user_id`.** An invitee has no user row. → Invites carry
   their own send status (`campus_invites`).
6. **"Optional recording consent" on joining** contradicts the per-round hard gate. →
   Dropped from the join screen; the round gate is unchanged.
7. **`PLATFORM_ADMIN` as a role.** Admin is deliberately a config allow-list, not a column
   anybody could be granted through a bug. → Kept that way.
8. **No admin UI exists in the web app** (admin endpoints are API-only). → The super-admin
   screen is new (`/admin/campus`).
9. **"Difficulty"** is not a concept; rounds adapt. → Assignment sets candidate stage.
10. **Name collision:** `ReadinessService` (company/role readiness) and `CampusRounds`
    exist. New code lives in a `campus` package and the module-6 score is
    `CampusReadiness`, to keep them apart.

---

## 1. Database schema

Conventions followed (from the existing migrations): one file per change in
`supabase/migrations/<yyyymmddhhmmss>_<name>.sql`, a header comment explaining *why*,
`uuid` keys with `gen_random_uuid()`, `text` + `check` constraints rather than many enums,
`on delete cascade` from `public.users`, RLS enabled on every user-data table, `comment
on` for anything non-obvious.

**Two isolation devices built into the schema:**

- **Every college-scoped table carries `org_id`**, and every parent a child can point at
  exposes `unique (org_id, id)`. Children reference parents with **composite foreign keys
  `(org_id, parent_id)`**. The database itself then refuses a batch in College A pointing
  at a department of College B, or an assignment of A targeting a student of B — even if
  a service bug tried to write one.
- **RLS on, no `authenticated` policies** on staff-only tables: PostgREST (the browser's
  direct Supabase path) can read nothing. Students get a select-own policy on their own
  membership only.

### Migration A — `…_campus_organisations.sql` (modules 1 + 2)

```sql
-- Untiered Campus: organisations, their structure, and who belongs to them (campus spec §1–2).
--
-- Every college-scoped row carries org_id, and children reference parents through
-- (org_id, id) composite keys, so a row of one college can never point at a row of
-- another — the database refuses it whatever the service layer does.
--
-- PLATFORM_ADMIN is deliberately not here: it stays the interviewos.admin allow-list.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'college' check (kind in ('college')),  -- 'employer' later
  name text not null check (length(btrim(name)) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  city text check (length(city) <= 120),
  state text check (length(state) <= 120),
  logo_path text,                                   -- object key in the org-logos bucket
  contact_name text check (length(contact_name) <= 200),
  contact_email text check (length(contact_email) <= 320),
  contact_phone text check (length(contact_phone) <= 40),
  status text not null default 'active' check (status in ('active', 'suspended')),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.org_departments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  code text not null check (code ~ '^[A-Z0-9&-]{1,16}$'),     -- CSE, IT, ECE
  name text not null check (length(btrim(name)) between 1 and 160),
  created_at timestamptz not null default now(),
  unique (org_id, code),
  unique (org_id, id)
);

create table public.org_batches (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  department_id uuid not null,
  graduation_year smallint not null check (graduation_year between 2000 and 2100),
  name text not null check (length(btrim(name)) between 1 and 80),  -- "CSE 2027"
  created_at timestamptz not null default now(),
  unique (org_id, name),
  unique (org_id, id),
  foreign key (org_id) references public.organisations (id) on delete cascade,
  foreign key (org_id, department_id) references public.org_departments (org_id, id) on delete restrict
);

-- One row per person per college. A person holds one role in a college; a student is in
-- at most one college at a time (partial unique index below).
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('college_admin', 'tpo', 'faculty', 'student')),
  batch_id uuid,
  roll_number text check (length(roll_number) <= 40),
  status text not null default 'joined' check (status in ('joined', 'left', 'removed')),
  -- What the student agreed to share, and when (campus spec §3). Staff do not consent here.
  consent_version text,
  consented_at timestamptz,
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete restrict,
  constraint org_members_student_has_batch check ((role = 'student') = (batch_id is not null)),
  constraint org_members_student_consented check (role <> 'student' or consented_at is not null),
  constraint org_members_ended check ((status = 'joined') = (ended_at is null))
);

create unique index org_members_one_role_per_org
  on public.org_members (org_id, user_id) where status = 'joined';
create unique index org_members_one_college_per_student
  on public.org_members (user_id) where role = 'student' and status = 'joined';
create unique index org_members_roll_number
  on public.org_members (org_id, roll_number) where status = 'joined' and roll_number is not null;
create index org_members_org_role_idx on public.org_members (org_id, role) where status = 'joined';
create index org_members_batch_idx on public.org_members (org_id, batch_id) where status = 'joined';

-- A faculty member sees nothing until scoped: deny by default (campus spec §2).
create table public.org_faculty_scopes (
  org_id uuid not null,
  member_id uuid not null,
  department_id uuid,
  batch_id uuid,
  constraint org_faculty_scopes_one_target check (num_nonnulls(department_id, batch_id) = 1),
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete cascade,
  foreign key (org_id, department_id) references public.org_departments (org_id, id) on delete cascade,
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade
);
create unique index org_faculty_scopes_unique
  on public.org_faculty_scopes (member_id, coalesce(department_id, batch_id));

-- Who viewed, exported or changed what. Ids only; never a student's answers or email.
create table public.org_audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  actor_user_id uuid references public.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('member', 'platform_admin', 'system')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),  -- 'report.viewed', 'students.exported'
  target_type text,
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index org_audit_log_org_idx on public.org_audit_log (org_id, occurred_at desc);

-- Append-only, even for the owner role the API connects as.
create function public.org_audit_log_append_only() returns trigger language plpgsql as $$
begin
  raise exception 'org_audit_log is append-only';
end $$;
create trigger org_audit_log_no_update before update on public.org_audit_log
  for each row execute function public.org_audit_log_append_only();
-- (Deletes are allowed only by cascade from organisations, which a trigger on DELETE would block;
--  so DELETE is left to the cascade and no API path issues one.)

alter table public.organisations enable row level security;
alter table public.org_departments enable row level security;
alter table public.org_batches enable row level security;
alter table public.org_members enable row level security;
alter table public.org_faculty_scopes enable row level security;
alter table public.org_audit_log enable row level security;

create policy org_members_select_own on public.org_members
  for select to authenticated using ((select auth.uid()) = user_id);
```

### Migration B — `…_campus_invites.sql` (module 3)

```sql
-- Student and staff onboarding (campus spec §3).
--
-- No account is created at import. An invite is an email address plus a single-use token;
-- the person signs in however they like and accepting the invite links that account. The
-- token is stored only as a SHA-256 hash, so a database read cannot be replayed as a link.
--
-- Import previews are kept server-side so that "commit" acts on what was validated, not on
-- what a browser re-sends, and are deleted a day later: they are a list of names and emails.

create table public.campus_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  status text not null default 'previewed' check (status in ('previewed', 'committed', 'discarded')),
  row_count integer not null check (row_count between 0 and 5000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  unique (org_id, id)
);

create table public.campus_import_rows (
  org_id uuid not null,
  import_id uuid not null,
  row_number integer not null check (row_number >= 1),
  full_name text,
  email text,
  roll_number text,
  department_code text,
  batch_name text,
  graduation_year smallint,
  batch_id uuid,                                    -- resolved during validation
  problems text[] not null default '{}',            -- 'bad_email', 'duplicate_in_file', 'unknown_batch', …
  primary key (import_id, row_number),
  foreign key (org_id, import_id) references public.campus_imports (org_id, id) on delete cascade,
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade
);

create table public.campus_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  role text not null check (role in ('college_admin', 'tpo', 'faculty', 'student')),
  batch_id uuid,
  email text not null check (email = lower(btrim(email)) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  roll_number text check (length(roll_number) <= 40),
  token_hash bytea not null unique,
  status text not null default 'invited' check (status in ('invited', 'joined', 'revoked', 'expired')),
  member_id uuid,
  invited_by uuid references public.users (id) on delete set null,
  invited_by_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  joined_at timestamptz,
  -- Send state, because email_deliveries is keyed by a user this person may not have yet.
  send_status text not null default 'pending' check (send_status in ('pending', 'sending', 'sent', 'failed')),
  send_count integer not null default 0 check (send_count between 0 and 10),
  last_sent_at timestamptz,
  send_error text,
  unique (org_id, id),
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete restrict,
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete set null (member_id),
  constraint campus_invites_student_has_batch check ((role = 'student') = (batch_id is not null)),
  constraint campus_invites_joined check ((status = 'joined') = (joined_at is not null))
);
create unique index campus_invites_open_per_email
  on public.campus_invites (org_id, email) where status in ('invited', 'joined');
create index campus_invites_pending_send_idx on public.campus_invites (id) where send_status = 'pending';
create index campus_invites_org_status_idx on public.campus_invites (org_id, status);

alter table public.campus_imports enable row level security;
alter table public.campus_import_rows enable row level security;
alter table public.campus_invites enable row level security;
```

"Active" is **derived, not stored** (CLAUDE.md: progress is derived): a joined student
with a session or an Arena answer in the last 14 days.

### Migration C — `…_campus_assignments.sql` (module 4)

```sql
-- Assignments (campus spec §4).
--
-- Recipients are derived from targets at read time (a batch, or named students), so a
-- student who joins a batch later sees its open assignments, and nothing has to be kept
-- in step. Attempts are the record of what happened, and they are what the caps count.
--
-- A college-assigned interview is paid for by the college, from organisations.
-- interview_allowance; it never spends a student's free rounds or credits. Usage is the
-- count of org-funded attempts not handed back after a failure on our side — a ledger
-- derived from rows, never a counter (as with interview_credits).

alter table public.organisations
  add column interview_allowance integer not null default 0 check (interview_allowance >= 0);

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by_member_id uuid,
  kind text not null check (kind in ('interview', 'arena_scenarios')),
  title text not null check (length(btrim(title)) between 1 and 140),
  instructions text check (length(instructions) <= 2000),
  -- interview
  round_type text,                     -- RoundType.dbValue, validated by the API
  duration_minutes smallint check (duration_minutes in (30, 45, 60)),
  company_name text check (length(company_name) <= 120),
  role_title text check (length(role_title) <= 120),
  candidate_stage text check (candidate_stage in ('student', 'recent_graduate')),
  language text not null default 'english' check (language in ('english', 'hindi_english')),
  -- arena_scenarios
  scenario_ids text[],
  opens_at timestamptz not null default now(),
  due_at timestamptz not null,
  allow_late boolean not null default false,
  attempt_limit smallint not null default 1 check (attempt_limit between 1 and 10),
  -- Most org-funded interviews one student may use on this assignment. Never above attempt_limit.
  interview_cap smallint check (interview_cap between 1 and 10),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  foreign key (org_id, created_by_member_id) references public.org_members (org_id, id) on delete set null (created_by_member_id),
  constraint assignments_interview_fields check (
    kind <> 'interview' or (round_type is not null and duration_minutes is not null)),
  constraint assignments_scenario_fields check (
    kind <> 'arena_scenarios' or cardinality(scenario_ids) between 1 and 20),
  constraint assignments_due_after_open check (due_at > opens_at),
  constraint assignments_cap_within_attempts check (interview_cap is null or interview_cap <= attempt_limit)
);
create index assignments_org_status_idx on public.assignments (org_id, status, due_at);

create table public.assignment_targets (
  org_id uuid not null,
  assignment_id uuid not null,
  batch_id uuid,
  member_id uuid,
  constraint assignment_targets_one check (num_nonnulls(batch_id, member_id) = 1),
  foreign key (org_id, assignment_id) references public.assignments (org_id, id) on delete cascade,
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade,
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete cascade
);
create unique index assignment_targets_unique
  on public.assignment_targets (assignment_id, coalesce(batch_id, member_id));
create index assignment_targets_batch_idx on public.assignment_targets (org_id, batch_id) where batch_id is not null;
create index assignment_targets_member_idx on public.assignment_targets (org_id, member_id) where member_id is not null;

create table public.assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  assignment_id uuid not null,
  member_id uuid not null,
  session_id uuid references public.sessions (id) on delete set null,   -- interview kind
  org_funded boolean not null default false,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned', 'failed')),
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, assignment_id) references public.assignments (org_id, id) on delete cascade,
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete cascade
);
create unique index assignment_attempts_session on public.assignment_attempts (session_id) where session_id is not null;
create index assignment_attempts_member_idx on public.assignment_attempts (org_id, assignment_id, member_id);
-- Allowance usage: counted under a lock on the organisation row at admission.
create index assignment_attempts_org_funded_idx on public.assignment_attempts (org_id)
  where org_funded and status <> 'failed';

alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.assignment_attempts enable row level security;
```

`sessions` is **not** given an `org_id`: a round stays the student's; the college's link to
it is the attempt row. Deleting a round (`RoundDeletion`) sets `session_id` null and the
attempt still counts against the cap, exactly as a deleted round still counts against
credits today.

**Deletion.** Account deletion: memberships, attempts and faculty scopes cascade; audit
rows keep the action with a null actor; invites to that email are revoked by
`AccountDeletion` (they hold an address, not a user id). Organisation deletion (platform
admin only): everything cascades; the logo goes through the existing storage deletion
outbox.

---

## 2. Tenant isolation

**Recommendation: enforce in the service layer through a single access gate and a typed
scope, with the schema's composite foreign keys and a real-Postgres isolation suite as the
safety net. Do not adopt Postgres RLS for API queries now.**

### How it works

1. **One gate.** `CampusAccess.resolve(identity, orgId)` reads the caller's `joined`
   membership in that org (or recognises a platform admin through `AdminAccess`) and
   returns an `OrgScope`: `orgId`, role, and — for faculty — the allowed department and
   batch ids. No membership → **404** (not 403, matching `AdminAccess`: don't confirm the
   college exists).
2. **The scope is the only way into a repository.** Every campus repository method takes
   `OrgScope` as its first parameter and binds `scope.orgId` into its SQL; `OrgScope`'s
   constructor is `internal` to the `campus` package and only `CampusAccess` makes one. A
   controller cannot reach college data without having passed the gate — the compiler
   enforces it.
3. **Faculty narrowing** is applied by the same scope: queries over students/assignments
   add `and batch_id = any(:batchIds)` (department scopes expand to their batches at
   resolve time). An unscoped faculty member resolves to an empty list → sees nothing.
4. **IDs from the path are never trusted alone.** `/orgs/{orgId}/batches/{batchId}` is
   always looked up `where org_id = :orgId and id = :batchId`; a B batch id under an A path
   is a 404.
5. **The database refuses cross-org links** via composite FKs (§1), so even a buggy write
   cannot connect A's assignment to B's student.
6. **A source-level guard test**: a unit test reads every `.kt` file in `campus/` and fails
   if any SQL string that names a campus table lacks an `org_id = :orgId` predicate (with
   an explicit, reviewed allow-list for the platform-admin listing). Cheap, and it catches
   the "new query forgot the filter" bug at PR time.
7. **Isolation suite (`CampusIsolationDatabaseIntegrationTest`)** runs in the existing CI
   `database` job against migrated Postgres: seeds College A and B, then for every
   endpoint asserts that an A staff member gets 404 on each B resource id, that list
   endpoints never return a B row, that A cannot target a B batch/student (rejected by
   service *and* by FK), and that faculty scoped to batch X cannot see batch Y. A failing
   isolation test blocks the merge.

### Why not RLS (or Hibernate filters) now

- **Hibernate filters**: there is no Hibernate; the codebase is `JdbcClient` + SQL.
- **RLS for the API** would need the API to stop connecting as the table owner, switch to a
  non-owner role, and `set local app.org_id = …` at the start of every transaction (this
  works with Supabase's transaction pooler, but only *inside* a transaction). That changes
  the connection model for every existing query in the product, not just campus ones,
  and code paths that run outside an explicit transaction would silently see zero rows.
  That's a larger and riskier change than modules 1–4 themselves.
- **When to revisit**: if campus grows to many repositories or a second team, a dedicated
  `campus_api` login role with RLS on the campus tables only (owner connection kept for
  everything else) is the next step. The `org_id` + composite-key schema above is already
  RLS-ready, so that's additive.

---

## 3. Role and permission model

Permissions are checked by name in services (`scope.require(Permission.ASSIGNMENTS_CREATE)`),
never by comparing role strings in controllers. The matrix:

| Permission | College admin | TPO | Faculty | Student | Platform admin |
|---|---|---|---|---|---|
| Create / suspend a college, set its interview allowance | – | – | – | – | ✓ |
| Invite the first college admin | – | – | – | – | ✓ |
| Edit college profile and contact | ✓ | – | – | – | ✓ |
| Invite / remove staff, set faculty scopes | ✓ | – | – | – | ✓ |
| Manage departments and batches | ✓ | ✓ | – | – | ✓ |
| Import and invite students, resend, revoke | ✓ | ✓ | – | – | – |
| View students and invite status | ✓ | ✓ | scoped | – | audited |
| Create / publish assignments | ✓ | ✓ | scoped batches & their students | – | – |
| View assignment progress | ✓ | ✓ | scoped | own only | audited |
| View a student's assignment report | ✓ | ✓ | scoped | own | audited |
| Export (CSV/PDF — module 7) | ✓ | ✓ | scoped | – | – |
| View audit log | ✓ | – | – | – | ✓ |
| See own assignments, start them, leave the college | – | – | – | ✓ | – |

- **Platform admin** is the existing allow-list; its reads of a college are written to that
  college's audit log with `actor_kind = 'platform_admin'`.
- **"Scoped"** = only the batches assigned to the faculty member, or the batches of the
  departments assigned to them.
- **One role per person per college.** A TPO who also teaches is a TPO.
- **A college never sees a student's personal (non-assigned) rounds** — recommended default,
  owner to confirm (§7).
- Every write and every report view or export is audit-logged.

---

## 4. REST API (modules 1–4)

All under `/api/v1`, bearer token required, behind a new feature switch
`interviewos.features.campus` (default **off**, so partial modules can merge to `develop`
dark). Errors use the existing `{ code, message }` shape. `{org}` = org id.

### Platform admin — `AdminAccess`, 404 for everyone else

| Method · path | Request → response |
|---|---|
| `GET /admin/campus/orgs` | → `[{ id, name, slug, city, state, status, memberCounts, interviewAllowance, interviewsUsed }]` |
| `POST /admin/campus/orgs` | `{ name, slug, city?, state?, contactName?, contactEmail?, contactPhone?, interviewAllowance }` → `OrgView` |
| `GET /admin/campus/orgs/{org}` | → `OrgView` |
| `PATCH /admin/campus/orgs/{org}` | any of the above + `status` → `OrgView` |
| `PUT /admin/campus/orgs/{org}/logo` | multipart image ≤ 512 KB, png/jpeg/webp → `{ logoUrl }` |
| `POST /admin/campus/orgs/{org}/invites` | `{ email, fullName, role: "college_admin"|"tpo" }` → `InviteView` |

### Caller context and joining

| Method · path | Role | Request → response |
|---|---|---|
| `GET /me/campus` | any | → `{ student: { orgId, orgName, logoUrl, batchName, rollNumber } \| null, staff: [{ orgId, orgName, role }] }` |
| `GET /campus/invites/{token}` | signed in | → `{ orgName, logoUrl, role, batchName?, invitedEmail (masked), signedInEmail, emailMatches, consentVersion, sharing: [...] }` · 404 if unknown/expired/revoked |
| `POST /campus/invites/{token}/accept` | signed in | `{ consentVersion, agreeDataSharing: true, agreeAiEvaluation: true, confirmDifferentEmail?: true }` → `/me/campus` view · 409 `already_in_college` |
| `POST /me/campus/leave` | student | → 204 |

### College — `/campus/orgs/{org}/…`, membership required

| Method · path | Role | Request → response |
|---|---|---|
| `GET /campus/orgs/{org}` | staff | → `OrgView` (+ allowance used/left) |
| `PATCH /campus/orgs/{org}` | admin | `{ contactName?, contactEmail?, contactPhone?, city?, state? }` |
| `GET /…/departments` · `POST` · `PATCH /{id}` · `DELETE /{id}` | admin, TPO (read: staff) | `{ code, name }` · delete refused (409) while batches exist |
| `GET /…/batches` · `POST` · `PATCH /{id}` · `DELETE /{id}` | admin, TPO (read: scoped staff) | `{ departmentId, graduationYear, name }` → `BatchView { …, studentCount }` · delete refused while members exist |
| `GET /…/members?role=&batchId=&departmentId=&status=&q=&cursor=` | staff (scoped) | → `{ items: [MemberView { id, name, email, role, batch, rollNumber, joinedAt, active }], next }` |
| `PATCH /…/members/{id}` | admin, TPO | `{ batchId?, rollNumber? }` |
| `DELETE /…/members/{id}` | admin (staff), admin/TPO (students) | removes from college; the account is untouched |
| `PUT /…/members/{id}/faculty-scopes` | admin | `{ departmentIds: [], batchIds: [] }` |
| `POST /…/imports` | admin, TPO | multipart CSV ≤ 1 MB, ≤ 5,000 rows → `ImportPreview { id, rows: [{ rowNumber, fullName, email, rollNumber, batchName, problems: [code] }], summary: { valid, withProblems } }` |
| `GET /…/imports/{id}` · `DELETE /…/imports/{id}` | admin, TPO | preview · discard |
| `POST /…/imports/{id}/commit` | admin, TPO | `{ skipRowsWithProblems: true }` → `{ invited, skipped }` |
| `GET /…/invites?status=&batchId=&cursor=` | admin, TPO | → `[InviteView { id, email, fullName, role, batch, status, sendStatus, lastSentAt, expiresAt }]` |
| `POST /…/invites` | admin (staff roles), admin/TPO (students) | `{ email, fullName, role, batchId?, rollNumber? }` |
| `POST /…/invites/{id}/resend` | admin, TPO | rotates token, extends expiry → `InviteView` · 429 after 10 sends |
| `POST /…/invites/{id}/revoke` | admin, TPO | → `InviteView` |
| `GET /…/audit-log?cursor=` | admin | → `[{ at, actor, action, target }]` |
| `GET /…/assignments?status=` | staff (scoped) | → `[AssignmentSummary { id, title, kind, dueAt, status, targets, counts: { notStarted, inProgress, completed, overdue } }]` |
| `POST /…/assignments` | admin, TPO, faculty (scoped targets) | `{ kind, title, instructions?, roundType?, durationMinutes?, companyName?, roleTitle?, candidateStage?, language?, scenarioIds?, opensAt?, dueAt, allowLate, attemptLimit, interviewCap?, targets: { batchIds: [], memberIds: [] } }` → `AssignmentView` (draft) |
| `GET /…/assignments/{id}` | staff (scoped) | → `AssignmentView` |
| `PATCH /…/assignments/{id}` | creator, admin, TPO | draft: any field; published: `dueAt`, `allowLate`, `instructions` only |
| `POST /…/assignments/{id}/publish` · `/archive` | creator, admin, TPO | → `AssignmentView` |
| `GET /…/assignments/{id}/progress?batchId=&status=` | staff (scoped) | → `[{ member, status, attemptsUsed, lastAttemptAt, sessionIds }]` |

### Student

| Method · path | Request → response |
|---|---|
| `GET /me/assignments` | → `[AssignedItem { id, title, kind, roundType?, durationMinutes?, dueAt, status: "not_started"\|"in_progress"\|"completed"\|"overdue", attemptsUsed, attemptLimit, canStart, blockedReason? }]` · `[]` for anyone not in a college |
| `POST /sessions` (existing) | gains optional `assignmentId`. When present the server **takes the round configuration from the assignment** (round type, length, company, role, stage, language) and ignores the client's; consent is still required per round. Response unchanged. |
| ~~`POST /me/assignments/{id}/scenario-attempts`~~ | **Superseded** (see `campus-api-contract.md`, Module 4): scenario completion is derived from the existing server-graded `user_step_answers`, so no attempt endpoint is needed |

### Cap enforcement (server-side, in `InterviewService` admission)

Inside the existing admission transaction, when `assignmentId` is present:

1. Resolve the student's `joined` membership; 404 if the assignment is not theirs (not
   targeted at their batch or them, not `published`, or in another college).
2. `select … from organisations where id = :org for update` — serialises concurrent
   starts in one college so the allowance can't be overspent by a race.
3. Refuse (409/402 with a specific `code`) if: not yet open; past due and `allow_late` is
   false; `attempts >= attempt_limit`; org-funded attempts by this student on this
   assignment `>= interview_cap`; org-funded attempts in the college `>= interview_allowance`.
4. One-session-at-a-time still applies (existing check).
5. Insert the session, then the attempt with `org_funded = true`. **No** `practice_usage`
   row and **no** credit charge.
6. If the round later ends `failed` (our fault), the attempt is marked `failed` and stops
   counting — the same hand-back rule credits follow.

Unit-tested as a pure decision (like `Entitlement`), plus a DB integration test that races
two starts at the last unit of allowance.

---

## 5. Linking flow — CSV student whose email already has an account

```
TPO uploads CSV ──► preview (server validates; does NOT reveal who already has an account)
               ──► commit ──► campus_invites row per valid line (token hash, 14-day expiry)
                         ──► invite job sends SES email: "Join <College> on Untiered"
                                link: https://untiered.tech/campus/join?token=<random 32 bytes>

Student clicks link ──► /campus/join is protected ──► /login?next=/campus/join?token=…
   ├─ Has an account → signs in with Google / password as usual (same auth user, same row)
   └─ No account     → signs up as usual; /me provisions the user row
──► GET /campus/invites/{token}: shows college, batch, what will be shared, and the email
    the invite went to vs the email they're signed in as
──► Student ticks consent ──► POST …/accept
       server, in one transaction:
         • invite is 'invited', unexpired, token hash matches
         • caller not already a joined student elsewhere (else 409 already_in_college)
         • insert org_members (user_id = caller from JWT, batch, roll no., consent version + time)
         • invite → 'joined', member_id set; audit 'member.joined'
──► Dashboard now shows "Assigned to you"
```

Why this satisfies "link, don't duplicate": **no account is ever created by the import**.
The member row points at whatever `auth.users` id signed in, so someone who already used
Untiered keeps their single account, history and credits.

**Email mismatch** (the common case in India: the college sheet has `roll@college.edu`,
the student signs in with Gmail). The token itself proves the student received the
invited mailbox's email, so the plan **allows accepting from a differently-addressed
account after an explicit confirmation** ("You're joining as a@gmail.com; the invite was
sent to r@college.edu"), records both, and shows the joined account's email to staff. The
stricter alternative — must sign in with the invited address — is one flag away. Owner
decision (§7).

**Never revealed:** the preview and the invite list never say whether an email already
has an Untiered account. Telling a college that would leak our user list.

---

## 6. Frontend routes

All new routes are behind `NEXT_PUBLIC_FEATURE_CAMPUS` and the API switch; signed-in
routes are added to the route guard (`proxy.ts` / `lib/supabase/session.ts`) and marked
noindex, so the SEO classification test stays green.

| Route | Who | What |
|---|---|---|
| `/colleges` | public, indexable | **Done today.** Partnership page; pilot CTA (mailto). |
| `/campus/join?token=` | signed in | Invite preview + consent screen (data sharing, AI evaluation, private staff comments notice), email-mismatch confirmation |
| `/campus` | staff | Overview: batches, joined vs invited counts, open assignments (charts come in module 7) |
| `/campus/students` | staff (scoped) | Table: filter by department, batch, status; search; resend / revoke invite; remove |
| `/campus/students/import` | admin, TPO | Upload → preview table with problem chips → commit |
| `/campus/structure` | admin, TPO | Departments and batches |
| `/campus/staff` | admin | Invite TPO/faculty; set faculty scopes |
| `/campus/assignments` | staff | List with completion counts |
| `/campus/assignments/new` | admin, TPO, faculty | Kind → round config or scenario picker → targets → deadline, attempts, cap → draft → publish |
| `/campus/assignments/[id]` | staff (scoped) | Per-student status table |
| `/campus/settings` | admin | College profile, audit log |
| `/admin/campus` · `/admin/campus/[orgId]` | platform admin | Create college, allowance, invite first admin. The API 404s non-admins; the page shows "not found". |
| `/dashboard` (existing) | student | **One addition:** an "Assigned to you" section above the current content, rendered only when `GET /me/assignments` is non-empty. Each item: title, round, due date, status pill, "Start" → `/interview/new?assignment=<id>` (form pre-filled and locked from the assignment; consent step unchanged). |

The staff portal uses the existing app shell with its own rail section; the org id comes
from `GET /me/campus` (a picker appears only if someone is staff in two colleges), not
from the URL, so links stay short. All data goes through `lib/api.ts` as today.

---

## 7. Risks, open questions, push-back

### Owner decisions needed before module 3 ships

1. **What can a college see?** Recommended: only rounds started from its assignments, plus
   rounds the student explicitly shares. Personal practice stays private. This defines
   modules 6–7 and the consent copy. *(Data-protection posture → a human decision per CLAUDE.md.)*
2. **Privacy policy and terms** must describe colleges as recipients of student data
   before the first real invite is sent. Under India's DPDP Act the student's consent at
   join is the basis; whether the college or Untiered is the fiduciary is a legal call.
3. **Email mismatch on accept** (§5): allow with confirmation (recommended) or require the
   exact invited address.
4. **Deadlines**: are attempts allowed after the due date? Plan: per-assignment `allow_late`, default no.
5. **Allowance numbers per college**: entered by hand by a platform admin; no billing in v1.
6. **After a student leaves**, does the college keep seeing their past assignment results?
   Recommended: no — access ends when membership ends; rows kept for the student only.

### Push-back on the source spec (all reflected in the adapted spec)

- **MCQ tests in v1** — current MCQs are graded in the browser. Deferred to 4b (server-held
  question/answer bank, seeded from course content), or ship scenario sets only.
- **"Optional recording consent" at join** — conflicts with the per-round hard gate; removed.
- **Auto-linking existing accounts by email** — would share a person's data with a college
  without their action, and would reveal who has an account. Replaced by link-on-accept.
- **"Difficulty"** — rounds adapt; replaced by candidate stage.
- **"Activated → Active"** — renamed Joined → Active, with Active derived (14-day activity).
- **Readiness bands shown to management** (module 6) — scores from one short round are
  noisy; a band must require the existing evidence threshold, or a student gets labelled
  "Needs structured prep" on 20 minutes of audio.

### Delivery risks

- **Every module 1–4 PR touches permissions**, so per CLAUDE.md each goes as a **PR for
  owner review**, not a direct merge to `develop` — even with green CI.
- **Size.** Modules 1+2 alone will exceed ~800 changed lines; split into (a) migration +
  backend + isolation suite, (b) web portal.
- **Migrations must be applied at merge** (`npm run db:push`), or `develop` breaks — CI
  never runs them against the hosted DB.
- **Invite email volume.** A 600-student batch is 600 SES sends at once. SES is already in
  use (no new service), but the account's sending quota and sandbox status must be checked;
  the job sends in rate-limited batches.
- **CSV parsing** is written by hand (RFC 4180 quoting, BOM, Excel's `;` locale variant) —
  no new dependency. Tested on a fixture exported from Excel and Google Sheets.
- **Not verifiable by code alone:** whether TPOs find the portal usable, invite
  deliverability to college mail servers, and whether `CampusRounds` content suits a
  college-assigned round (live AI check — needs the owner's go-ahead).

### Suggested sequence

| Step | Content | Merge route |
|---|---|---|
| 1+2 | Migration A, `campus` package (`CampusAccess`, `OrgScope`, permissions, audit), platform-admin + org/department/batch/member endpoints, isolation suite, `/admin/campus` | PR |
| 3 | Migration B, CSV import, invites + send job, join + consent, `/campus/students*`, `/campus/join` | PR |
| 4 | Migration C, assignments, admission funding `ORG` + caps, `/me/assignments`, dashboard "Assigned to you", `/campus/assignments*` | PR |
| 4b | Server-held MCQ bank + MCQ assignment kind (if wanted in v1) | PR |
