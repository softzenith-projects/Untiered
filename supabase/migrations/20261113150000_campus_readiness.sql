-- Untiered Campus: per-college readiness weights (campus spec §6, docs/campus-api-contract.md
-- "Module 6").
--
-- Readiness itself is derived on read from assignment evidence and is never stored, so the
-- weights are the only thing this module keeps. Five integer columns on the organisation
-- rather than a jsonb blob, so the database itself refuses a set that does not add up to 100
-- and no reader has to guess at a missing key. The defaults are the spec's 30/25/25/10/10.
--
-- The organisations table already has RLS on with no policy for the API roles (Migration A,
-- 20261113120000_campus_organisations.sql); these columns inherit that.
--
-- Additive only.

alter table public.organisations
  add column readiness_weight_coding smallint not null default 30
    check (readiness_weight_coding between 0 and 100),
  add column readiness_weight_core_cs smallint not null default 25
    check (readiness_weight_core_cs between 0 and 100),
  add column readiness_weight_technical_interview smallint not null default 25
    check (readiness_weight_technical_interview between 0 and 100),
  add column readiness_weight_communication smallint not null default 10
    check (readiness_weight_communication between 0 and 100),
  add column readiness_weight_aptitude smallint not null default 10
    check (readiness_weight_aptitude between 0 and 100),
  add constraint organisations_readiness_weights_sum check (
    readiness_weight_coding + readiness_weight_core_cs + readiness_weight_technical_interview
      + readiness_weight_communication + readiness_weight_aptitude = 100);

comment on column public.organisations.readiness_weight_coding is
  'Readiness weight for the coding component (campus spec §6). The five weights sum to 100.';
