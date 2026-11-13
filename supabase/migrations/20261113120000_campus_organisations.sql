-- Untiered Campus: organisations, their structure, and who belongs to them (campus spec §1–2,
-- plan Migration A).
--
-- Every college-scoped row carries org_id, and children reference parents through
-- (org_id, id) composite keys, so a row of one college can never point at a row of
-- another — the database refuses it whatever the service layer does. The API still filters
-- every query by org_id (CampusAccess / OrgScope); the keys are the safety net, not the gate.
--
-- PLATFORM_ADMIN is deliberately not here: it stays the interviewos.admin allow-list, which
-- an account cannot grant itself through a bug in an endpoint.
--
-- RLS is on for every table, with no policy for the API roles except a student reading
-- their own membership. The API connects as the owner and is unaffected; PostgREST (the
-- browser's direct path) reads nothing a college holds.
--
-- interview_allowance is created here rather than in the assignments migration (plan
-- Migration C) because the module 1–2 contract already shows and edits it.

create table public.organisations (
  id uuid primary key default gen_random_uuid(),
  kind text not null default 'college' check (kind in ('college')),  -- 'employer' later
  name text not null check (length(btrim(name)) between 2 and 200),
  slug text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{1,58}[a-z0-9]$'),
  city text check (length(city) <= 120),
  state text check (length(state) <= 120),
  logo_path text check (length(logo_path) <= 200),  -- object key in the org-logos bucket
  contact_name text check (length(contact_name) <= 200),
  contact_email text check (length(contact_email) <= 320),
  contact_phone text check (length(contact_phone) <= 40),
  status text not null default 'active' check (status in ('active', 'suspended')),
  -- Org-funded interviews contracted, set by hand by a platform admin. Spent by module 4.
  interview_allowance integer not null default 0 check (interview_allowance between 0 and 1000000),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organisations_set_updated_at
before update on public.organisations
for each row execute function public.set_updated_at();

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
  -- no action, not restrict: a department with batches cannot be deleted on its own, but
  -- deleting the whole organisation cascades to both in one statement, and a restrict check
  -- would fire before the cascade had reached the batches.
  foreign key (org_id, department_id) references public.org_departments (org_id, id) on delete no action
);
create index org_batches_department_idx on public.org_batches (org_id, department_id);

-- One row per person per college membership. A person holds one role in a college at a
-- time; a student is in at most one college at a time (partial unique indexes below). A
-- membership that ends is kept as 'left' or 'removed' with ended_at, never reused: a
-- person who comes back gets a new row.
create table public.org_members (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  role text not null check (role in ('college_admin', 'tpo', 'faculty', 'student')),
  batch_id uuid,
  roll_number text check (length(roll_number) between 1 and 40),
  status text not null default 'joined' check (status in ('joined', 'left', 'removed')),
  -- What the student agreed to share, and when (campus spec §3). Staff do not consent here.
  consent_version text check (length(consent_version) <= 40),
  consented_at timestamptz,
  joined_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete no action,  -- as above
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
create index org_members_batch_idx on public.org_members (org_id, batch_id);
create index org_members_user_idx on public.org_members (user_id) where status = 'joined';
create index org_members_listing_idx on public.org_members (org_id, joined_at desc, id desc) where status = 'joined';

-- A faculty member sees nothing until scoped: deny by default (campus spec §2). Each row
-- grants one department (and so all its batches) or one batch.
create table public.org_faculty_scopes (
  org_id uuid not null,
  member_id uuid not null,
  department_id uuid,
  batch_id uuid,
  created_at timestamptz not null default now(),
  constraint org_faculty_scopes_one_target check (num_nonnulls(department_id, batch_id) = 1),
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete cascade,
  foreign key (org_id, department_id) references public.org_departments (org_id, id) on delete cascade,
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade
);
create unique index org_faculty_scopes_unique
  on public.org_faculty_scopes (member_id, coalesce(department_id, batch_id));
create index org_faculty_scopes_member_idx on public.org_faculty_scopes (org_id, member_id);

-- Who viewed, exported or changed what. Ids only; never a student's answers, name or email.
create table public.org_audit_log (
  id bigint generated always as identity primary key,
  org_id uuid not null references public.organisations (id) on delete cascade,
  actor_user_id uuid references public.users (id) on delete set null,
  actor_kind text not null check (actor_kind in ('member', 'platform_admin', 'system')),
  action text not null check (action ~ '^[a-z_]+\.[a-z_]+$'),  -- 'report.viewed', 'member.removed'
  target_type text check (length(target_type) <= 40),
  target_id uuid,
  detail jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now()
);
create index org_audit_log_org_idx on public.org_audit_log (org_id, id desc);
create index org_audit_log_actor_idx on public.org_audit_log (actor_user_id) where actor_user_id is not null;

-- Append-only, even for the owner role the API connects as. Two changes are let through,
-- and only when a foreign-key action makes them (pg_trigger_depth() > 1 means this row
-- trigger was fired by a statement another trigger ran — here, Postgres' referential
-- actions):
--   * the cascade delete when the organisation itself is deleted, and
--   * the actor's id set to null when the actor's account is deleted (on delete set null),
--     which is account deletion actually deleting, and must not be blocked by the log.
-- Any other update, delete or truncate raises.
create function public.org_audit_log_append_only() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' and pg_catalog.pg_trigger_depth() > 1 then
    return old;
  end if;
  if tg_op = 'UPDATE'
     and pg_catalog.pg_trigger_depth() > 1
     and old.actor_user_id is not null
     and new.actor_user_id is null
     and (new.id, new.org_id, new.actor_kind, new.action, new.target_type, new.target_id, new.detail, new.occurred_at)
         is not distinct from
         (old.id, old.org_id, old.actor_kind, old.action, old.target_type, old.target_id, old.detail, old.occurred_at) then
    return new;
  end if;
  raise exception 'org_audit_log is append-only';
end;
$$;

create trigger org_audit_log_no_update before update on public.org_audit_log
  for each row execute function public.org_audit_log_append_only();
create trigger org_audit_log_no_delete before delete on public.org_audit_log
  for each row execute function public.org_audit_log_append_only();
create trigger org_audit_log_no_truncate before truncate on public.org_audit_log
  for each statement execute function public.org_audit_log_append_only();

alter table public.organisations enable row level security;
alter table public.org_departments enable row level security;
alter table public.org_batches enable row level security;
alter table public.org_members enable row level security;
alter table public.org_faculty_scopes enable row level security;
alter table public.org_audit_log enable row level security;

create policy org_members_select_own on public.org_members
  for select to authenticated using ((select auth.uid()) = user_id);

-- College logos: public, because a logo is not personal data and is shown on pages a
-- student opens. Uploaded only by a platform admin through the API (service role); there
-- is no insert policy for the API roles. Our own bucket rather than a hotlink to the
-- college's site, which would leak each student's visit to a third party (campus spec §1).
insert into storage.buckets (id, name, public)
values ('org-logos', 'org-logos', true)
on conflict (id) do nothing;

comment on table public.organisations is
  'A college (later: employer) on Untiered Campus. Created by a platform admin; onboarding is manual in v1.';
comment on table public.org_members is
  'A person''s membership of one organisation, with one role. Ended memberships are kept as left/removed.';
comment on table public.org_faculty_scopes is
  'Departments or batches a faculty member may see. None means the faculty member sees no students.';
comment on table public.org_audit_log is
  'Append-only record of who viewed, exported or changed what in an organisation. Ids only, never personal details.';
comment on column public.org_audit_log.actor_kind is
  'member: a college member; platform_admin: an Untiered operator on the interviewos.admin allow-list; system: a job.';
