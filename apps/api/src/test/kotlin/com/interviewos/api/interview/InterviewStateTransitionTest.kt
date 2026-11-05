package com.interviewos.api.interview

import com.interviewos.api.ai.AiUnavailableException
import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.springframework.dao.DuplicateKeyException
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse

class InterviewStateTransitionTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `a lost answer-write race cannot create a next turn`() {
        val requestId = UUID.fromString("176bd50a-e9a4-4df4-ad50-1c2f47a0c283")
        givenRunningTurn()
        harness.assessment = assessment(nextQuestion = "What happened next?")
        given(
            harness.repository.recordAnswer(
                sessionId,
                candidate,
                2,
                "An answer.",
                null,
                harness.mapper.writeValueAsString(harness.assessment),
                "move_on",
                "none",
                null,
                null,
                requestId,
            ),
        ).willReturn(false)

        val failure =
            assertFailsWith<ApiException> {
                harness.service.submitAnswer(
                    candidate,
                    sessionId,
                    2,
                    AnswerAudio(byteArrayOf(1), "audio/webm"),
                    speaksLocally = true,
                    requestId = requestId,
                )
            }

        assertEquals("session_state_changed", failure.code)
        assertFalse(mockingDetails(harness.repository).invocations.any { it.method.name == "insertTurn" })
        verify(harness.repository, never()).markSessionStatus(sessionId, candidate, "completed")
    }

    @Test
    fun `provider failure marks the round failed and refunds its daily allowance`() {
        givenRunningTurn()
        harness.onAiCall = { if (it == "assessAnswer") throw AiUnavailableException("provider unavailable") }

        assertFailsWith<ApiException> {
            harness.service.submitAnswer(
                candidate,
                sessionId,
                2,
                AnswerAudio(byteArrayOf(1), "audio/webm"),
                speaksLocally = true,
            )
        }

        verify(harness.repository).failSessionAndRefundUsage(sessionId, candidate)
    }

    @Test
    fun `an abandoned session cannot be changed to completed by an answer already in flight`() {
        givenRunningTurn()
        harness.assessment = assessment(nextQuestion = null)
        given(harness.repository.markSessionStatus(sessionId, candidate, "completed")).willReturn(false)

        val failure =
            assertFailsWith<ApiException> {
                harness.service.submitAnswer(
                    candidate,
                    sessionId,
                    2,
                    AnswerAudio(byteArrayOf(1), "audio/webm"),
                    speaksLocally = true,
                    endRound = true,
                )
            }

        assertEquals("session_state_changed", failure.code)
        assertFalse(mockingDetails(harness.repository).invocations.any { it.method.name == "insertTurn" })
    }

    @Test
    fun `finish checks whether its in-progress to completed transition won`() {
        givenRunningTurn()
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(1)
        given(harness.repository.markSessionStatus(sessionId, candidate, "completed")).willReturn(false)

        val failure = assertFailsWith<ApiException> { harness.service.finish(candidate, sessionId) }

        assertEquals("session_state_changed", failure.code)
    }

    @Test
    fun `abandon is idempotent for an already completed session`() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(session(status = "completed"))

        harness.service.abandon(candidate, sessionId)

        verify(harness.repository, never()).markSessionStatus(sessionId, candidate, "abandoned")
    }

    @Test
    fun `begin rejects a terminal session instead of returning the interview room`() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(session(status = "failed"))

        val failure = assertFailsWith<ApiException> { harness.service.begin(candidate, sessionId) }

        assertEquals("session_state_changed", failure.code)
        verify(harness.repository, never()).startClock(sessionId, candidate)
    }

    @Test
    fun `the database uniqueness gate turns a concurrent second start into a conflict`() {
        val request =
            StartSessionRequest(
                companyName = "Amazon",
                roleTitle = "SDE 2",
                roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                consentAudio = true,
            )
        willThrow(DuplicateKeyException("sessions_one_open_per_user_idx"))
            .given(harness.repository)
            .insertSession(
                candidate,
                "Amazon",
                Archetype.GLOBAL_PRODUCT,
                Confidence.RECOGNISED,
                "SDE 2",
                RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
                "english",
                true,
                false,
                45,
                null,
            )

        val failure =
            assertFailsWith<ApiException> {
                harness.service.start(SupabaseIdentity(candidate, "candidate@example.test", null), request)
            }

        assertEquals("session_in_progress", failure.code)
        assertFalse(mockingDetails(harness.ai).invocations.any())
    }

    @Test
    fun `entitlement names the open round so a client can always resume it`() {
        given(harness.repository.findOpenSessionId(candidate)).willReturn(sessionId)

        val view = harness.service.entitlement(candidate)

        assertFalse(view.allowed)
        assertEquals("session_in_progress", view.reason)
        assertEquals(sessionId, view.openSessionId)
    }

    @Test
    fun `entitlement carries no open round when none is open`() {
        val view = harness.service.entitlement(candidate)

        assertEquals("allowed", view.reason)
        assertEquals(null, view.openSessionId)
    }

    private fun givenRunningTurn() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(session(status = "in_progress"))
        given(harness.repository.findTurn(sessionId, candidate, 2)).willReturn(
            TurnRow(
                turnIndex = 2,
                questionText = "Tell me about the situation.",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(2)
    }

    private fun session(status: String) =
        SessionRow(
            id = sessionId,
            companyName = "Amazon",
            archetype = Archetype.GLOBAL_PRODUCT.dbValue,
            archetypeConfidence = Confidence.RECOGNISED.dbValue,
            roleTitle = "SDE 2",
            roundType = RoundType.BEHAVIOURAL_COMPETENCY.dbValue,
            language = "english",
            status = status,
            startedAt = Instant.now().minusSeconds(600),
            endedAt = null,
            consentVideo = false,
            durationMinutes = 40,
        )

    private fun assessment(nextQuestion: String?) =
        AnswerAssessment(
            transcript = "An answer.",
            suggestedNextAction = "move_on",
            nextQuestionText = nextQuestion,
            questionBasis = "Behavioural follow-up.",
            questionProbes = "Decision quality.",
            questionAskedBecause = "The answer needs one detail.",
        )
}
