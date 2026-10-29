package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class EntitlementTest {
    /**
     * With no lifetime allowance configured there is no lifetime gate. The arithmetic for a
     * gate is still tested below — see `interviewos.entitlement.free-rounds`.
     */
    @Test
    fun `with no allowance configured there is no limit`() {
        val tenRoundsIn =
            Entitlement.evaluate(
                freeRoundsUsed = 10,
                creditBalance = 0,
                sessionInProgress = false,
                freeRounds = null,
            )

        assertTrue(tenRoundsIn.allowed)
        assertEquals(Entitlement.Reason.ALLOWED, tenRoundsIn.reason)
        assertEquals(Entitlement.Funding.FREE, tenRoundsIn.funding)
        // Null rather than zero: there is no allowance to count down, which is not the
        // same as having none left.
        assertNull(tenRoundsIn.remainingFree)
        assertTrue(tenRoundsIn.message.contains("free"))
    }

    @Test
    fun `one interview still runs at a time, even with no limit`() {
        // Not a commercial restriction: two live sessions would race each other's turns.
        val decision =
            Entitlement.evaluate(
                freeRoundsUsed = 3,
                creditBalance = 0,
                sessionInProgress = true,
                freeRounds = null,
            )

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
        assertNull(decision.funding)
    }

    @Test
    fun `a new candidate gets the configured allowance`() {
        val decision = evaluate(freeRoundsUsed = 0)

        assertTrue(decision.allowed)
        assertEquals(3, decision.remainingFree)
        assertEquals(Entitlement.Funding.FREE, decision.funding)
        assertEquals("You have 3 free interviews left. Free interviews are for life and do not reset.", decision.message)
    }

    @Test
    fun `each free round started counts down the three`() {
        assertEquals(1, evaluate(freeRoundsUsed = 2).remainingFree)
        assertEquals("You have 1 free interview left. Free interviews are for life and do not reset.", evaluate(freeRoundsUsed = 2).message)
    }

    @Test
    fun `the free interviews are used up once three have started`() {
        val decision = evaluate(freeRoundsUsed = 3)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.FREE_TIER_EXHAUSTED, decision.reason)
        assertEquals(0, decision.remainingFree)
    }

    @Test
    fun `the shipped allowance is three free rounds for life and no daily limit`() {
        // The terms state these numbers (`apps/web/src/lib/legal.ts`).
        val defaults = EntitlementProperties()
        assertEquals(3, defaults.freeRounds)
        assertNull(defaults.dailyRounds)
        assertNull(defaults.dailyMinutes)
    }

    @Test
    fun `the shipped configuration leaves those defaults alone`() {
        // A `daily-rounds: 1` here would quietly bring back "one free interview a day".
        val config =
            javaClass.getResource("/application.yml")?.readText()
                ?: error("application.yml is not on the test classpath")
        for (key in listOf("free-rounds", "daily-rounds", "daily-minutes")) {
            assertFalse(Regex("""^\s*$key:""", RegexOption.MULTILINE).containsMatchIn(config), key)
        }
    }

    @Test
    fun `a credit pays for an interview once the free one is used`() {
        val decision = evaluate(freeRoundsUsed = 3, creditBalance = 1)

        assertTrue(decision.allowed)
        assertEquals(Entitlement.Funding.CREDIT, decision.funding)
        assertEquals("Your free practice is used, so this interview uses 1 of your 1 credit.", decision.message)
    }

    @Test
    fun `free practice is spent before a credit`() {
        // A candidate who bought a pack before their first round must not pay for the round
        // the product would have given them anyway.
        val decision = evaluate(freeRoundsUsed = 0, creditBalance = 5)

        assertTrue(decision.allowed)
        assertEquals(Entitlement.Funding.FREE, decision.funding)
        assertTrue(decision.message.contains("You also have 5 credits."))
    }

    @Test
    fun `with no credits left the free refusal stands`() {
        val decision = evaluate(freeRoundsUsed = 4, creditBalance = 0)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.FREE_TIER_EXHAUSTED, decision.reason)
    }

    @Test
    fun `a refusal offers buying only where buying is possible`() {
        val closed = evaluate(freeRoundsUsed = 3, purchasable = false)
        val open = evaluate(freeRoundsUsed = 3, purchasable = true)

        assertTrue(closed.message.contains("coming soon"))
        assertTrue(open.message.contains("Buy credits"))
        assertTrue(open.purchasable)
    }

    @Test
    fun `a negative balance is never offered as credit`() {
        // The ledger cannot go below zero through this code, but a hand-written correction
        // could; it must read as nothing to spend rather than as a debt that admits rounds.
        val decision = evaluate(freeRoundsUsed = 3, creditBalance = -2)

        assertFalse(decision.allowed)
        assertEquals(0, decision.creditBalance)
    }

    @Test
    fun `only one interview may run at a time`() {
        val decision = evaluate(freeRoundsUsed = 0, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `an in-progress session blocks even a paying candidate`() {
        val decision = evaluate(freeRoundsUsed = 1, creditBalance = 5, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `remaining free never goes negative`() {
        assertEquals(0, evaluate(freeRoundsUsed = 9).remainingFree)
    }

    /** The shipped allowance: three free rounds for life (owner, 29 October 2026). */
    private fun evaluate(
        freeRoundsUsed: Int,
        creditBalance: Int = 0,
        sessionInProgress: Boolean = false,
        purchasable: Boolean = false,
    ) = Entitlement.evaluate(
        freeRoundsUsed = freeRoundsUsed,
        creditBalance = creditBalance,
        sessionInProgress = sessionInProgress,
        freeRounds = 3,
        purchasable = purchasable,
    )
}
