-- PRD §05, §15: bounded, observable retries for SES delivery attempts.
alter table public.email_deliveries
  add column claimed_at timestamptz,
  add column attempt_count smallint not null default 0 check (attempt_count between 0 and 3),
  add column next_attempt_at timestamptz not null default now();

drop index public.email_deliveries_pending_idx;
create index email_deliveries_pending_idx
  on public.email_deliveries (next_attempt_at, id) where status = 'pending';
create index email_deliveries_sending_idx
  on public.email_deliveries (claimed_at) where status = 'sending';
