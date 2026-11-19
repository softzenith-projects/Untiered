-- Client telemetry: the candidate began speaking again soon after an automatic submit, so the
-- silence window cut them off (speech-probability endpointing, PRD interview section).
-- `duration_ms` holds the window that was used. Content-free, like the rest of the ledger.
--
-- Rebuilds the event_type check from the list in 20261114200000_interview_event_reasons.sql
-- plus this one value. Additive: no existing row can fail the wider constraint.

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
  -- new
  'turn_resumed_after_submit'
));
