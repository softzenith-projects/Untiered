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

-- The ledger event, and its reason codes. Each check is rebuilt from the latest list that
-- defines it plus this migration's values: event_type from 20261119130000_turn_resumed_event.sql
-- (which keeps 'turn_resumed_after_submit'), reason from 20261114200000_interview_event_reasons.sql.
-- Additive: no existing row can fail the wider constraints.

alter table public.interview_events drop constraint interview_events_event_type_check;
alter table public.interview_events add constraint interview_events_event_type_check check (event_type in (
  'room_entered',
  'client_phase_changed', 'client_heartbeat', 'client_page_hidden',
  'answer_submission_started', 'answer_submission_failed', 'answer_submission_slow',
  'browser_speech_failed', 'browser_speech_timed_out', 'question_audio_poll_timed_out',
  'model_audio_play_rejected', 'model_audio_error', 'model_audio_stalled', 'model_audio_timed_out',
  'answer_request_claimed', 'answer_storage_started', 'answer_storage_finished',
  'answer_assessment_started', 'answer_assessment_succeeded', 'answer_assessment_failed',
  'answer_persist_started', 'answer_persist_succeeded', 'answer_persist_failed',
  'answer_response_ready', 'interviewer_decision',
  'provider_attempt_started', 'provider_attempt_succeeded', 'provider_attempt_failed', 'provider_fallback',
  'question_speech_started', 'question_speech_succeeded', 'question_speech_failed',
  'question_speech_state_write_failed',
  'session_completed', 'session_abandoned', 'session_failed',
  'answer_rejected',
  'planned_fallback_used', 'duplicate_blocked', 'wrap_up_blocked', 'question_over_limit',
  'echo_detected', 'no_speech_heard', 'answer_pace_out_of_range',
  'turn_resumed_after_submit',
  -- new: the room was told to keep listening (outcome 'applied'), or would have been but had
  -- already waited as long as it waits (outcome 'fallback')
  'turn_keep_listening'
));

alter table public.interview_events drop constraint interview_events_reason_check;
alter table public.interview_events add constraint interview_events_reason_check check (reason is null or reason in (
  -- AiFailureReason: why a model call failed
  'timeout', 'rate_limited', 'spend_cap', 'model_not_found', 'request_rejected',
  'provider_error', 'unreachable', 'empty_response', 'malformed_json', 'decode_failed',
  'unsupported', 'not_configured', 'unknown',
  -- TurnGuards: which rule fired on the next question
  'no_question', 'wrap_up', 'over_length', 'repeat',
  -- question_over_limit: where an over-long question that reached the candidate came from
  'model_written', 'planned_stored', 'briefing',
  -- echo_detected
  'previous_answer', 'earlier_answer', 'audio_hash',
  -- no_speech_heard
  'browser_silent',
  -- answer_pace_out_of_range
  'too_slow', 'too_fast',
  -- new, turn_keep_listening: the turn state the model heard
  'cut_off', 'needs_time'
));
