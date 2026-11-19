-- Each Run in a coding round: how it ended and how long the runner says it ran
-- (`code_run`, duration_ms = Piston's wall time). Content-free like the rest of the ledger:
-- no source, input or output. Added after a candidate's Java runs were all reported as
-- "stopped after 5 seconds" with nothing on record to say why.
--
-- Rebuilds the event_type check from 20261119140000_turn_keep_listening.sql plus `code_run`,
-- and the outcome check from 20261114200000_interview_event_reasons.sql plus `output_limited`
-- (the program printed more than the runner keeps). Additive: no existing row can fail either.

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
  'turn_keep_listening',
  -- new
  'code_run'
));

alter table public.interview_events drop constraint interview_events_outcome_check;
alter table public.interview_events add constraint interview_events_outcome_check check (outcome is null or outcome in (
  'started', 'succeeded', 'failed', 'timed_out', 'fallback', 'ready', 'unavailable',
  -- a server rule changed what the candidate heard / would have, had its flag been on
  'applied', 'shadow',
  -- new: a code run stopped because it printed too much
  'output_limited'
));
