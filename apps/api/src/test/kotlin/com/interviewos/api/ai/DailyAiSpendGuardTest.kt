package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class DailyAiSpendGuardTest {
    private class Spend : AiSpendReadModel {
        var total = 0L
        var reads = 0
        var since: Instant? = null
        var rate = AiFallbackRate(0, 0)

        override fun spentSince(since: Instant): Long {
            reads++
            this.since = since
            return total
        }

        override fun spentByUserSince(
            userId: UUID,
            since: Instant,
        ): Long = total

        override fun fallbackRateSince(since: Instant): AiFallbackRate = rate
    }

    @Test
    fun `production budget requirement rejects a disabled cap`() {
        assertFailsWith<IllegalArgumentException> {
            AiBudgetProperties(dailyCapMicroUsd = 0, requireDailyCap = true)
        }
        AiBudgetProperties(dailyCapMicroUsd = 1, requireDailyCap = true)
    }

    @Test
    fun `optional work stops at the cap while essential calls continue`() {
        val spend = Spend().apply { total = 1_000 }
        val alerts = mutableListOf<String>()
        val guard = DailyAiSpendGuard(AiBudgetProperties(1_000), spend, { Instant.parse("2026-10-14T12:00:00Z") }, alerts::add)

        for (call in listOf("composeRound", "offerHint", "composeLoopPattern", "researchEmployerLoop")) {
            assertFailsWith<AiUnavailableException> { guard.check(call) }
        }
        for (call in listOf("assessAnswer", "composeReport", "synthesizeSpeech", "composeOpeningQuestion")) {
            guard.check(call)
        }

        assertEquals(1, spend.reads)
        assertEquals(Instant.parse("2026-10-14T00:00:00Z"), spend.since)
        assertEquals(1, alerts.size)
        assertTrue(alerts.single().contains("1000"))
    }

    @Test
    fun `spend is refreshed after sixty seconds and at UTC midnight`() {
        val spend = Spend().apply { total = 900 }
        var clock = Instant.parse("2026-10-14T23:59:00Z")
        val guard = DailyAiSpendGuard(AiBudgetProperties(1_000), spend, { clock }, { })

        guard.check("composeRound")
        spend.total = 1_000
        clock = clock.plusSeconds(59)
        guard.check("composeRound")
        assertEquals(1, spend.reads)

        clock = clock.plusSeconds(1)
        spend.total = 0
        guard.check("composeRound")
        assertEquals(2, spend.reads)
        assertEquals(Instant.parse("2026-10-15T00:00:00Z"), spend.since)

        clock = clock.plusSeconds(60)
        spend.total = 1_000
        assertFailsWith<AiUnavailableException> { guard.check("composeRound") }
        assertEquals(3, spend.reads)
    }

    @Test
    fun `fallback alert fires only above five percent`() {
        val spend = Spend()
        val alerts = mutableListOf<String>()
        val guard = DailyAiSpendGuard(AiBudgetProperties(), spend, { Instant.parse("2026-10-14T12:00:00Z") }, alerts::add)

        spend.rate = AiFallbackRate(20, 1)
        guard.alertOnFallbackRate()
        assertTrue(alerts.isEmpty())

        spend.rate = AiFallbackRate(19, 1)
        guard.alertOnFallbackRate()
        assertEquals(1, alerts.size)
        assertTrue(alerts.single().contains("1/19"))
    }
}
