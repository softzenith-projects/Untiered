package com.interviewos.api.interview

/**
 * Words per second, as a diagnostic (interviewer design review, step 2f).
 *
 * A transcript of thirty words for two seconds of speech did not come from that audio, and one
 * of four words for a minute of it probably did not either. Neither is grounds to refuse an
 * answer — short, slow and code-switched answers are all real — so this only names the turns
 * worth listening to. The thresholds are the review's starting points, to tune on recordings.
 */
object AnswerPace {
    const val MIN_WORDS_PER_SECOND = 0.5
    const val MAX_WORDS_PER_SECOND = 4.5

    /** Below a second of speech the rate means nothing: "yes" is not a pace. */
    const val MIN_SPEAKING_MS = 1_000L

    /** `too_slow`, `too_fast`, or null when the pace is plausible or cannot be measured. */
    fun outOfRange(
        transcript: String?,
        timing: AnswerTiming?,
    ): String? {
        val speakingMs = timing?.speakingMs ?: return null
        if (speakingMs < MIN_SPEAKING_MS || transcript.isNullOrBlank()) return null
        val perSecond = wordsPerSecond(transcript, speakingMs)
        return when {
            perSecond < MIN_WORDS_PER_SECOND -> "too_slow"
            perSecond > MAX_WORDS_PER_SECOND -> "too_fast"
            else -> null
        }
    }

    fun wordsPerSecond(
        transcript: String,
        speakingMs: Long,
    ): Double = transcript.trim().split(WHITESPACE).count { it.isNotEmpty() } / (speakingMs / 1000.0)

    private val WHITESPACE = Regex("\\s+")
}
