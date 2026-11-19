-- Keep listening: the interviewer waits when a candidate has not finished (PRD 06, the
-- spoken loop; `interviewos.interviewer.turn-state`, InterviewerRulesProperties).
--
-- When the model hears that the recording stopped mid-thought ("so basically when a thread...")
-- or on a request for time ("give me a second"), the turn is not recorded as answered and the
-- room carries on listening. Two things have to be remembered between those requests:
--
--   * how many times the room has been told to keep listening on this turn, so the server can
--     stop waiting after a fixed number (two by default) and the round always moves;
--   * which request was told so, so a retry of that same request gets the same answer back
--     instead of a second model call (the turn-request idempotency the answer route relies on).
--
-- Additive only. Nothing reads these columns while the flag is off.

alter table public.session_turns
  add column keep_listening_count smallint not null default 0
    check (keep_listening_count between 0 and 20),
  add column keep_listening_request_id uuid,
  add column keep_listening_state text
    check (keep_listening_state is null or keep_listening_state in ('cut_off', 'needs_time'));

comment on column public.session_turns.keep_listening_count is
  'How many times the room was told to keep listening on this turn before it was answered.';
comment on column public.session_turns.keep_listening_request_id is
  'The answer request that was last told to keep listening, so its retry is answered the same way.';
comment on column public.session_turns.keep_listening_state is
  'Why the room was last told to keep listening: cut_off or needs_time. A code, never text.';

-- The ledger event, and its reason codes.
--
-- The two check constraints are extended from whatever they allow at the moment this runs,
-- rather than rewritten from a list copied here: another migration may add its own value to
-- the same constraint, and a full rewrite applied after it would silently drop that value.
do $$
declare
  definition text;
  allowed text[];
begin
  select pg_get_constraintdef(c.oid) into definition
    from pg_constraint c
   where c.conrelid = 'public.interview_events'::regclass
     and c.conname = 'interview_events_event_type_check';
  if definition is null then
    raise exception 'interview_events_event_type_check not found; refusing to rebuild it from nothing';
  end if;

  select array_agg(distinct m[1]) into allowed
    from regexp_matches(definition, '''([a-z_]+)''', 'g') as m;
  allowed := array(select distinct unnest(allowed || array['turn_keep_listening']));

  alter table public.interview_events drop constraint if exists interview_events_event_type_check;
  execute format(
    'alter table public.interview_events add constraint interview_events_event_type_check check (event_type = any (%L::text[]))',
    allowed
  );

  select pg_get_constraintdef(c.oid) into definition
    from pg_constraint c
   where c.conrelid = 'public.interview_events'::regclass
     and c.conname = 'interview_events_reason_check';
  if definition is null then
    raise exception 'interview_events_reason_check not found; refusing to rebuild it from nothing';
  end if;

  select array_agg(distinct m[1]) into allowed
    from regexp_matches(definition, '''([a-z_]+)''', 'g') as m;
  allowed := array(select distinct unnest(allowed || array['cut_off', 'needs_time']));

  alter table public.interview_events drop constraint if exists interview_events_reason_check;
  execute format(
    'alter table public.interview_events add constraint interview_events_reason_check check (reason is null or reason = any (%L::text[]))',
    allowed
  );
end
$$;
