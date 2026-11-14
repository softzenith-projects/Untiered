# Handoff — 14 November 2026

## Task
Interviewer design review (14 Nov 2026, PDF), steps 1–3 of its "Order to ship" only. No task
file; the brief was given in session. Steps 4–6 not started.

## What I built
Branch `feat/interviewer-guards`, one commit per step, plus PR #160 for one part.

- **Step 1, observability and replay (`f4ed989`).**
  - `AiFailureReason` codes on every model failure, plus the provider's finish reason (Gemini
    `finishReason` or `promptFeedback.blockReason`; OpenAI-format `finish_reason`).
  - Migration `20261114200000_interview_event_reasons.sql` gives `interview_events` the columns
    `model`, `finish_reason` and `reason` (codes only). It also adds `session_turns.answer_audio_sha256`.
  - New counters: `no_speech_heard`, `question_over_limit`, and the upload-to-next-question time
    on `answer_response_ready`.
  - Replay harness: `apps/api/src/test/kotlin/.../interview/replay/`. The fixtures and the export
    SQL are in `apps/api/src/test/resources/replay/`.
- **Step 2, server rules (`88622ac`).**
  - `TurnGuards` (pure functions), `InterviewerRulesProperties` (flags), `AnswerPace`, and
    `EchoedAnswer.matchOf`.
  - New prompts and schemas: `assess-answer-turn.*` and `assess-answer-final.*`.
  - Wiring in `InterviewService.submitAnswer` / `chooseNextLine`.
- **Step 3, Gemini settings (`13cf831`).**
  - A per-provider `thinking-level` and the `send-sampling-params` flag.
  - The fallback model is pinned to `gemini-3.6-flash`.
  - `docs/model-lifecycle.md`.
- **PR #160 (`feat/bank-pool-fallthrough`, based on this branch).** The bank-to-pool
  fall-through, behind a flag, and a rewording of the candidate-facing grounding note.

### Flags, all defaulting to the old behaviour
While a rule is off it still runs and writes outcome `shadow` to `interview_events`, so each
can be counted on real rounds before it is turned on.

