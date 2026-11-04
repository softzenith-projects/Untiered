package com.interviewos.api.interview

/**
 * Whether a candidate may start another interview, and what pays for it.
 *
 * Entitlement is derived from what actually happened — the free rounds started, the credit
 * ledger and the rounds started today — rather than stored as a flag, so it cannot
 * drift out of sync with reality (CLAUDE.md: progress is derived, not declared).
 *
 * Checked in this order, and the order is the message the candidate sees:
 *
 * 1. **One interview at a time.** Not commercial, and stays whatever the plan: two live
 *    sessions would race each other's turns.
 * 2. **Lifetime free rounds** (`interviewos.entitlement.free-rounds`, 3 by owner decision
 *    on 29 October 2026). Counted when a free round *starts*, exactly as a paid credit is
 *    spent: the model is paid for from the first question, and counting only completed
 *    rounds would make start-and-leave unlimited free practice. A round that fails on our
 *    side is handed back, as a credit is.
 * 3. **The daily allowance**, when configured (off by default): rounds started today, then
 *    planned minutes used today, then whether the requested round fits in what is left.
 * 4. **Paid credit**, only once the free allowance says no. Free practice is always
 *    spent first, so a candidate who bought a pack never pays for a round the product
 *    would have given them anyway. A 30-minute round costs half a credit and a longer one
 *    a whole credit ([RoundLength]); the balance must cover the round being started.
 */
object Entitlement {
    /**
     * @param freeRoundsUsed free rounds started and not handed back after a failure.
     * @param halfCreditBalance paid credit not yet spent, in half-credits ([RoundLength]).
     * @param purchasable whether credits can be bought here, which decides what a refusal
     *   tells the candidate to do next.
     * @param freeRounds how many rounds a candidate gets free for life, or null for no
     *   lifetime limit at all.
     * @param requestedMinutes the length of the round being started, or null when only
     *   asking whether a round could be started at all (the dashboard).
     */
    fun evaluate(
        freeRoundsUsed: Int,
        halfCreditBalance: Int,
        sessionInProgress: Boolean,
        freeRounds: Int?,
        daily: DailyUsage = DailyUsage.UNLIMITED,
        requestedMinutes: Int? = null,
        purchasable: Boolean = false,
    ): EntitlementDecision {
        val remaining = remainingFree(freeRounds, freeRoundsUsed)
        val balance = halfCreditBalance.coerceAtLeast(0)
        // With no round named yet (the dashboard), the question is whether any round could be paid for.
        val cost = requestedMinutes?.let(RoundLength::halfCreditsFor) ?: RoundLength.CHEAPEST_HALF_CREDITS

        fun decision(
            reason: Reason,
            funding: Funding? = null,
        ) = EntitlementDecision(
            allowed = reason == Reason.ALLOWED,
            reason = reason,
            remainingFree = if (reason == Reason.FREE_TIER_EXHAUSTED) 0 else remaining,
            daily = daily,
            funding = funding,
            halfCreditBalance = balance,
            // Only a named round has a price; the dashboard asks before one is chosen.
            halfCreditCost = if (funding == Funding.CREDIT) requestedMinutes?.let { cost } else null,
            purchasable = purchasable,
        )

        if (sessionInProgress) return decision(Reason.SESSION_IN_PROGRESS)
        val freeRefusal = freeRefusal(freeRoundsUsed, freeRounds, daily, requestedMinutes)
        if (freeRefusal == null) return decision(Reason.ALLOWED, Funding.FREE)
        if (balance >= cost) return decision(Reason.ALLOWED, Funding.CREDIT)
        // Half a credit left, and a round that costs one: a 30-minute round would still fit.
        if (balance > 0 && freeRefusal == Reason.FREE_TIER_EXHAUSTED) return decision(Reason.CREDIT_SHORT)
        // With nothing to pay for it, the candidate is told why the free allowance said no —
        // including the minutes left when a shorter round would still fit, the cheapest way on.
        return decision(freeRefusal)
    }

    /** Why the free allowance alone cannot cover this round, or null when it can. */
    private fun freeRefusal(
        freeRoundsUsed: Int,
        freeRounds: Int?,
        daily: DailyUsage,
        requestedMinutes: Int?,
    ): Reason? {
        if (freeRounds != null && freeRoundsUsed >= freeRounds) return Reason.FREE_TIER_EXHAUSTED
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
        freeRoundsUsed: Int,
    ): Int? = freeRounds?.let { (it - freeRoundsUsed).coerceAtLeast(0) }

