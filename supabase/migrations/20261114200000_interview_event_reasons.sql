-- Why a turn went the way it did, on the interview ledger (interviewer design review, step 1).
--
-- Still content-free: every new column is a bounded code, never a message, a question, a
-- transcript or a model's output. See 20261010000000_interview_event_ledger.sql.
--
-- Also repairs a gap: the echo check has written event_type 'answer_rejected' with
-- error_type 'echoed_transcript' since it shipped, and neither was allowed by the check
-- constraints, so every one of those rows failed to insert (the ledger is best effort and
-- swallowed it). Echoed answers have never been countable from this table until now.

alter table public.interview_events
  add column model text check (model is null or char_length(model) between 1 and 120),
  add column finish_reason text check (finish_reason is null or finish_reason ~ '^[a-z_]{1,40}$'),
  add column reason text check (reason is null or reason in (
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
    'too_slow', 'too_fast'
  ));

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
  -- new
  'answer_rejected',
  'planned_fallback_used', 'duplicate_blocked', 'wrap_up_blocked', 'question_over_limit',
  'echo_detected', 'no_speech_heard', 'answer_pace_out_of_range'
));

alter table public.interview_events drop constraint interview_events_outcome_check;
alter table public.interview_events add constraint interview_events_outcome_check check (outcome is null or outcome in (
  'started', 'succeeded', 'failed', 'timed_out', 'fallback', 'ready', 'unavailable',
  -- a server rule changed what the candidate heard / would have, had its flag been on
  'applied', 'shadow'
));

alter table public.interview_events drop constraint interview_events_error_type_check;
alter table public.interview_events add constraint interview_events_error_type_check check (error_type is null or error_type in (
  'ai_unavailable', 'storage_unavailable', 'database_write_failed', 'request_failed',
  'client_timeout', 'browser_media_error', 'unknown',
  'echoed_transcript'
));

comment on column public.interview_events.reason is
  'A code: AiFailureReason on a failed call, or the rule that fired on a guard event. Never text.';

-- A hash of each answer's upload, so a browser that resends an earlier recording is caught
-- before the model is called. Only the digest is kept; the audio itself is still not stored.
alter table public.session_turns
  add column answer_audio_sha256 text check (answer_audio_sha256 is null or answer_audio_sha256 ~ '^[0-9a-f]{64}$');

comment on column public.session_turns.answer_audio_sha256 is
  'SHA-256 of the answer upload, hex. Compared within one session only; deleted with the turn.';
