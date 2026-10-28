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
                completedFreeSessions = 10,
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
                completedFreeSessions = 3,
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
        val decision = evaluate(completedFreeSessions = 0)

        assertTrue(decision.allowed)
        assertEquals(1, decision.remainingFree)
        assertEquals(Entitlement.Funding.FREE, decision.funding)
    }

    @Test
    fun `the free interview is used up once one is completed`() {
        val decision = evaluate(completedFreeSessions = 1)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.FREE_TIER_EXHAUSTED, decision.reason)
        assertEquals(0, decision.remainingFree)
    }

    @Test
    fun `an abandoned interview does not consume the free one`() {
        // Abandoned sessions never reach `completed`, so they are not counted. The
        // candidate never saw a report, which is the thing the free tier exists to show.
        val decision = evaluate(completedFreeSessions = 0)

        assertTrue(decision.allowed)
    }

    @Test
    fun `a credit pays for an interview once the free one is used`() {
        val decision = evaluate(completedFreeSessions = 1, creditBalance = 1)

        assertTrue(decision.allowed)
        assertEquals(Entitlement.Funding.CREDIT, decision.funding)
        assertEquals("Your free practice is used, so this interview uses 1 of your 1 paid interview.", decision.message)
    }

    @Test
    fun `free practice is spent before a credit`() {
        // A candidate who bought a pack before their first round must not pay for the round
        // the product would have given them anyway.
        val decision = evaluate(completedFreeSessions = 0, creditBalance = 5)

        assertTrue(decision.allowed)
        assertEquals(Entitlement.Funding.FREE, decision.funding)
        assertTrue(decision.message.contains("You also have 5 paid interviews."))
    }

    @Test
    fun `with no credits left the free refusal stands`() {
        val decision = evaluate(completedFreeSessions = 4, creditBalance = 0)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.FREE_TIER_EXHAUSTED, decision.reason)
    }

    @Test
    fun `a refusal offers buying only where buying is possible`() {
        val closed = evaluate(completedFreeSessions = 1, purchasable = false)
        val open = evaluate(completedFreeSessions = 1, purchasable = true)

        assertTrue(closed.message.contains("Upgrade"))
        assertTrue(open.message.contains("Buy an interview"))
        assertTrue(open.purchasable)
    }

    @Test
    fun `a negative balance is never offered as credit`() {
        // The ledger cannot go below zero through this code, but a hand-written correction
        // could; it must read as nothing to spend rather than as a debt that admits rounds.
        val decision = evaluate(completedFreeSessions = 1, creditBalance = -2)

        assertFalse(decision.allowed)
        assertEquals(0, decision.creditBalance)
    }

    @Test
    fun `only one interview may run at a time`() {
        val decision = evaluate(completedFreeSessions = 0, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `an in-progress session blocks even a paying candidate`() {
        val decision = evaluate(completedFreeSessions = 1, creditBalance = 5, sessionInProgress = true)

        assertFalse(decision.allowed)
        assertEquals(Entitlement.Reason.SESSION_IN_PROGRESS, decision.reason)
    }

    @Test
    fun `remaining free never goes negative`() {
        assertEquals(0, evaluate(completedFreeSessions = 9).remainingFree)
    }

    /** The allowance the PRD describes, and what `free-rounds: 1` would restore. */
    private fun evaluate(
        completedFreeSessions: Int,
        creditBalance: Int = 0,
        sessionInProgress: Boolean = false,
        purchasable: Boolean = false,
    ) = Entitlement.evaluate(
        completedFreeSessions = completedFreeSessions,
        creditBalance = creditBalance,
        sessionInProgress = sessionInProgress,
        freeRounds = 1,
        purchasable = purchasable,
    )
}
