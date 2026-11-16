-- Untiered Campus: interview integrity signals (campus spec §5, docs/campus-api-contract.md
-- "Module 5").
--
-- One row of counters per assigned round: how many times the interview tab was hidden, the
-- window lost focus, and text was pasted (with how many characters). Nothing else about the
-- screen is kept — no timestamps per event, no clipboard contents, no URLs — because a count
-- is all the college is shown and all the student is told about before consent.
--
-- Rows are written only for rounds started from an assignment. The API checks that before it
-- writes (a personal round's events are dropped and still answered 204), so a student's own
-- practice never has a row here at all.
--
-- The timing signals (fast answers, long pauses) are not stored: they are derived on read
-- from `session_turns.answer_timing`, which already exists.
--
-- The caps mirror the API's (`IntegrityCounters`): each counter at most 10,000 and the
-- pasted characters at most 100,000 per session, so a misbehaving client cannot grow a
-- number past what a real round could produce.
--
-- A row goes with its round: deleting the session (or the account, which deletes the
-- sessions) deletes it.
--
-- Additive only.

create table public.session_integrity (
  session_id uuid primary key references public.sessions (id) on delete cascade,
  user_id uuid not null references public.users (id) on delete cascade,
  tab_hidden integer not null default 0 check (tab_hidden between 0 and 10000),
  window_blur integer not null default 0 check (window_blur between 0 and 10000),
  pastes integer not null default 0 check (pastes between 0 and 10000),
  pasted_chars integer not null default 0 check (pasted_chars between 0 and 100000),
  updated_at timestamptz not null default now()
);

create index session_integrity_user_idx on public.session_integrity (user_id);

alter table public.session_integrity enable row level security;

create policy session_integrity_select_own on public.session_integrity
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.session_integrity is
  'Integrity counters for a college-assigned round (campus spec §5). Counts only, never a verdict; never feeds readiness.';
comment on column public.session_integrity.pasted_chars is
  'Total characters pasted into the code editor or a text answer field, capped at 100,000.';
