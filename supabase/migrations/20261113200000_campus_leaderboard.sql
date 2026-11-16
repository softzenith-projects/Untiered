-- Campus module 12: the opt-in leaderboard (campus spec §12).
--
-- Additive only. A student appears on their college's leaderboard by name only after turning
-- this on; the default is false, so every existing student stays anonymous. It lives on the
-- membership row, so it goes with the membership when the student leaves or deletes the account.
alter table public.org_members
  add column leaderboard_opt_in boolean not null default false;

comment on column public.org_members.leaderboard_opt_in is
  'True when the student chose to show their name on the campus leaderboard. Anonymous otherwise.';
