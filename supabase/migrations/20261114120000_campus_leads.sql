-- Untiered Campus: college self-registration, "leads" (campus API contract, Module 13).
--
-- A college registers interest on the public /colleges page. That creates a lead here and
-- nothing else: never an organisation, never any access. A platform admin reviews it and
-- converts it into a college by hand. The POST that writes these rows is the API's only
-- unauthenticated campus route, so the tables are shaped for it:
--
-- - campus_leads holds what the form asked for and no more. Its owner is the platform
--   operator, not a user, so there is no user column to own it; RLS is on with no policies,
--   and PostgREST (the browser's direct path) reads nothing. The API connects as the owner.
-- - campus_lead_rate_limits counts submissions per hashed IP per hour and per hashed email
--   per day. The hash is SHA-256 over a server-side salt, so neither a raw IP address nor an
--   email address is ever stored in it, and a leaked table cannot be reversed by hashing the
--   IPv4 space.
--
-- A lead in not_a_fit is deleted 180 days after it was marked so, and rate-limit rows after
-- two days, by the API's scheduled job.
--
-- Additive only.

create table public.campus_leads (
  id uuid primary key default gen_random_uuid(),
  status text not null default 'new' check (status in ('new', 'contacted', 'converted', 'not_a_fit')),
  college_name text not null check (length(btrim(college_name)) between 2 and 200),
  city text not null check (length(btrim(city)) between 1 and 120),
  state text not null check (length(btrim(state)) between 1 and 120),
  contact_name text not null check (length(btrim(contact_name)) between 1 and 200),
  contact_role text not null check (contact_role in ('tpo', 'faculty', 'college_admin', 'other')),
  email text not null check (email = lower(btrim(email)) and length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (length(phone) <= 20 and phone ~ '^[0-9 +()-]+$'),
  approx_students integer check (approx_students between 1 and 100000),
  message text check (length(message) <= 2000),
  -- Private to platform admins.
  notes text check (length(notes) <= 5000),
  -- When the person ticked "You may contact me about Untiered Campus" (most recent submission).
  consented_at timestamptz not null,
  -- How many times the same email registered the same college while this lead was open.
  submission_count integer not null default 1 check (submission_count >= 1),
  -- The college this lead became. Kept as history if the college is later deleted.
  org_id uuid references public.organisations (id) on delete set null,
  status_changed_by uuid references public.users (id) on delete set null,
  status_changed_at timestamptz,
  -- The one notification email to the operator. 'skipped' when no notify address or SES was
  -- configured at the time, so switching them on later does not mail out a backlog.
  notify_status text not null default 'skipped' check (notify_status in ('pending', 'sent', 'failed', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint campus_leads_converted_once check (status <> 'converted' or status_changed_at is not null)
);
create index campus_leads_status_idx on public.campus_leads (status, created_at desc);
create index campus_leads_listing_idx on public.campus_leads (created_at desc, id desc);
create index campus_leads_email_idx on public.campus_leads (lower(email));
create index campus_leads_notify_idx on public.campus_leads (created_at) where notify_status = 'pending';
create index campus_leads_purge_idx on public.campus_leads (status_changed_at) where status = 'not_a_fit';

create trigger campus_leads_set_updated_at
before update on public.campus_leads
for each row execute function public.set_updated_at();

create table public.campus_lead_rate_limits (
  kind text not null check (kind in ('ip', 'email')),
  -- SHA-256 of salt, kind and value. Never the raw IP address or email.
  key_hash bytea not null check (length(key_hash) = 32),
  -- The start of the hour (ip) or the UTC day (email) this count belongs to.
  window_start timestamptz not null,
  hits integer not null default 1 check (hits >= 1),
  primary key (kind, key_hash, window_start)
);
create index campus_lead_rate_limits_window_idx on public.campus_lead_rate_limits (window_start);

alter table public.campus_leads enable row level security;
alter table public.campus_lead_rate_limits enable row level security;

comment on table public.campus_leads is
  'A college that registered interest on /colleges. Never an organisation or any access until a platform admin converts it.';
comment on table public.campus_lead_rate_limits is
  'Submission counts for the public lead form, keyed by a salted SHA-256 of the IP or email. Deleted after two days.';