    /** What pays for an admitted round. */
    enum class Funding {
        /** The free allowance; recorded in `practice_usage`. */
        FREE,

        /** Paid credit — half or one, by length — spent when the round starts; recorded in `interview_credits`. */
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

        /** Half a credit is left, and this round costs a whole one. A 30-minute round fits. */
        CREDIT_SHORT,
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
    /** Paid credit held, in half-credits. */
    val halfCreditBalance: Int = 0,
    /** What this round will be charged, in half-credits, when credit pays for it. */
    val halfCreditCost: Int? = null,
    val purchasable: Boolean = false,
) {
    /** Paid credit held, in credits — 2.5 for five half-credits. */
    val creditBalance: Double get() = RoundLength.toCredits(halfCreditBalance)

    val message: String
        get() =
            when (reason) {
                Entitlement.Reason.ALLOWED -> {
                    when {
                        funding == Entitlement.Funding.CREDIT && halfCreditCost != null && halfCreditCost < 2 -> {
                            "Your free practice is used, so this interview uses half a credit. You have ${paid()}."
                        }

                        funding == Entitlement.Funding.CREDIT && halfCreditCost == null -> {
                            "Your free practice is used, so interviews now use your credits: half a credit for " +
                                "30 minutes, one for 45 or 60. You have ${paid()}."
                        }

                        funding == Entitlement.Funding.CREDIT -> {
                            "Your free practice is used, so this interview uses 1 of your ${paid()}."
                        }

                        daily.roundLimit != null || daily.minuteLimit != null -> {
                            "Free practice today: ${allowanceLeft()}.${paidHeld()}"
                        }

                        remainingFree == null -> {
                            "Every round is free while we are building this. Practise as often as you like."
                        }

                        else -> {
                            "You have $remainingFree free ${if (remainingFree == 1) "interview" else "interviews"} " +
                                "left. Free interviews are for life and do not reset.${paidHeld()}"
                        }
                    }
                }

                Entitlement.Reason.SESSION_IN_PROGRESS -> {
                    "You already have an interview in progress. Finish or leave it before starting another."
                }

                Entitlement.Reason.FREE_TIER_EXHAUSTED -> {
                    if (purchasable) {
                        "You have used your free interviews, which do not reset. Buy credits to keep practising."
                    } else {
                        "You have used your free interviews, which do not reset. Interview credits are coming soon."
                    }
                }

                Entitlement.Reason.DAILY_ROUNDS_REACHED, Entitlement.Reason.DAILY_MINUTES_REACHED -> {
                    "You have used today's free practice (${allowanceSummary()}). It resets at midnight, India time. " +
                        if (purchasable) {
                            "Buy credits to keep practising today."
                        } else {
                            "Pro, with more practice each day, is coming soon."
                        }
                }

                Entitlement.Reason.CREDIT_SHORT -> {
                    "You have half a credit, and rounds over 30 minutes take a whole one. " +
                        "Choose a 30-minute round" + if (purchasable) ", or buy credits for a longer one." else "."
                }

                Entitlement.Reason.DAILY_MINUTES_SHORT -> {
                    "You have ${daily.remainingMinutes} minutes of free practice left today. " +
                        "Choose a round of ${daily.remainingMinutes} minutes or less" +
                        if (purchasable) ", or buy credits for a longer one." else "."
                }
            }

    private fun paidHeld(): String = if (halfCreditBalance > 0) " You also have ${paid()}." else ""

    private fun paid(): String = formatCredits(halfCreditBalance)

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

/** "half a credit", "1 credit", "2.5 credits". */
fun formatCredits(halfCredits: Int): String =
    when {
        halfCredits == 1 -> "half a credit"
        halfCredits == RoundLength.HALF_CREDITS_PER_CREDIT -> "1 credit"
        halfCredits % RoundLength.HALF_CREDITS_PER_CREDIT == 0 -> "${halfCredits / RoundLength.HALF_CREDITS_PER_CREDIT} credits"
        else -> "${RoundLength.toCredits(halfCredits)} credits"
    }
