package com.interviewos.api.interview

/**
 * A transcript that repeats the previous answer word for word is a transcription that
 * failed, not an answer.
 *
 * On 4 November 2026 two answers in one round came back from the model as an exact copy
 * of the answer before — separate recordings, fourteen seconds each, transcribed as the
 * same 600 characters. Both were recorded and counted: the interviewer re-asked a
 * question it had never had an answer to, and the report scored words the candidate said
 * once as if they had said them twice. Nobody repeats a long answer exactly, so the
 * candidate is asked to answer again instead.
 *
 * Short answers are exempt. "I don't know" twice in a row is a real thing to say twice.
 */
object EchoedAnswer {
    /** Below this many characters, once normalised, a repeat can be genuine. */
    const val MIN_COMPARABLE_LENGTH = 40

    /** The API error code the room answers by opening the microphone on the same question. */
    const val ERROR_CODE = "answer_not_heard"

    fun isEcho(
        transcript: String?,
        previousAnswer: String?,
    ): Boolean {
        val current = normalise(transcript ?: return false)
        val previous = normalise(previousAnswer ?: return false)
        return current.length >= MIN_COMPARABLE_LENGTH && current == previous
    }

    private fun normalise(text: String): String =
        text
            .lowercase()
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .trim()
}
