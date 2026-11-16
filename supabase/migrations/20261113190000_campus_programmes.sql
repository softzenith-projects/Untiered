-- Untiered Campus: programmes (campus spec §10, docs/campus-api-contract.md "Module 10").
--
-- A programme template is a reusable bundle of weekly modules, defined once by the platform
-- (the Untiered team) and shared by every college. A college clones a template into a
-- programme: one published assignment per module, dated week by week from the programme's
-- start date, targeting the batches the college chose. The assignments are ordinary module 4
-- assignments — admission, completion, readiness and notifications treat them as any other —
-- that carry the programme and week they came from.
--
-- Completion and the certificate are derived on read from the assignments, as module 4's
-- completion is; nothing here stores "completed" or "certificate issued".
--
-- programme_templates is global (no org_id): platform-admin owned, and modules is validated by
-- the API through the same assignment validation a college's own assignment goes through.
-- programmes and programme_targets follow the campus conventions: org_id on every row,
-- (org_id, id) composite keys so a programme of one college can never point at another's
-- batches, and RLS on with no policy for the API roles.
--
-- Additive only.

create table public.programme_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(btrim(title)) between 1 and 140),
  description text not null default '' check (length(description) <= 2000),
  weeks smallint not null check (weeks between 1 and 12),
  -- [{ "week": 1..weeks, "assignment": AssignmentInput without dates and targets }], checked by the API.
  modules jsonb not null default '[]'::jsonb check (jsonb_typeof(modules) = 'array'),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger programme_templates_set_updated_at
before update on public.programme_templates
for each row execute function public.set_updated_at();

create table public.programmes (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  -- Kept as null when the template is deleted: the college's programme stands on its own.
  template_id uuid references public.programme_templates (id) on delete set null,
  title text not null check (length(btrim(title)) between 1 and 140),
  starts_on date not null,
  weeks smallint not null check (weeks between 1 and 12),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_by_member_id uuid,
  created_at timestamptz not null default now(),
  archived_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, created_by_member_id)
    references public.org_members (org_id, id) on delete set null (created_by_member_id),
  constraint programmes_archived_at check ((status = 'archived') = (archived_at is not null))
);

create index programmes_org_idx on public.programmes (org_id, starts_on desc);

create table public.programme_targets (
  org_id uuid not null,
  programme_id uuid not null,
  batch_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (programme_id, batch_id),
  foreign key (org_id, programme_id) references public.programmes (org_id, id) on delete cascade,
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade
);

create index programme_targets_batch_idx on public.programme_targets (org_id, batch_id);

-- The programme and week an assignment was cloned for; null for an assignment staff set by hand.
alter table public.assignments
  add column programme_id uuid,
  add column programme_week smallint check (programme_week between 1 and 12),
  add constraint assignments_programme_fk foreign key (org_id, programme_id)
    references public.programmes (org_id, id) on delete set null (programme_id),
  add constraint assignments_programme_week check (programme_id is null or programme_week is not null);

create index assignments_programme_idx on public.assignments (org_id, programme_id) where programme_id is not null;

alter table public.programme_templates enable row level security;
alter table public.programmes enable row level security;
alter table public.programme_targets enable row level security;

comment on table public.programme_templates is
  'Reusable programme templates of weekly modules (campus spec §10), owned by the platform.';
comment on table public.programmes is
  'A college''s run of a programme template: one published assignment per module, dated weekly.';
comment on table public.programme_targets is
  'The batches a programme was started for. Each of its assignments targets the same batches.';
comment on column public.assignments.programme_id is
  'The programme this assignment was cloned for (module 10); null for a hand-set assignment.';
