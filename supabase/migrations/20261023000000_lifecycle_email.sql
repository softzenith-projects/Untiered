-- PRD §05, §15: account email preferences and durable, account-owned delivery history.
alter table public.users add column last_seen_at timestamptz not null default now();

create table public.email_preferences (
  user_id uuid primary key references public.users (id) on delete cascade,
  daily_question boolean not null default false,
  announcements boolean not null default false,
  reengagement boolean not null default false,
  consented_at timestamptz,
  updated_at timestamptz not null default now(),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  constraint email_preferences_consent check (
    consented_at is not null or not (daily_question or announcements or reengagement)
  )
);

create table public.email_deliveries (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.users (id) on delete cascade,
  dedupe_key text not null check (length(dedupe_key) between 1 and 160),
  category text not null check (category in ('welcome', 'daily_question', 'announcement', 'informative', 'reengagement')),
  subject text not null,
  body text not null,
  status text not null default 'pending' check (status in ('pending', 'sending', 'sent', 'failed', 'cancelled')),
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  error_code text,
  unique (user_id, dedupe_key)
);

create index email_deliveries_pending_idx on public.email_deliveries (id) where status = 'pending';

create table public.email_campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users (id) on delete cascade,
  category text not null check (category in ('announcement', 'informative')),
  subject text not null check (length(subject) between 1 and 140),
  body text not null check (length(body) between 1 and 10000),
  scheduled_at timestamptz not null,
  created_at timestamptz not null default now(),
  queued_at timestamptz
);

alter table public.email_preferences enable row level security;
alter table public.email_deliveries enable row level security;
alter table public.email_campaigns enable row level security;

-- Preferences and history can be inspected by their owner. Writes go through the API,
-- where consent timestamps and the unsubscribe token cannot be forged by the browser.
create policy email_preferences_select_own on public.email_preferences
  for select to authenticated using ((select auth.uid()) = user_id);
create policy email_deliveries_select_own on public.email_deliveries
  for select to authenticated using ((select auth.uid()) = user_id);
-- Campaigns are admin-only through the API; direct client access has no policy.

-- A candidate who confirms sign-up but never opens the app must still receive the
-- welcome and, only if they opted in, the inactivity sequence. The API's first-use
-- provisioning remains an idempotent fallback for existing accounts.
create function public.queue_confirmed_signup_email()
returns trigger
language plpgsql
security definer set search_path = ''
as $$
declare
  opted_in boolean;
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  opted_in := coalesce(new.raw_user_meta_data ->> 'email_marketing_opt_in', 'false') = 'true';

  insert into public.users (id, email, display_name)
  values (new.id, new.email, nullif(trim(coalesce(new.raw_user_meta_data ->> 'full_name', '')), ''))
  on conflict (id) do nothing;

  update public.users set email = new.email
   where id = new.id and email is distinct from new.email;

  insert into public.email_preferences
    (user_id, daily_question, announcements, reengagement, consented_at)
  values
    (new.id, opted_in, opted_in, opted_in, case when opted_in then now() else null end)
  on conflict (user_id) do nothing;

  insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
  values
    (new.id, 'welcome', 'welcome', 'Welcome to Untiered',
     'Your account is ready. Choose a company and role, then practise a spoken interview or explore the courses and Arena. Visit your account to get started.')
  on conflict (user_id, dedupe_key) do nothing;

  return new;
end;
$$;

revoke all on function public.queue_confirmed_signup_email() from public, anon, authenticated;

create trigger queue_confirmed_signup_email
after insert or update of email_confirmed_at on auth.users
for each row
when (new.email_confirmed_at is not null)
execute function public.queue_confirmed_signup_email();
