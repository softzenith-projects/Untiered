-- PRD §10: what candidates want from Pro, asked before the paid plan is designed.
create table public.pro_feature_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  features text[] not null default '{}' check (cardinality(features) <= 8),
  note text check (note is null or length(note) between 1 and 1000),
  created_at timestamptz not null default now(),
  constraint pro_feature_requests_not_empty check (cardinality(features) > 0 or note is not null)
);

create index pro_feature_requests_user_created_idx on public.pro_feature_requests (user_id, created_at);

alter table public.pro_feature_requests enable row level security;

-- Owners may read their own requests; writes go through the API, which validates the
-- feature keys and caps how many one account can send in a day.
create policy pro_feature_requests_select_own on public.pro_feature_requests
  for select to authenticated using ((select auth.uid()) = user_id);
