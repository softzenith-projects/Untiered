package com.interviewos.api.interview

/**
 * Whether a candidate may start another interview, and what pays for it.
 *
 * Entitlement is derived from what actually happened — completed sessions, the credit
 * ledger and the rounds started today — rather than stored as a flag, so it cannot
 * drift out of sync with reality (CLAUDE.md: progress is derived, not declared).
 *
 * Checked in this order, and the order is the message the candidate sees:
 *
 * 1. **One interview at a time.** Not commercial, and stays whatever the plan: two live
 *    sessions would race each other's turns.
 * 2. **Lifetime free rounds**, when `interviewos.entitlement.free-rounds` is set. It
 *    counts *complete free* interviews, because the report is what sells the product and
 *    an abandoned round never showed it.
 * 3. **The daily allowance**: rounds started today, then planned minutes used today, then
 *    whether the requested round fits in what is left. Started, not completed, because the
 *    model is paid for from the first question — an abandoned round has already cost money.
 * 4. **A paid credit**, only once the free allowance says no. Free practice is always
 *    spent first, so a candidate who bought a pack never pays for a round the product
 *    would have given them anyway.
 */
object Entitlement {
    /**
     * @param completedFreeSessions completed rounds that no credit paid for.
     * @param creditBalance paid interview credits not yet spent.
     * @param purchasable whether credits can be bought here, which decides what a refusal
     *   tells the candidate to do next.
     * @param freeRounds how many completed rounds a candidate gets free, or null for no
     *   lifetime limit at all.
     * @param requestedMinutes the length of the round being started, or null when only
     *   asking whether a round could be started at all (the dashboard).
     */
    fun evaluate(
        completedFreeSessions: Int,
        creditBalance: Int,
        sessionInProgress: Boolean,
        freeRounds: Int?,
        daily: DailyUsage = DailyUsage.UNLIMITED,
        requestedMinutes: Int? = null,
        purchasable: Boolean = false,
    ): EntitlementDecision {
        val remaining = remainingFree(freeRounds, completedFreeSessions)
        val balance = creditBalance.coerceAtLeast(0)

        fun decision(
            reason: Reason,
            funding: Funding? = null,
        ) = EntitlementDecision(
            allowed = reason == Reason.ALLOWED,
            reason = reason,
            remainingFree = if (reason == Reason.FREE_TIER_EXHAUSTED) 0 else remaining,
            daily = daily,
            funding = funding,
            creditBalance = balance,
            purchasable = purchasable,
        )

        if (sessionInProgress) return decision(Reason.SESSION_IN_PROGRESS)
        val freeRefusal = freeRefusal(completedFreeSessions, freeRounds, daily, requestedMinutes)
        if (freeRefusal == null) return decision(Reason.ALLOWED, Funding.FREE)
        if (balance > 0) return decision(Reason.ALLOWED, Funding.CREDIT)
        // With nothing to pay for it, the candidate is told why the free allowance said no —
        // including the minutes left when a shorter round would still fit, the cheapest way on.
        return decision(freeRefusal)
    }

    /** Why the free allowance alone cannot cover this round, or null when it can. */
    private fun freeRefusal(
        completedFreeSessions: Int,
        freeRounds: Int?,
        daily: DailyUsage,
        requestedMinutes: Int?,
    ): Reason? {
        if (freeRounds != null && completedFreeSessions >= freeRounds) return Reason.FREE_TIER_EXHAUSTED
        if (daily.remainingRounds == 0) return Reason.DAILY_ROUNDS_REACHED
        if (daily.remainingMinutes == 0) return Reason.DAILY_MINUTES_REACHED
        val minutesLeft = daily.remainingMinutes
        if (requestedMinutes != null && minutesLeft != null && requestedMinutes > minutesLeft) {
            return Reason.DAILY_MINUTES_SHORT
        }
        return null
    }

    /** Null means there is no allowance to count down — not that none is left. */
    private fun remainingFree(
        freeRounds: Int?,
        completedFreeSessions: Int,
    ): Int? = freeRounds?.let { (it - completedFreeSessions).coerceAtLeast(0) }

    /** What pays for an admitted round. */
    enum class Funding {
        /** The free allowance; recorded in `practice_usage`. */
        FREE,

