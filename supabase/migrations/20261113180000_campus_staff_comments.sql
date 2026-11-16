-- Untiered Campus: private staff notes on a student (campus spec §8, docs/campus-api-contract.md
-- "Module 8").
--
-- Staff at a college may keep notes about a student's progress, optionally on one of the
-- student's assigned rounds. The notes are private to the college's staff: no student route
-- reads this table, and the join consent copy (CampusJoinService.SHARED, version
-- campus-2026-11-14) tells the student such notes exist.
--
-- Same conventions as the other campus migrations: every row carries org_id, references go
-- through (org_id, id) composite keys so a note of one college can never point at another's
-- student, and RLS is on with no policy for the API roles (the API connects as the owner;
-- PostgREST reads nothing here).
--
-- A note goes with the student's membership row (which goes with their account). The author's
-- membership is set null, not cascaded, when the author's account is deleted: the note stays
-- with the student it is about, shown without an author's name.
--
-- Additive only.

create table public.campus_staff_comments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organisations (id) on delete cascade,
  member_id uuid not null,
  -- One of the student's assigned rounds (an assignment_attempts session), checked by the API.
  session_id uuid references public.sessions (id) on delete set null,
  author_member_id uuid,
  body text not null check (length(btrim(body)) between 1 and 2000),
  created_at timestamptz not null default now(),
  edited_at timestamptz,
  unique (org_id, id),
  foreign key (org_id, member_id) references public.org_members (org_id, id) on delete cascade,
  foreign key (org_id, author_member_id)
    references public.org_members (org_id, id) on delete set null (author_member_id)
);

create index campus_staff_comments_member_idx
  on public.campus_staff_comments (org_id, member_id, created_at desc);

alter table public.campus_staff_comments enable row level security;

comment on table public.campus_staff_comments is
  'Private staff notes about a student (campus spec §8). Never returned on a student route.';
comment on column public.campus_staff_comments.author_member_id is
  'The staff membership that wrote the note; null once that account is deleted.';
