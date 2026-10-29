package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.ZoneId
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class UserAiSpendGuardTest {
    @Test
    fun `a candidate is blocked only after their own India-time daily cap`() {
        val user = UUID.randomUUID()
        val other = UUID.randomUUID()
        val costs = mapOf(user to 5_000_000L, other to 300_000L)
        val starts = mutableMapOf<UUID, Instant>()
        val spend =
            object : AiSpendReadModel {
                override fun spentSince(since: Instant): Long = 0

                override fun spentByUserSince(
                    userId: UUID,
                    since: Instant,
                ): Long {
                    starts[userId] = since
                    return costs.getValue(userId)
                }

                override fun fallbackRateSince(since: Instant): AiFallbackRate = AiFallbackRate(0, 0)
            }
        val guard =
            UserAiSpendGuard(
                AiBudgetProperties(),
                spend,
                ZoneId.of("Asia/Kolkata"),
            ) { Instant.parse("2026-10-14T19:00:00Z") }

        assertTrue(guard.reached(user))
        assertFalse(guard.reached(other))
        assertEquals(Instant.parse("2026-10-14T18:30:00Z"), starts[user])
    }

    @Test
    fun `zero cap leaves account spend unrestricted`() {
        val spend =
            object : AiSpendReadModel {
                override fun spentSince(since: Instant): Long = 0

                override fun spentByUserSince(
                    userId: UUID,
                    since: Instant,
                ): Long = error("ledger should not be queried")

                override fun fallbackRateSince(since: Instant): AiFallbackRate = AiFallbackRate(0, 0)
            }
        val guard = UserAiSpendGuard(AiBudgetProperties(perUserDailyCapMicroUsd = 0), spend, ZoneId.of("UTC"))
        assertFalse(guard.reached(UUID.randomUUID()))
    }
}