        /** One paid credit, spent when the round starts; recorded in `interview_credits`. */
        CREDIT,
    }

    enum class Reason {
        ALLOWED,

        /** One interview at a time — finish or abandon the open one first. */
        SESSION_IN_PROGRESS,

        FREE_TIER_EXHAUSTED,

        /** Today's free rounds have all been started. */
        DAILY_ROUNDS_REACHED,

        /** Today's free minutes have all been used. */
        DAILY_MINUTES_REACHED,

        /** Some minutes are left today, but fewer than the round asked for. */
        DAILY_MINUTES_SHORT,
    }
}

/**
 * Today's practice so far, against the daily allowance. A null limit means that allowance
 * is switched off, and its remaining count is then null too.
 */
data class DailyUsage(
    val roundsUsed: Int,
    val minutesUsed: Int,
    val roundLimit: Int?,
    val minuteLimit: Int?,
) {
    val remainingRounds: Int? get() = roundLimit?.let { (it - roundsUsed).coerceAtLeast(0) }
    val remainingMinutes: Int? get() = minuteLimit?.let { (it - minutesUsed).coerceAtLeast(0) }

    companion object {
        val UNLIMITED = DailyUsage(roundsUsed = 0, minutesUsed = 0, roundLimit = null, minuteLimit = null)
    }
}

data class EntitlementDecision(
    val allowed: Boolean,
    val reason: Entitlement.Reason,
    /** How many free rounds are left, or null when there is no limit. */
    val remainingFree: Int?,
    val daily: DailyUsage = DailyUsage.UNLIMITED,
    /** What pays for the round when it is allowed; null when it is refused. */
    val funding: Entitlement.Funding? = null,
    val creditBalance: Int = 0,
    val purchasable: Boolean = false,
) {
    val message: String
        get() =
            when (reason) {
                Entitlement.Reason.ALLOWED -> {
                    when {
                        funding == Entitlement.Funding.CREDIT -> {
                            "Your free practice is used, so this interview uses 1 of your ${paid(creditBalance)}."
                        }

                        daily.roundLimit != null || daily.minuteLimit != null -> {
                            "Free practice today: ${allowanceLeft()}.${paidHeld()}"
                        }

                        remainingFree == null -> {
                            "Every round is free while we are building this. Practise as often as you like."
                        }

                        else -> {
                            "You can start an interview.${paidHeld()}"
                        }
                    }
                }

                Entitlement.Reason.SESSION_IN_PROGRESS -> {
                    "You already have an interview in progress. Finish or leave it before starting another."
                }

                Entitlement.Reason.FREE_TIER_EXHAUSTED -> {
                    if (purchasable) {
                        "Your free interview has been used. Buy an interview to keep practising."
                    } else {
                        "Your free interview has been used. Upgrade to continue practising."
                    }
                }

                Entitlement.Reason.DAILY_ROUNDS_REACHED, Entitlement.Reason.DAILY_MINUTES_REACHED -> {
                    "You have used today's free practice (${allowanceSummary()}). It resets at midnight, India time. " +
                        if (purchasable) {
                            "Buy an interview to keep practising today."
                        } else {
                            "Pro, with more practice each day, is coming soon."
                        }
                }

                Entitlement.Reason.DAILY_MINUTES_SHORT -> {
                    "You have ${daily.remainingMinutes} minutes of free practice left today. " +
                        "Choose a round of ${daily.remainingMinutes} minutes or less" +
                        if (purchasable) ", or buy an interview for a longer one." else "."
                }
            }

    private fun paidHeld(): String = if (creditBalance > 0) " You also have ${paid(creditBalance)}." else ""

    private fun paid(count: Int): String = "$count paid ${if (count == 1) "interview" else "interviews"}"

    private fun allowanceLeft(): String =
        listOfNotNull(
            daily.remainingRounds?.let { "$it ${if (it == 1) "round" else "rounds"}" },
            daily.remainingMinutes?.let { "$it minutes" },
        ).joinToString(" and ") + " left"

    private fun allowanceSummary(): String =
        listOfNotNull(
            daily.roundLimit?.let { "$it ${if (it == 1) "round" else "rounds"}" },
            daily.minuteLimit?.let { "$it minutes" },
        ).joinToString(" or ") + " a day"
}
