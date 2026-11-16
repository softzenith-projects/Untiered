# Model lifecycle

Which Gemini models the API runs, and what Google has announced about their retirement.
Re-check the [deprecations page](https://ai.google.dev/gemini-api/docs/deprecations) before
relying on any date here: Google lists *earliest possible* dates and has retired models without
much warning before (`gemini-2.5-flash-lite`, September 2026, found only through the spend ledger).

Last checked 14 November 2026, from search excerpts of Google's pages. The pages themselves now
redirect to `aistudio.google.com/docs/...` and could not be fetched in that session.

| Use | Model id (default) | Override | Status |
|---|---|---|---|
| Reasoning and audio, primary | `gemini-3.1-flash-lite` | `GEMINI_PRIMARY_MODEL` | Earliest shutdown **7 May 2027**. Listed replacement: `gemini-3.5-flash-lite`. |
| Reasoning and audio, fallback | `gemini-3.6-flash` | `GEMINI_FALLBACK_MODEL` | No shutdown announced. Was `gemini-3.5-flash`, which Google now routes to `gemini-3.6-flash` automatically; pinned by name on 14 November 2026 so the model tested is the model run. |
| Interviewer voice (server) | `gemini-2.5-flash-preview-tts` | `INTERVIEWOS_GEMINI_SPEECHMODEL` | **Earliest shutdown 17 November 2026.** Listed replacements: `gemini-3.8-flash-tts`, `gemini-3.8-flash-lite-tts`. Only used when the browser does not speak the question itself. |
| Text-only third provider | `kimi-k2-0711-preview` | `FALLBACK_PROVIDER_MODEL` | Not a Google model. |

## Moving the primary to `gemini-3.5-flash-lite`

Planned, not done. Before switching (interviewer design review, step 3):

- Replay the recorded answer set on both models (layer 1 of the review's evaluation). This spends
  money and processes candidate audio, so it needs the owner's go-ahead and consented clips.
- Compare transcription on Hindi-English answers and grading against the rubric.
- Price: at September 2026 list prices 3.5 Flash-Lite is $0.30 text and audio in, $2.50 out,
  against $0.25 / $0.50 / $1.50 for 3.1 Flash-Lite. The review estimates the two cancel out for
  this workload; measure it from the spend ledger.
- `gemini-3.5-flash-lite` rejects a thinking *budget* of 0 (400). Use `thinking-level: minimal`
  on it (documented as supported and default) rather than any budget.

## Thinking settings

In-room calls (assessment, hint, opening question) send either a 128-token `thinkingBudget`
(the default, unchanged) or a `thinkingLevel`, per provider (`GEMINI_PRIMARY_THINKING_LEVEL`,
`GEMINI_FALLBACK_THINKING_LEVEL`). Never both: that is a 400. `minimal` is documented for
`gemini-3.1-flash-lite` and `gemini-3.5-flash-lite`. It was **not** confirmed for
`gemini-3.6-flash`, and newer Flash models (3.7, 3.8) reject it, so leave the fallback's level
empty until a single live call confirms it — a 400 on the last audio-capable provider fails the round.
