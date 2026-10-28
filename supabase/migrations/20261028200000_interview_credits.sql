-- Interview credits: paid mock interviews, sold in packs through Razorpay (PRD 10).
--
-- One credit is one interview, with its full report. A credit is spent the moment a round
-- starts — the model is paid for from the first question — and handed back automatically
-- if the round fails on our side (`sessions.status = 'failed'`). Leaving a round is the
-- candidate's choice and does not hand it back.
--
-- The balance is the sum of this ledger, never a stored counter, for the same reason the
-- daily allowance is counted from `practice_usage`: a counter incremented in one place and
-- decremented in another drifts from what actually happened.
--
-- Each row says why it exists, and the partial unique indexes make every way of writing
-- one idempotent: a payment grants once however many times Razorpay's webhook and the
-- browser's callback both report it, and a session is charged and refunded at most once.
--
-- session_id is recorded but deliberately not a foreign key, like `practice_usage`: a
-- candidate may delete a round, and deleting it must neither refund nor lose the charge.

alter table public.payments
  add column credits integer check (credits > 0),
  add column paid_at timestamptz;

comment on column public.payments.plan is 'The credit pack bought (interviewos.billing.packs[].id).';
comment on column public.payments.credits is 'Interview credits the pack grants once the payment is captured.';

create type public.credit_reason as enum ('purchase', 'consume', 'refund', 'grant');

create table public.interview_credits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  delta integer not null check (delta <> 0),
  reason public.credit_reason not null,
  payment_id uuid references public.payments (id) on delete cascade,
  session_id uuid,
  created_at timestamptz not null default now(),
  constraint interview_credits_purchase_has_payment
    check ((reason = 'purchase') = (payment_id is not null)),
  constraint interview_credits_session_rows_have_session
    check (reason not in ('consume', 'refund') or session_id is not null),
  constraint interview_credits_sign
    check ((reason = 'consume' and delta < 0) or (reason <> 'consume' and delta > 0))
);

create index interview_credits_user_idx on public.interview_credits (user_id);

create unique index interview_credits_one_grant_per_payment
  on public.interview_credits (payment_id) where reason = 'purchase';
create unique index interview_credits_one_charge_per_session
  on public.interview_credits (session_id) where reason = 'consume';
create unique index interview_credits_one_refund_per_session
  on public.interview_credits (session_id) where reason = 'refund';

alter table public.interview_credits enable row level security;

create policy interview_credits_select_own on public.interview_credits
  for select to authenticated using ((select auth.uid()) = user_id);

comment on table public.interview_credits is
  'Append-only ledger of paid interview credits. Balance = sum(delta). Survives round deletion.';
