package com.interviewos.api.interview

import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.params.ParameterizedTest
import org.junit.jupiter.params.provider.CsvSource
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import java.util.UUID
import kotlin.test.assertEquals

/**
 * A paid round is charged by its length (owner, 4 November 2026): half a credit for
 * 30 minutes, one for 45 or 60.
 */
class RoundPricingServiceTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @ParameterizedTest
    @CsvSource("30, 1", "45, 2", "60, 2")
    fun `a paid round is charged by its length`(
        minutes: Int,
        halfCredits: Int,
    ) {
        // Free interviews used up, two credits held.
        given(harness.repository.countFreeRoundsStarted(candidate)).willReturn(3)
        given(harness.repository.halfCreditBalance(candidate)).willReturn(4)
        given(
            harness.repository.insertSession(
                candidate,
                "Amazon",
                Archetype.GLOBAL_PRODUCT,
                Confidence.RECOGNISED,
                "SDE 2",
                RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                "english",
                true,
                false,
                minutes,
                null,
            ),
        ).willReturn(sessionId)

        runCatching {
            harness.service.start(
                SupabaseIdentity(candidate, "candidate@example.test", null),
                StartSessionRequest(
                    companyName = "Amazon",
                    roleTitle = "SDE 2",
                    roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                    consentAudio = true,
                    durationMinutes = minutes,
                ),
            )
        }

        val charges =
            mockingDetails(harness.repository)
                .invocations
                .filter { it.method.name == "spendCredit" }
                .map { it.arguments[2] as Int }
        assertEquals(listOf(halfCredits), charges)
        assertEquals(0, mockingDetails(harness.repository).invocations.count { it.method.name == "recordPracticeUsage" })
    }
}
