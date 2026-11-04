-- Interview credits are counted in halves (owner, 4 November 2026).
--
-- A 30-minute round costs half a credit; a 45- or 60-minute round costs one. The ledger
-- stays integer — a balance must never be a float — by counting half-credits: a pack of
-- 5 credits grants 10, a 30-minute round consumes 1, a longer one 2.
--
-- The column is renamed rather than reinterpreted in place. Code still reading `delta`
-- after this runs fails loudly instead of reading 10 half-credits as 10 credits.
--
-- Existing rows are whole credits and are doubled, so every balance means the same
-- amount of interviewing before and after.

alter table public.interview_credits rename column delta to half_credits;

update public.interview_credits set half_credits = half_credits * 2;

comment on column public.interview_credits.half_credits is
  'Signed change in half-credits: purchase = 2 x pack credits, consume = -1 (30-minute round) or -2 (longer), refund = the consume it reverses.';

comment on table public.interview_credits is
  'Append-only ledger of paid interview credits, in half-credits. Balance = sum(half_credits) / 2 credits. Survives round deletion.';
