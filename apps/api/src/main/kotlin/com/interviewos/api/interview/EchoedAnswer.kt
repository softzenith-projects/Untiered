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

    /** Which earlier answer a transcript copies, if any. */
    enum class Match(
        /** The `interview_events.reason` code. */
        val reason: String,
    ) {
        PREVIOUS("previous_answer"),
        EARLIER("earlier_answer"),
    }

    /**
     * Whether [transcript] copies any of [earlierAnswers] (oldest first), and which.
     *
     * The review's case: a 19-second answer stored as a copy of the one two turns before it,
     * which the comparison with the previous answer alone could not see.
     */
    fun matchOf(
        transcript: String?,
        earlierAnswers: List<String?>,
    ): Match? {
        val answers = earlierAnswers.filterNotNull()
        if (answers.isEmpty()) return null
        if (isEcho(transcript, answers.last())) return Match.PREVIOUS
        return if (answers.dropLast(1).any { isEcho(transcript, it) }) Match.EARLIER else null
    }

    private fun normalise(text: String): String =
        text
            .lowercase()
            .replace(Regex("[^\\p{L}\\p{N}]+"), " ")
            .trim()
}
