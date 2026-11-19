# Krivih: what to reuse from open source, and how to prove it does not regress

19 November 2026. Research and design only — no product code changed. Sources were read from
shallow clones; file paths below are relative to each repo.

## 1. Summary

Krivih's *interviewing* is already stronger than every open-source interviewer inspected: no
project has its coverage steering, level calibration, honest intervention recording, planned-
question provenance or server-side turn guards. What open source does better is the **audio
layer and turn-taking** — deciding when a candidate has finished and what kind of turn it was.
That is where the reuse is.

Five adoptions, in priority order (the brief's rule: quality first, latency and cost after):

| # | Borrow | From | Licence | Fixes |
|---|---|---|---|---|
| 1 | Turn-completion protocol (complete / cut off / needs time) as fields on the existing turn call | Pipecat `turns/user_turn_completion_mixin.py`, `turns/user_stop/classifier_user_turn_stop_strategy.py` | BSD-2 | States B, C, D, E, F, I: "give me a second" no longer becomes an answer |
| 2 | Silero VAD in the browser in place of the volume threshold | `ricky0123/vad` `packages/web` | ISC (model MIT) | "Keeps listening after I stopped" in noisy rooms |
| 3 | Smart Turn v3.2 audio end-of-turn model, run on the silence | `pipecat-ai/smart-turn` `inference.py`; Pipecat `audio/turn/smart_turn/_whisper_features.py` | BSD-2 | Cuts the fixed 3.5s wait when the answer sounds finished; supports Hindi and Marathi |
| 4 | Per-candidate pause learning | LiveKit `livekit-agents/livekit/agents/voice/endpointing.py` (`DynamicEndpointing`) | Apache-2.0 | Slow or code-switching speakers are not cut off |
| 5 | Speculative turn: start the assessment on an early end-of-turn, discard it if they resume | Pipecat `turns/speculation_gate.py`, `turns/user_stop/eager_user_turn_stop_strategy.py` | BSD-2 | Hides most of the ~3s model call inside the wait |

Plus two that are ours to fix, found while measuring, and larger than any of the above:
**the voice of the next question takes ~5–14s** (`interview-room.tsx:46`), and **~8% of turn
calls time out at 20s** before falling back.

## 2. Baseline — what exists now

### Measured (production ledger, 1–19 Nov 2026, read-only aggregate query)

Small sample: 7 sessions, ~160 answered turns. Treat as indicative.

| Stage | p50 | p90 | Source |
|---|---|---|---|
| Silence before an answer is taken as finished | 3.5s fixed (8s in workspace rounds) | — | `apps/web/src/lib/silence.ts` |
| `assessAnswer` model call (success) | 3.1s | 4.5s | `interview_events.answer_assessment_succeeded` |
| `assessAnswer` attempt that failed | 20.0s | 20.0s | 12 of ~150 attempts — a timeout, then fallback |
| Answer submitted → response ready (server) | 3.9s | **23.9s** | `answer_response_ready` (n=22) |
| Next question's voice (TTS) | ~5s per sentence, ~14s a paragraph | — | code comment, not in the ledger |
| Cost per completed interview | **$0.10** (p50, n=6) | — | `ai_calls` |
| Cost per turn (`assessAnswer`, flash-lite) | $0.0024 | — | `ai_calls`, ~7.2k prompt tokens of which ~1.1k audio |

So a candidate who stops talking waits roughly **3.5s (silence) + 3–4s (assessment) + several
seconds (voice)**, and about one turn in twelve waits 20s more. Turn detection is the part the
user notices first; the voice and the timeouts are the larger share of the wall clock.

### What Krivih already does (do not rebuild)

- One Gemini call per turn hears the audio, transcribes, assesses and writes the next line
  (`assess-answer-turn.md`). No separate STT, no separate intent call.
- `hint` / `guide` / `redirect` actions with honest `intervention` recording → report's
  assistance summary (`AssistanceSummary.kt`). Covers most of state D and H.
- Coverage steering against `roundCovers`, a hard follow-up budget, no CV-circling.
- Deterministic guards on the next line: repeat, over-length, early wrap-up, missing question
  (`TurnGuards.kt`), and an echo check (`EchoedAnswer.kt`).
- Offline replay harness over stored turns, no model calls (`src/test/.../replay/`).

### Gaps against the brief's intent list

| State | Today | Gap |
|---|---|---|
| A finished | Waits 3.5s regardless | Too slow when clearly finished |
| B still thinking | Volume-based; long pause → submitted | A 4s think mid-answer ends the turn |
| C confirmation | Model sees it as an answer | Not distinguished; may be assessed as a thin explanation |
| D needs help | `hint`/`guide` exist | "Repeat the question" spends a turn and the follow-up budget |
| E self-correction | Model may handle it | Not instructed; not recorded |
| F asks a question | Model may handle it | Spends a turn; no "answer and resume" rule |
| G incomplete | `probe` exists | Model does not know what a strong answer covers (see §5) |
| H off-topic | `redirect` exists | Covered |
| I asks for time | **"Give me a second" + 3.5s silence = submitted as the answer** | The clearest bug in the list |

## 3. What was inspected

| Project | Stars | Licence | What it is | Verdict |
|---|---|---|---|---|
| `pipecat-ai/pipecat` | 17.3k | BSD-2 | Voice-agent framework | **Reuse ideas + small code** (turn protocol, speculation, Whisper features) |
| `pipecat-ai/smart-turn` | 1.7k | BSD-2 | 8MB audio end-of-turn model, 23 languages incl. Hindi, Marathi | **Reuse model** |
| `livekit/agents` | 15.3k | Apache-2.0 (turn-detector *model* under LiveKit Model License) | Voice-agent framework | **Reuse algorithm** (dynamic endpointing, interruption rules); not the text EOU model |
| `ricky0123/vad` | 2.1k | ISC | Silero VAD for the browser | **Reuse library** |
| `snakers4/silero-vad` | 10.7k | MIT | The VAD model itself | Via the above |
| `1146345502/aural-oss` | 227 | MIT | Full AI interview platform, streaming relay | Reference for streaming (adaptive hold: 300ms short question / 1.5s / 3s long); vendors unusable |
| `FoloUp/FoloUp` | 1.3k | MIT | Voice interviewer for hiring | **Nothing to take** — all voice and turn-taking delegated to Retell (paid); 15-line prompt |
| `J3rry320/interview-coach` | 7 | MIT | CLI/web interview simulator | One idea: per-question `expectedTopics` → `missingPoints` (§5) |
| `StephaneWamba/InterviewLab` | 10 | **none** (all rights reserved) | LangGraph + LiveKit interviewer | Ideas only. Its separate intent-LLM node adds a round trip; ours is better inline |
| `TEN-framework/ten-turn-detection` | 628 | Apache-2.0 **+ Agora non-compete, no on-device** | Text turn detector with a "wait" class | Do not use; the *wait* class idea is already in Pipecat's protocol |
| `nexaintel/voice-agent-readiness` | 1 | MIT | Persona battery + deterministic gates for interviewers | Reuse the gate *list* in our replay harness (§6) |
| `ibttf/interview-coder`, Open-Cluely, Meetingly | — | none / none / Apache-2.0 | Live answer-feeding tools, not interviewers | Not applicable. They are what integrity signals defend against |
| LangGraph interview agents | — | — | Python graph orchestration | Not applicable: Kotlin backend, and one inline call beats a graph of calls on latency |

## 4. Reuse register

### 4.1 Turn-completion protocol — Pipecat (BSD-2)

- **What:** Pipecat makes the model put a marker first in every reply: `●` complete, `◐` cut
  off mid-phrase (wait ~5s), `○` needs time / only acknowledged (wait ~10s). Its prompt text is
  the best-written specification of the distinction found anywhere: *complete means
  conversationally complete, not long; a correction or a request to repeat is complete;
  "that's a good question, let me think" is not.* Files:
  `src/pipecat/turns/user_turn_completion_mixin.py` (`_render_completion_instructions`),
  `src/pipecat/turns/user_stop/classifier_user_turn_stop_strategy.py` (`TURN_COMPLETION_QUESTION`).
- **How it fits:** not as markers — as fields on our existing structured output. Add to
  `assess-answer-turn.json`:
  - `turnState`: `complete | cut_off | needs_time`
  - `candidateIntent`: `answer | confirmation | clarification | repeat_request | hint_request |
    asks_question | self_correction | off_topic`
  - `selfCorrection` (nullable): what they first said and what they meant
  Server (`InterviewService`): `cut_off` / `needs_time` → do not persist as an answered turn, do
  not spend the follow-up budget, return `keep_listening` with a wait (5s / 10s, Pipecat's
  defaults) to the client, which keeps the same recording going and resubmits the whole turn.
  `repeat_request` / `clarification` → answer it, allow the re-ask (`TurnFacts.reAskAllowed`
  already exists), no budget spent, recorded as assistance. `confirmation` → continue without
  scoring it as an explanation. `self_correction` → assess the corrected answer; report notes
  it, without penalty.
- **Why better:** fixes states B, C, D, E, F, I with the model that already hears the audio — it
  has prosody, which a text classifier would not.
- **Latency / cost:** no extra call; ~20 output tokens (~$0.00001). A `needs_time` verdict costs
  one assessment round trip, which §4.5 hides.
- **Attribution:** adapted prompt text carries a BSD-2 notice in `docs/third-party-sources.md`.

### 4.2 Browser VAD — `ricky0123/vad-web` (ISC), Silero model (MIT)

- **What:** `packages/web/src/real-time-vad.ts`, `frame-processor.ts`. Per-frame speech
  probability from Silero in an AudioWorklet. Defaults: speech above 0.3, silence below 0.25,
  `redemptionMs` 1400, `minSpeechMs` 400.
- **How it fits:** `getStream` accepts our existing `MediaStream`; `onFrameProcessed` gives the
  probability per frame. Feed that to `observe()` in `silence.ts` instead of `level >= 0.08`.
  The pure state machine and its tests stay; only the input changes.
- **Why better:** volume cannot tell a fan from a voice; Silero can.
- **Latency / cost:** zero server cost. Adds `onnxruntime-web` (~a few MB WASM) and a ~2MB model,
  loaded lazily at the device check. **New dependency** — justify in HANDOFF.

### 4.3 Smart Turn v3.2 — `pipecat-ai/smart-turn` (BSD-2)

- **What:** Whisper-Tiny encoder + linear head, 8MB int8 ONNX, 16kHz input, last 8s of the
  turn, outputs P(turn complete). 23 languages incl. Hindi and Marathi. `inference.py` is the
  reference; Pipecat's `audio/turn/smart_turn/_whisper_features.py` is a dependency-free port of
  the Whisper log-mel front end, which ports to TypeScript.
- **How it fits:** in the browser, on the same `onnxruntime-web` as 4.2. At each VAD silence of
  ~300ms, score the turn so far: high P → end after a short hold (start at 0.8s, Aural's
  production value); low P → keep the long window (3.5s; 8s in workspace rounds). The existing
  "never end before they have spoken" and 2s minimum rules stay.
- **Why better:** a fixed window is either too slow for finished answers or too fast for pauses;
  this one listens to how the sentence ended.
- **Latency / cost:** ~10–100ms CPU per the authors; WASM in a browser **not measured** — the
  first thing to benchmark. Zero server cost. Hinglish code-switching accuracy is unknown: Hindi
  and English are each trained, the mix is not claimed.

### 4.4 Per-candidate pause learning — LiveKit `DynamicEndpointing` (Apache-2.0)

- **What:** `livekit-agents/livekit/agents/voice/endpointing.py`. An exponential moving average
  (α 0.9) of the pauses *between this speaker's own utterances*, clamped to [min, max]; the
  learned value becomes the floor of the wait. LiveKit's defaults: min 0.5s, max 3.0s.
- **How it fits:** ~40 lines in `silence.ts`, pure and unit-testable, carried across turns of
  one session.
- **Why better:** a candidate who habitually pauses 2s mid-answer gets a window that respects it;
  a brisk one is not kept waiting.
- **Latency / cost:** none.

### 4.5 Speculative turn — Pipecat `SpeculationGate` (BSD-2)

- **What:** `src/pipecat/turns/speculation_gate.py`, `eager_user_turn_stop_strategy.py`. Start
  generating the reply on a provisional end of turn; hold it; release it if the turn is
  confirmed, discard it if the user resumes.
- **How it fits:** the client submits at the early endpoint but keeps the mic open; if speech
  resumes before the reply plays, it drops the response and later submits the full turn. The
  server needs the existing turn request id to make a superseded submission idempotent
  (`TurnRequestIdempotencyTest` shows the machinery exists).
- **Why better:** most of the ~3s assessment happens while we would have been waiting anyway.
- **Latency / cost:** removes up to the early-endpoint window from perceived latency; costs one
  wasted `assessAnswer` ($0.0024) per false start. Measure the false-start rate before enabling.

### 4.6 Considered and rejected

- **LiveKit's EOU model** — text-based, needs streaming transcription we do not have; 400MB;
  LiveKit Model License is not OSI.
- **TEN turn detection / TEN VAD** — Agora non-compete clause; turn detection forbids on-device.
- **Adopting Pipecat or LiveKit wholesale** — Python servers alongside Kotlin breaks "no second
  backend language"; we need four ideas, not a framework.
- **A separate intent-classification call** (InterviewLab, Pipecat's classifier strategy) —
  adds a round trip; our turn call already hears the audio.
- **Aural's relay vendors** (ByteDance Volcengine, Alibaba Qwen) — vendor, spend and
  data-protection decision, and CLAUDE.md excludes OpenAI (its backup path).

## 5. Follow-up quality (brief §6)

Found in our own code, not open source: **pool questions already store `strongAnswerCovers`
and `followUps`** (`PoolModels.kt`), but the turn prompt never sees them for the question being
answered — `PlannedQuestion` carries only the *next* question's text. The interviewer is
judging completeness without the answer key it already has.

- Pass the current question's `strongAnswerCovers` and `followUps` into `assess-answer-turn.md`.
- Add `conceptsCovered` / `conceptsMissing` to the schema (the idea behind Interview Coach's
  `expectedTopics` → `missingPoints`, MIT), stored in the turn's assessment JSON.
- Render "already demonstrated" from earlier turns into the prompt so the next probe goes to
  `conceptsMissing` (the HashMap example: covered hashing, buckets, collisions, treeification →
  ask `equals`/`hashCode` or concurrency, never re-ask buckets).
- Bank (sourced) questions have no `strongAnswerCovers`; there the model keeps doing it from
  knowledge, as now.

Cost: a few hundred prompt tokens per turn (~$0.00003). No latency change.

## 6. No-regression plan

Every change ships behind a flag, off by default, in `InterviewerRulesProperties` (server) and a
public env flag (web), and is compared against the baseline before it is turned on.

1. **Offline, no spend (CI):**
   - Unit tests for every new pure function (`silence.ts` with probabilities, dynamic
     endpointing, server handling of each `turnState` / `candidateIntent`, mocked AI).
   - Replay harness gains detectors from voice-agent-readiness's gate list that we lack:
     templated acknowledgement, flattery, language drift (Hindi-English rounds), question
     looping beyond the repeat guard. Run against synthetic fixtures in CI and on an owner-run
     export (`REPLAY_DIR`) to baseline current rounds.
2. **Live, needs the owner's go-ahead (rule 7):**
   - **Golden utterance set:** ~40 short recordings across states A–I, English and Hinglish,
     recorded by the team with consent (never real candidate audio). Run each through
     `assessAnswer` with the flag off and on, three times. ≈ 240 calls ≈ **$0.60**. Pass bar:
     intent accuracy, and transcript + next-question quality judged side by side, no worse on
     any item.
   - **Baseline rounds:** 3–5 scripted rounds on the current build to record end-to-end
     latency, transcription quality and follow-up quality as the human-judged reference. ≈
     $0.10 each.
3. **New telemetry before any flag flips:** a `turn_resumed_after_submit` event (candidate
   spoke again within 3s of an auto-submit = a false cut-off) and `end_of_turn_wait_ms`. The
   false cut-off rate is the regression metric for 4.2–4.5; it must not rise.

## 7. Proposed order

| Step | Change | Spend | Size |
|---|---|---|---|
| 1 | Telemetry for false cut-offs and wait time; replay detectors | none | S |
| 2 | §4.1 turn protocol + §5 answer key, flagged | golden set ≈ $0.60 to validate | M |
| 3 | §4.2 Silero VAD + §4.4 dynamic endpointing, flagged | none | M |
| 4 | §4.3 Smart Turn in browser, flagged — benchmark WASM first | none | M |
| 5 | §4.5 speculative turn | false-start cost, measured | M |
| — | Ours: turn-call timeout 20s → hedged retry at ~p95 (≈5s); TTS first-chunk playback or Gemini Live | live checks | separate decisions |

Step 2 gives the largest quality gain; step 3 the largest perceived-speed gain per line of code.

## 8. Decisions that are the owner's

- Go-ahead for the live golden set and baseline rounds (≈ $1 total).
- Two new web dependencies (`@ricky0123/vad-web`, `onnxruntime-web`) and ~10MB of lazily loaded
  model assets.
- Whether the voice gap (TTS 5–14s) is tackled by streaming TTS playback or by moving to Gemini
  Live — the realtime decision CLAUDE.md lists as open.
