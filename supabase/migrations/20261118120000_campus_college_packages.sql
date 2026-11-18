-- Untiered Campus: college packages and payments (campus API contract, Module 14).
--
-- A college buys a package: a pool of N interviews for a term (starts_on to ends_on), with
-- an optional per-student limit, paid by invoice (bank transfer or cheque). A platform admin
-- records the package, marks it invoiced, and later paid. No payment gateway is involved.
--
-- Once a college has at least one package that is invoiced or paid, a college-assigned
-- interview is funded by a usable package instead of organisations.interview_allowance, and
-- the attempt records which package paid for it (assignment_attempts.package_id). A college
-- with no such package keeps the allowance exactly as before.
--
-- A package's interviews can be started from starts_on through ends_on + grace_days (India
-- dates); unused interviews then lapse. A failed attempt hands its interview back, as it
-- already does for the allowance.
--
-- The owner of these rows is the platform operator, not a user: RLS is on with no policies,
-- so PostgREST (the browser's direct path) reads nothing. The API connects as the owner.
-- Payment rows survive the deletion of whoever recorded them (created_by on delete set null).
--
-- Additive only.

create table public.college_packages (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  interviews integer not null check (interviews between 1 and 1000000),
  -- Interviews one student may start from this package; null means no per-student limit.
  per_student_limit integer check (per_student_limit between 1 and 1000),
  starts_on date not null,
  ends_on date not null,
  grace_days integer not null default 14 check (grace_days between 0 and 90),
  -- Tax-inclusive price in paise, as invoiced.
  amount_paise bigint not null check (amount_paise between 0 and 100000000000),
  invoice_number text check (length(btrim(invoice_number)) between 1 and 60),
  status text not null default 'draft' check (status in ('draft', 'invoiced', 'paid', 'void')),
  invoiced_on date,
  paid_on date,
  payment_reference text check (length(payment_reference) <= 120),
  -- Private to platform admins.
  notes text check (length(notes) <= 2000),
  created_by uuid references public.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  constraint college_packages_term check (ends_on >= starts_on),
  constraint college_packages_invoiced check (status not in ('invoiced', 'paid') or invoice_number is not null),
  constraint college_packages_paid check (status <> 'paid' or paid_on is not null)
);
create index college_packages_org_idx on public.college_packages (org_id, ends_on);

create trigger college_packages_set_updated_at
before update on public.college_packages
for each row execute function public.set_updated_at();

-- Which package funded an org-funded attempt. Null for attempts funded by the allowance (and
-- for every attempt made before this migration). The composite key means an attempt can only
-- ever point at its own college's package. No action, not restrict: deleting the whole
-- organisation cascades to both in one statement; a package that funded an attempt cannot be
-- deleted on its own.
alter table public.assignment_attempts add column package_id uuid;
alter table public.assignment_attempts
  add constraint assignment_attempts_package_fk
  foreign key (org_id, package_id) references public.college_packages (org_id, id) on delete no action;
-- A package's usage, counted under the organisation row lock at admission.
create index assignment_attempts_package_idx
  on public.assignment_attempts (org_id, package_id, member_id) where package_id is not null and status <> 'failed';

-- The renewal reminders that went out: one per package per kind, never a second.
create table public.college_package_reminders (
  org_id uuid not null,
  package_id uuid not null,
  kind text not null check (kind in ('ends_in_30', 'ends_in_7')),
  sent_on date not null,
  recipients integer not null check (recipients >= 0),
  created_at timestamptz not null default now(),
  primary key (package_id, kind),
  foreign key (org_id, package_id) references public.college_packages (org_id, id) on delete cascade
);

-- A billing notice to a college's admins and placement officers. Transactional: the campus
-- reminder preference does not turn it off.
alter table public.email_deliveries drop constraint email_deliveries_category_check;
alter table public.email_deliveries add constraint email_deliveries_category_check check (
  category in (
    'welcome', 'daily_question', 'announcement', 'informative', 'reengagement',
    'campus_assignment', 'campus_reminder', 'campus_report_ready', 'campus_weekly',
    'campus_billing'
  )
);

alter table public.college_packages enable row level security;
alter table public.college_package_reminders enable row level security;

comment on table public.college_packages is
  'What a college bought: N interviews for a term, paid by invoice. Recorded by a platform admin.';
comment on column public.assignment_attempts.package_id is
  'The package that funded this attempt; null when the college allowance funded it.';
comment on table public.college_package_reminders is
  'Renewal reminders sent to a college''s admins and placement officers, one per package per kind.';
