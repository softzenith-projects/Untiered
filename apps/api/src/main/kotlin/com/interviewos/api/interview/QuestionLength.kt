package com.interviewos.api.interview

/**
 * The longest question the interviewer may speak, in characters.
 *
 * A product rule, not a model setting: the question is read aloud, and a paragraph is a
 * lecture with a question mark on the end. The response schema carries `maxLength: 120` too,
 * but Gemini does not enforce `maxLength` — so the server is the only thing that can.
 * `TurnGuards` enforces it when `interviewos.interviewer.length-guard` is on; until then it is
 * only counted (`question_over_limit` on the interview ledger).
 */
object QuestionLength {
    const val MAX_CHARS = 120
}
