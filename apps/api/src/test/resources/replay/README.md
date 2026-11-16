# Turn replay

Feeds stored model outputs back through the server's turn rules with no model call, and reports
which turns each rule would have changed (interviewer design review, evaluation layer 0). It
costs nothing and needs no database. The harness is
`src/test/kotlin/com/interviewos/api/interview/replay/`.

```bash
cd apps/api
./gradlew test --tests '*TurnReplayTest*'                          # synthetic fixtures
REPLAY_DIR=/path/outside/repo ./gradlew test --tests '*TurnReplayTest*'   # a real export
```

The summary is printed and written to `apps/api/build/reports/turn-replay.txt`.

`fixtures/` holds synthetic sessions only. **Do not commit a real export**: it contains candidate
transcripts, which are personal data.

## Exporting real rounds

Read-only. Run by the owner, one session per file, with the session ids filled in:

```sql
select json_build_object(
  'sessionId', s.id,
  'roundType', s.round_type,
  'durationMinutes', s.duration_minutes,
  'enteredAt', coalesce(s.entered_at, s.started_at),
  'turns', (
    select json_agg(json_build_object(
      'turnIndex', t.turn_index,
      'phase', t.phase,
      'question', t.question_text,
      'transcript', t.answer_transcript,
      'assessment', t.assessment,
      'answeredAt', t.answered_at,
      'timing', t.answer_timing,
      'bankQuestionId', t.bank_question_id,
      'poolQuestionId', t.pool_question_id,
      'audioSha256', t.answer_audio_sha256   -- drop this line for rounds before 14 Nov 2026
    ) order by t.turn_index)
    from public.session_turns t
    where t.session_id = s.id
  )
)
from public.sessions s
where s.id = '<session id>';
```

Save each result as `<anything>.json` in one directory and point `REPLAY_DIR` at it.

## File shape

| Field | Meaning |
|---|---|
| `sessionId`, `roundType`, `durationMinutes`, `enteredAt` | From `sessions` |
| `turns[].question` | What the candidate was asked on this turn, as stored |
| `turns[].transcript` | Their answer, or null if unanswered |
| `turns[].assessment` | The model's JSON for this answer, as stored. `nextQuestionText` is what it proposed to ask next |
| `turns[].timing` | The browser's `AnswerTiming`, or null |
| `turns[].audioSha256` | Hash of the upload, from 14 Nov 2026 on |

The question asked *next* is the following turn's `question`. A turn with no following turn is
the one the round ended on.
