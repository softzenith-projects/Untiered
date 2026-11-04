package com.interviewos.api.interview

/**
 * How long a round may run, and what a paid one costs (owner, 4 November 2026).
 *
 * Three lengths: 30, 45 and 60 minutes. A 30-minute round costs half a credit and anything
 * longer costs one. A custom-topic round is 30 minutes only — it practises one topic, and
 * half an hour covers it.
 *
 * The ledger counts half-credits (`interview_credits.half_credits`) so that this stays
 * integer arithmetic: one credit is [HALF_CREDITS_PER_CREDIT] ledger units.
 *
 * A free round is a whole free round whatever its length — the free tier is "three free
 * interviews", not three interviews' worth of minutes.
 */
object RoundLength {
    val MINUTES: List<Int> = listOf(30, 45, 60)
    val CUSTOM_TOPIC_MINUTES: List<Int> = listOf(30)
    const val DEFAULT_MINUTES = 45
    const val DEFAULT_CUSTOM_TOPIC_MINUTES = 30

    /** Rounds up to this long cost half a credit. */
    const val HALF_CREDIT_UP_TO_MINUTES = 30

    const val HALF_CREDITS_PER_CREDIT = 2

    fun allowedFor(roundType: RoundType): List<Int> = if (roundType == RoundType.CUSTOM_TOPIC) CUSTOM_TOPIC_MINUTES else MINUTES

    fun defaultFor(roundType: RoundType): Int = if (roundType == RoundType.CUSTOM_TOPIC) DEFAULT_CUSTOM_TOPIC_MINUTES else DEFAULT_MINUTES

    /** The allowed length closest to [minutes], ties going to the shorter. For drafts the model proposed. */
    fun nearest(
        roundType: RoundType,
        minutes: Int,
    ): Int = allowedFor(roundType).minBy { kotlin.math.abs(it - minutes) }

    /** What a paid round of [durationMinutes] costs, in half-credits. */
    fun halfCreditsFor(durationMinutes: Int): Int = if (durationMinutes <= HALF_CREDIT_UP_TO_MINUTES) 1 else 2

    /** The cheapest paid round, in half-credits — what a balance must hold to start anything at all. */
    val CHEAPEST_HALF_CREDITS: Int get() = MINUTES.minOf(::halfCreditsFor)

    fun toCredits(halfCredits: Int): Double = halfCredits.toDouble() / HALF_CREDITS_PER_CREDIT
}