| Flag (`interviewos.…`) | Env | Default |
|---|---|---|
| `interviewer.final-variant` | `INTERVIEWER_FINAL_VARIANT` | false |
| `interviewer.planned-fallback` | `INTERVIEWER_PLANNED_FALLBACK` | false |
| `interviewer.wrap-up-guard` | `INTERVIEWER_WRAP_UP_GUARD` | false |
| `interviewer.length-guard` (+ `max-question-chars` 120) | `INTERVIEWER_LENGTH_GUARD` | false |
| `interviewer.repeat-guard` (+ `repeat-threshold`) | `INTERVIEWER_REPEAT_GUARD`, `INTERVIEWER_REPEAT_THRESHOLD` | false, 0.85 |
| `interviewer.echo-all-answers` | `INTERVIEWER_ECHO_ALL_ANSWERS` | false |
| `interviewer.audio-hash-guard` | `INTERVIEWER_AUDIO_HASH_GUARD` | false |
| `interviewer.bank-pool-fallthrough` (PR #160) | `INTERVIEWER_BANK_POOL_FALLTHROUGH` | false |
| `gemini.send-sampling-params` | `GEMINI_SEND_SAMPLING_PARAMS` | true |
| `ai.providers[].thinking-level` | `GEMINI_PRIMARY_THINKING_LEVEL`, `GEMINI_FALLBACK_THINKING_LEVEL` | empty (128-token budget) |

Not behind a flag: the default for `GEMINI_FALLBACK_MODEL` is now `gemini-3.6-flash`, as the brief
asked.

Environment variables that can override model ids: `GEMINI_PRIMARY_MODEL`, `GEMINI_FALLBACK_MODEL`,
`FALLBACK_PROVIDER_MODEL`, and through Spring relaxed binding `INTERVIEWOS_GEMINI_REASONINGMODEL`
and `INTERVIEWOS_GEMINI_SPEECHMODEL`.

## Where the code contradicted the review
- **Two of the review's premises don't hold in the code.**
  - The review says broad failure categories such as `echoed_transcript` are stored. They never
    were: `answer_rejected` and `echoed_transcript` violated the table's check constraints, and
    the best-effort ledger swallowed the error. The migration fixes this.
  - Answer audio is not retained, so "listen to the echo turns" is impossible for past rounds.
- **The 120-character limit collides with the briefing turn**, where the server itself asks for
  2–3 sentences. The briefing turn is exempt (owner's decision).
- **The clock is in the pacing sentences too**, not only the Elapsed/Remaining line. The minute
  counts are stripped in the turn variant; the briefing keeps the time it tells the candidate
  (owner's decision). For the closing phase I replaced "if you mention the time, say exactly this
  much" with "Do not mention the time or that the interview is ending", because the original
  sentence makes no sense without a number.
- **The selector cannot always return a candidate.**
  - The bank takes first claim, and the pool was never reached once the bank ran out (PR #160).
  - There is no pool for project deep-dive, custom-topic or most non-engineering roles.
  - The pool never brings a question back across rounds (`recycle = false`), so a returning
    candidate exhausts it. That is a likely contributor to late-round stalls, not covered by the review.
- **Thinking `minimal` is not confirmed for `gemini-3.6-flash`**, and newer Flash models reject
  it. That is why it's per provider and not global.

## Assumptions I made
- The schema has no field for "the candidate asked for a repeat". So a re-ask of the current
  question is allowed once, in other words, when the action is redirect, hint or guide or any help
  was recorded, and the previous turn was not itself a re-ask.
- Repeat similarity is a word-level edit-distance ratio on the whole line and on its last sentence
  (only when that sentence has 4 or more words).
- Rules judge model-written text only. A stored planned question is never cut or blocked.
- On the final turn the schema still allows `conclude`, so stored `next_action` keeps its meaning.
- When a rule replaces the line, the model's `basis`, `probes` and `askedBecause` are dropped,
  because they describe a question nobody asked.
- With the flags on, a workspace round or a warm-up turn whose line is rejected gets the generic
  filler, with outcome `unavailable` (the owner chose filler plus alert).
- `gemini-3.6-flash` has no row in `AiPrices`. It is costed at UNKNOWN (the 3.5 Flash rate), so it
  is over-counted rather than free. Its audio price was not verified.

## Step 2g: proposals, not built
**Detecting an upload with no speech**
1. Browser timing (`AnswerTiming.firstSoundMs == null`). Already sent and already counted as
   `no_speech_heard`. Refusing on it would save the whole assessment call (about $0.003 and
   3–4 s) at no cost. Risk: a quiet speaker below the browser's threshold, and older clients
   send no timing. **Recommended first**, gated on shadow counts.
2. Server-side energy check. Needs an Opus/WebM decoder, which the JVM doesn't have, so it means
   a new dependency or ffmpeg. A few milliseconds of CPU per answer, but a real dependency cost.
3. A `speechHeard` field in the schema, as in the review's call B. A few output tokens and no
   extra call, but it's a schema change, so step 4/5 territory.

**Re-transcribing an echo before asking the candidate to repeat**
The audio bytes are still in memory during the request, so all three options are feasible.
1. A history-free, transcription-only call on the primary model, keeping the first call's
   decision. About $0.001 for a 45 s answer and 2–3 s. It needs a small prompt, a schema and an
   `InterviewAi.transcribe`. **Recommended**: it removes what the model could copy from.
2. Re-run the full assessment on the fallback model. About $0.007 (3.6 Flash audio price
   unverified) and 4–8 s.
3. `gemini-3.5-transcribe`. About $0.004 for 45 s per the review (unverified). Hindi-English
   support isn't confirmed.

Echo frequency is now countable (`echo_detected`), so the expected spend can be read from the
ledger before choosing.

## Step 2h: unchanged, described
Today, when every provider fails: `answer_assessment_failed` is written (now with a reason and
finish reason), `failSessionAndRefundUsage` marks the session failed and returns the free round
or credit, `session_failed` is written, and the room gets a 503: "The interview has been stopped
rather than scored unfairly."

Continuing with a planned question instead would need all of the following:
- An answered turn without a transcript. `session_turns_answer_consistency` forbids that today.
- Keeping the audio until a later assessment succeeds. That reverses the decision not to retain
  answer audio, and the consent copy changes with it.
- A background re-assessment with retries, and a report that waits for it.
- A planned question to ask, which exists only where the bank or pool has one.
- A refund rule for a round that was partly assessed.

Retention, consent and refunds are owner decisions.

## What I could NOT verify
- **CI.** GitHub did not start any job on these branches: "recent account payments have failed
  or your spending limit needs to be increased". The result is unknown.
- **The migration** was applied to the local Supabase inside a transaction and rolled back. The
  constraints accept the new codes and reject free text and unknown events. That is a stand-in
  for CI's database job, not the job itself.
- **Live Gemini behaviour.** Not checked:
  - whether the turn schema's required non-null field is honoured;
  - `thinkingLevel` on each model;
  - latency, and real echo, repeat and no-speech rates.
- **Google's docs** were read from search excerpts. The pages now redirect to
  `aistudio.google.com`, and fetching there was refused in this session.

## Verification status
- `cd apps/api && ./gradlew ktlintCheck test build` passes on `feat/interviewer-guards`
  (`13cf831`) and on `feat/bank-pool-fallthrough` (`82fe073`). The web app is untouched.
- The replay runs on the synthetic fixtures and prints a per-rule summary
  (`apps/api/build/reports/turn-replay.txt`).

## Merge status
- `feat/interviewer-guards` is pushed and **not merged**, because CI could not run (CLAUDE.md
  rule 1: no CI, no merge). When CI is green, merge it and run `npm run db:push` in the same step.
  Check `npm run supabase -- migration list --linked` first: the campus migrations
  (20261113…–20261114…) are on `feat/campus-v1`, not on `develop`. If they are already on the
  remote, a push from `develop` may refuse.
- PR #160 is open against `feat/interviewer-guards`. It changes what the candidate is told about
  sourced questions.

## Suggested next task
Run the replay on the 11 and 12 November sessions (export SQL in the replay README), then turn
on the flags whose `shadow` counts look right.

## Open questions for you
1. **`gemini-2.5-flash-preview-tts` has a listed earliest shutdown of 17 November 2026** (listed
   replacements: `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`). It is the server voice.
   This was not in scope; it needs a decision this week.
2. GitHub Actions billing, so CI can run.
3. The export of the 11 and 12 November rounds, for the real replay.
4. One live call to confirm `gemini-3.6-flash` accepts `thinkingLevel: minimal`, and its price
   row for `AiPrices`.
5. The review document isn't in the repo (`docs/reviews/` doesn't exist). Commit it if it should
   be the reference.
