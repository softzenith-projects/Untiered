package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The daily allowance arithmetic, exercised at two rounds so the round and minute limits can
 * be hit independently. The shipped default is pinned separately below.
 */
class DailyAllowanceTest {
    /** The terms page promises this; `apps/web/src/lib/legal.ts` states the same numbers. */
    @Test
    fun `the default allowance is the one the terms state`() {
        val defaults = EntitlementProperties()
        assertEquals(1, defaults.dailyRounds)
        assertEquals(60, defaults.dailyMinutes)
    }

    private fun today(
        rounds: Int,
        minutes: Int,
    ) = DailyUsage(roundsUsed = rounds, minutesUsed = minutes, roundLimit = 2, minuteLimit = 60)

    private fun evaluate(
        daily: DailyUsage,
        requestedMinutes: Int? = null,
        sessionInProgress: Boolean = false,
        creditBalance: Int = 0,
        purchasable: Boolean = false,
    ) = Entitlement.evaluate(
        completedFreeSessions = 5,
        creditBalance = creditBalance,
        sessionInProgress = sessionInProgress,
        freeRounds = null,
        daily = daily,
        requestedMinutes = requestedMinutes,
        purchasable = purchasable,
    )

    @Test
    fun `a fresh day admits a round and says what is left`() {
        val decision = evaluate(today(rounds = 0, minutes = 0), requestedMinutes = 40)

        assertTrue(decision.allowed)
        assertEquals(2, decision.daily.remainingRounds)
        assertEquals(60, decision.daily.remainingMinutes)
        assertEquals("Free practice today: 2 rounds and 60 minutes left.", decision.message)
    }

    @Test
    fun `a third round in a day is refused, however short`() {
        val decision = evaluate(today(rounds = 2, minutes = 10), requestedMinutes = 5)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.DAILY_ROUNDS_REACHED, decision.reason)
        assertTrue(decision.message.contains("Pro"))
        assertTrue(decision.message.contains("resets at midnight"))
    }

    @Test
    fun `sixty minutes used ends the day even with a round to spare`() {
        val decision = evaluate(today(rounds = 1, minutes = 60))

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.DAILY_MINUTES_REACHED, decision.reason)
        assertEquals(1, decision.daily.remainingRounds)
        assertEquals(0, decision.daily.remainingMinutes)
    }

    /** 40 used, 20 left: a 30-minute round does not fit, a 20-minute one does. */
    @Test
    fun `a round longer than the minutes left is refused with the number that would fit`() {
        val tooLong = evaluate(today(rounds = 1, minutes = 40), requestedMinutes = 30)
        assertFalse(tooLong.allowed)
        assertEquals(Entitlement.Reason.DAILY_MINUTES_SHORT, tooLong.reason)
        assertTrue(tooLong.message.contains("20 minutes"))

        assertTrue(evaluate(today(rounds = 1, minutes = 40), requestedMinutes = 20).allowed)
    }

    @Test
    fun `asking only whether a round could start ignores length while minutes remain`() {
        assertTrue(evaluate(today(rounds = 1, minutes = 55)).allowed)
    }

    @Test
    fun `an open round is still the first thing said`() {
        val decision = evaluate(today(rounds = 2, minutes = 60), sessionInProgress = true)

        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `a credit pays for the round once today's free practice is used`() {
        val decision = evaluate(today(rounds = 2, minutes = 60), requestedMinutes = 45, creditBalance = 3)

        assertTrue(decision.allowed)
        assertEquals(Entitlement.Funding.CREDIT, decision.funding)
        assertEquals(3, decision.creditBalance)
    }

    /** 20 minutes left: a 45-minute round needs a credit, a 20-minute one is still free. */
    @Test
    fun `a round longer than the free minutes left is paid for, a short one is not`() {
        val long = evaluate(today(rounds = 1, minutes = 40), requestedMinutes = 45, creditBalance = 1)
        val short = evaluate(today(rounds = 1, minutes = 40), requestedMinutes = 20, creditBalance = 1)

        assertEquals(Entitlement.Funding.CREDIT, long.funding)
        assertEquals(Entitlement.Funding.FREE, short.funding)
    }

    @Test
    fun `where buying is open the daily refusal says so instead of Pro coming soon`() {
        val decision = evaluate(today(rounds = 2, minutes = 10), purchasable = true)

        assertFalse(decision.allowed)
        assertTrue(decision.message.contains("Buy an interview"))
        assertFalse(decision.message.contains("coming soon"))
    }

    @Test
    fun `switched off, the allowance counts nothing down`() {
        val decision = evaluate(DailyUsage.UNLIMITED, requestedMinutes = 120)

        assertTrue(decision.allowed)
        assertNull(decision.daily.remainingRounds)
        assertNull(decision.daily.remainingMinutes)
    }
}
