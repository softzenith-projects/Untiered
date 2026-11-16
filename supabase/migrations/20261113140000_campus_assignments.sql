-- Untiered Campus: assignments, who they are for, and the attempts made at them (campus spec §4,
-- plan Migration C, docs/campus-api-contract.md "Module 4").
--
-- Recipients are derived from targets at read time (a batch, or named students), so a student
-- who joins a targeted batch later sees its open assignments, and nothing has to be kept in
-- step. Completion is derived too: from the attempts' sessions for an interview, and from the
-- server-graded user_step_answers for an Arena scenario set. Nothing is stored as "completed".
--
-- A college-assigned interview is paid for by the college, from organisations.
-- interview_allowance (Migration A, 20261113120000_campus_organisations.sql, already created
-- it). It never spends a student's free rounds or credits. Usage is the count of org-funded
-- attempts not handed back after a failure on our side — a ledger derived from rows, never a
-- counter, as with interview_credits. Admission counts it under a row lock on the
-- organisation, so two students racing for the last interview cannot both get it.
--
-- Same conventions as Migration A: every row carries org_id, children reference parents
-- through (org_id, id) composite keys so a row of one college can never point at another's,
-- and RLS is on with no policy for the API roles (the API connects as the owner; PostgREST
-- reads nothing here).
--
-- Additive only.

create table public.assignments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by_member_id uuid,
  kind text not null check (kind in ('interview', 'arena_scenarios')),
  title text not null check (length(btrim(title)) between 1 and 140),
  instructions text check (length(instructions) <= 2000),
  -- interview: the round configuration admission takes instead of the client's.
  -- round_type holds RoundType.dbValue, limited to the round types a college may assign.
  round_type text check (round_type in (
    'technical_fundamentals', 'project_deep_dive', 'coding_practical', 'aptitude',
    'hr_fit_closing', 'behavioural_competency', 'custom_topic')),
  duration_minutes smallint check (duration_minutes in (30, 45, 60)),
  company_name text check (length(company_name) <= 120),
  role_title text check (length(role_title) <= 120),
  candidate_stage text check (candidate_stage in ('student', 'recent_graduate')),
  language text not null default 'english' check (language in ('english', 'hindi_english')),
  focus_topic text check (length(btrim(focus_topic)) between 1 and 120),
  -- arena_scenarios: arena_scenarios.id values, checked live by the API when written.
  scenario_ids text[],
  opens_at timestamptz not null default now(),
  due_at timestamptz not null,
  allow_late boolean not null default false,
  attempt_limit smallint not null default 1 check (attempt_limit between 1 and 10),
  -- Most org-funded interviews one student may use on this assignment; null = attempt_limit.
  interview_cap smallint check (interview_cap between 1 and 10),
  -- Which readiness score (module 6) this feeds, chosen by staff and defaulted from the round
  -- type; never inferred from what the AI wrote. topic is the skill-gap heatmap label (module 7).
  readiness_component text not null check (readiness_component in (
    'coding', 'core_cs', 'technical_interview', 'communication', 'aptitude')),
  topic text check (topic in ('dsa', 'dbms', 'os', 'oops', 'cn', 'system_design', 'communication', 'aptitude')),
  status text not null default 'draft' check (status in ('draft', 'published', 'archived')),
  published_at timestamptz,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  -- The creator's membership; kept as null when that membership row is deleted with its account.
  foreign key (org_id, created_by_member_id)
    references public.org_members (org_id, id) on delete set null (created_by_member_id),
  constraint assignments_interview_fields check (
    kind <> 'interview'
    or (round_type is not null and duration_minutes is not null and candidate_stage is not null
        and scenario_ids is null)),
  constraint assignments_scenario_fields check (
    kind <> 'arena_scenarios'
    or (scenario_ids is not null and cardinality(scenario_ids) between 1 and 20
        and round_type is null and duration_minutes is null and focus_topic is null)),
  -- A topic round is 30 minutes and names its topic (RoundLength); no other round has one.
  constraint assignments_custom_topic check (
    round_type is distinct from 'custom_topic' or (duration_minutes = 30 and focus_topic is not null)),
  constraint assignments_focus_topic_only_custom check (focus_topic is null or round_type = 'custom_topic'),
  constraint assignments_due_after_open check (due_at > opens_at),
  constraint assignments_cap_within_attempts check (interview_cap is null or interview_cap <= attempt_limit),
  constraint assignments_published_at check (status <> 'published' or published_at is not null),
  constraint assignments_archived_at check ((status = 'archived') = (archived_at is not null))
);

create index assignments_org_status_idx on public.assignments (org_id, status, due_at);

create trigger assignments_set_updated_at
before update on public.assignments
for each row execute function public.set_updated_at();

-- Who an assignment is for: a batch (every joined student in it, now or later), or one student.
create table public.assignment_targets (
  org_id uuid not null,
  assignment_id uuid not null,
  batch_id uuid,
  member_id uuid,
  created_at timestamptz not null default now(),
  constraint assignment_targets_one check (num_nonnulls(batch_id, member_id) = 1),
  foreign key (org_id, assignment_id) references public.assignments (org_id, id) on delete cascade,
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade,
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete cascade
);

create unique index assignment_targets_unique
  on public.assignment_targets (assignment_id, coalesce(batch_id, member_id));
create index assignment_targets_batch_idx on public.assignment_targets (org_id, batch_id) where batch_id is not null;
create index assignment_targets_member_idx on public.assignment_targets (org_id, member_id) where member_id is not null;

-- One row per interview started from an assignment: the record of what happened, and what the
-- caps and the college's allowance count.
--
-- status mirrors the session's end: a session that ends 'failed' (our fault) marks its attempt
-- 'failed', which hands the allowance back; 'abandoned' still counts. The transition is made
-- in the same statement that ends the session (SessionRepository).
--
-- member_id is set null, not cascaded, when the membership row goes with a deleted account:
-- the row then holds nothing personal, and an interview the college paid for stays spent, just
-- as a deleted round still counts against credits. session_id is set null when the round is
-- deleted, for the same reason.
create table public.assignment_attempts (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null,
  assignment_id uuid not null,
  member_id uuid,
  session_id uuid references public.sessions (id) on delete set null,
  org_funded boolean not null default false,
  status text not null default 'in_progress'
    check (status in ('in_progress', 'completed', 'abandoned', 'failed')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, assignment_id) references public.assignments (org_id, id) on delete cascade,
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete set null (member_id),
  constraint assignment_attempts_ended check ((status = 'in_progress') = (ended_at is null))
);

create unique index assignment_attempts_session
  on public.assignment_attempts (session_id) where session_id is not null;
create index assignment_attempts_member_idx
  on public.assignment_attempts (org_id, assignment_id, member_id);
-- Allowance usage, counted under the organisation row lock at admission.
create index assignment_attempts_org_funded_idx
  on public.assignment_attempts (org_id) where org_funded and status <> 'failed';

alter table public.assignments enable row level security;
alter table public.assignment_targets enable row level security;
alter table public.assignment_attempts enable row level security;

comment on table public.assignments is
  'Work a college sets its students (campus spec §4): an AI interview round or a set of Arena scenarios.';
comment on table public.assignment_targets is
  'Who an assignment is for: a batch or one student. Recipients are derived from these at read time.';
comment on table public.assignment_attempts is
  'Interviews started from an assignment. Org-funded attempts not failed are the college''s allowance usage.';
comment on column public.assignment_attempts.member_id is
  'Null once the student''s account is deleted; the attempt keeps counting against the college''s allowance.';
