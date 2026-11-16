-- Untiered Campus: student and staff onboarding (campus spec §3, plan Migration B).
--
-- No account is created at import. An invite is an email address plus a single-use token;
-- the person signs in however they like, and accepting the invite links that account. The
-- token is stored only as a SHA-256 hash, so a database read cannot be replayed as a link.
-- The raw token exists only in the memory of the job that emails it: the job draws a fresh
-- token, stores its hash and sends it, so every email carries a new link and the previous
-- one stops working. Until the first email goes, token_hash holds the hash of a random value
-- nobody ever sees (the column default), so a fresh invite cannot be accepted by anyone.
--
-- Import previews are kept server-side so that "commit" acts on what was validated, not on
-- what a browser re-sends, and are deleted a day later by a job: they are names and emails.
--
-- Additive only. Foreign-key actions follow Migration A (20261113120000): every child carries
-- org_id and references its parent through (org_id, id), so a row of one college can never
-- point at a row of another.

create table public.campus_imports (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  created_by uuid references public.users (id) on delete set null,
  status text not null default 'previewed' check (status in ('previewed', 'committed', 'discarded')),
  row_count integer not null check (row_count between 0 and 5000),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default now() + interval '1 day',
  committed_at timestamptz,
  unique (org_id, id)
);
create index campus_imports_expiry_idx on public.campus_imports (expires_at);

create table public.campus_import_rows (
  org_id uuid not null,
  import_id uuid not null,
  row_number integer not null check (row_number >= 1),
  full_name text check (length(full_name) <= 200),
  email text check (length(email) <= 320),
  roll_number text check (length(roll_number) <= 40),
  department_code text,
  batch_name text,
  graduation_year smallint,
  batch_id uuid,                                    -- resolved during validation
  -- Empty means the row will be invited. Never a code that says whether an email has an
  -- Untiered account: that would leak our user list to a college.
  problems text[] not null default '{}' check (problems <@ array[
    'missing_name', 'bad_email', 'duplicate_email_in_file', 'duplicate_roll_in_file',
    'unknown_department', 'unknown_batch', 'batch_department_mismatch', 'graduation_year_mismatch',
    'already_member', 'already_invited', 'roll_number_taken'
  ]::text[]),
  primary key (import_id, row_number),
  foreign key (org_id, import_id) references public.campus_imports (org_id, id) on delete cascade,
  -- Cascade: a preview row whose batch is deleted can no longer be invited anyway.
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade
);

create table public.campus_invites (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  role text not null check (role in ('college_admin', 'tpo', 'faculty', 'student')),
  batch_id uuid,
  email text not null check (email = lower(btrim(email)) and length(email) <= 320 and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  full_name text not null check (length(btrim(full_name)) between 1 and 200),
  roll_number text check (length(roll_number) between 1 and 40),
  token_hash bytea not null unique
    default sha256(convert_to(gen_random_uuid()::text || gen_random_uuid()::text, 'UTF8')),
  -- 'expired' is stored only when a newer invite for the same email replaces a lapsed one;
  -- otherwise an 'invited' row past expires_at is shown as expired without being rewritten.
  status text not null default 'invited' check (status in ('invited', 'joined', 'revoked', 'expired')),
  member_id uuid,
  invited_by uuid references public.users (id) on delete set null,
  invited_by_platform_admin boolean not null default false,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  joined_at timestamptz,
  -- Send state lives here, not in email_deliveries, which is keyed by a user this person may
  -- not have yet. send_count is the emails asked for (the first, plus each resend);
  -- send_attempts is the sender's retries of the current one.
  send_status text not null default 'pending' check (send_status in ('pending', 'sending', 'sent', 'failed')),
  send_count integer not null default 1 check (send_count between 1 and 10),
  send_attempts smallint not null default 0 check (send_attempts between 0 and 10),
  next_send_at timestamptz not null default now(),
  send_claimed_at timestamptz,
  last_sent_at timestamptz,
  send_error text check (length(send_error) <= 40),
  unique (org_id, id),
  -- Cascade, not restrict: deleting a batch is refused by the API while it has open invites
  -- (or has ever had students), so what cascades here is closed invites only. A restrict check
  -- would also fire before an organisation's own cascade had reached its invites.
  foreign key (org_id, batch_id) references public.org_batches (org_id, id) on delete cascade,
  -- Only member_id is cleared when the membership goes; org_id stays.
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete set null (member_id),
  constraint campus_invites_student_has_batch check ((role = 'student') = (batch_id is not null)),
  constraint campus_invites_joined check ((status = 'joined') = (joined_at is not null))
);
-- One open invite per email per college. Joined, revoked and expired invites are history:
-- somebody who left can be invited again.
create unique index campus_invites_open_per_email
  on public.campus_invites (org_id, email) where status = 'invited';
create index campus_invites_pending_send_idx
  on public.campus_invites (next_send_at, id) where send_status = 'pending';
create index campus_invites_sending_idx
  on public.campus_invites (send_claimed_at) where send_status = 'sending';
create index campus_invites_listing_idx on public.campus_invites (org_id, created_at desc, id desc);
create index campus_invites_email_idx on public.campus_invites (email);
create index campus_invites_member_idx on public.campus_invites (org_id, member_id) where member_id is not null;
create index campus_invites_batch_idx on public.campus_invites (org_id, batch_id) where batch_id is not null;

-- RLS on, no policies: PostgREST (the browser's direct path) reads nothing here. The API
-- connects as the owner.
alter table public.campus_imports enable row level security;
alter table public.campus_import_rows enable row level security;
alter table public.campus_invites enable row level security;

comment on table public.campus_imports is
  'A student CSV upload awaiting commit. Deleted a day after upload, with its rows.';
comment on table public.campus_invites is
  'An invitation to join a college: an email plus a single-use token, stored only as its SHA-256.';
comment on column public.campus_invites.token_hash is
  'SHA-256 of the token in the most recent email. The default is the hash of a random value never sent, so an unsent invite cannot be accepted.';
