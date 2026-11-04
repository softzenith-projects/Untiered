package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class EchoedAnswerTest {
    private val longAnswer =
        "Process means a complete program in execution, and a thread is a part of a process, " +
            "so a process is made up of various threads."

    @Test
    fun `a long answer repeated word for word is an echo`() {
        assertTrue(EchoedAnswer.isEcho(longAnswer, longAnswer))
    }

    @Test
    fun `case, punctuation and spacing do not hide an echo`() {
        assertTrue(EchoedAnswer.isEcho(longAnswer.uppercase().replace(",", ""), "  $longAnswer!  "))
    }

    @Test
    fun `a short answer may genuinely be given twice`() {
        assertFalse(EchoedAnswer.isEcho("I don't know.", "I don't know."))
    }

    @Test
    fun `different answers are not echoes`() {
        assertFalse(EchoedAnswer.isEcho(longAnswer, "$longAnswer They share the heap but each has its own stack."))
    }

    @Test
    fun `nothing to compare against is not an echo`() {
        assertFalse(EchoedAnswer.isEcho(longAnswer, null))
        assertFalse(EchoedAnswer.isEcho(null, longAnswer))
    }
}

/** The service end of it: an echoed answer is refused, and nothing about the round moves. */
class EchoedAnswerServiceTest {
    private val harness = BankRoundHarness()
    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val previousAnswer =
        "Every thread that is part of a process lives in the same memory allocated to that process, " +
            "so they share its heap and globals."

    @Test
    fun `an answer transcribed as a copy of the last one is refused and not recorded`() {
        givenRoundWithPreviousAnswer()
        harness.assessment = assessment(transcript = previousAnswer)

        val failure = assertFailsWith<ApiException> { submit() }

        assertEquals(EchoedAnswer.ERROR_CODE, failure.code)
        assertFalse(mockingDetails(harness.repository).invocations.any { it.method.name == "recordAnswer" })
        assertFalse(mockingDetails(harness.repository).invocations.any { it.method.name == "insertTurn" })
        verify(harness.repository, never()).markSessionStatus(sessionId, candidate, "completed")
        // The claim is handed back, so the candidate's next take is accepted as a new request.
        assertTrue(mockingDetails(harness.repository).invocations.any { it.method.name == "releaseAnswerRequest" })
    }

    @Test
    fun `an echo on the candidate's last answer still ends the round rather than asking again`() {
        givenRoundWithPreviousAnswer()
        harness.assessment = assessment(transcript = previousAnswer)
        given(harness.repository.markSessionStatus(sessionId, candidate, "completed")).willReturn(true)

        val response = submit(endRound = true)

        assertTrue(response.sessionComplete)
    }

    private fun submit(endRound: Boolean = false) =
        harness.service.submitAnswer(
            candidate,
            sessionId,
            2,
            AnswerAudio(byteArrayOf(1), "audio/webm"),
            speaksLocally = true,
            endRound = endRound,
        )

    private fun givenRoundWithPreviousAnswer() {
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Amazon",
                archetype = Archetype.GLOBAL_PRODUCT.dbValue,
                archetypeConfidence = Confidence.RECOGNISED.dbValue,
                roleTitle = "SDE 2",
                roundType = RoundType.TECHNICAL_FUNDAMENTALS.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = Instant.now().minusSeconds(600),
                endedAt = null,
                consentVideo = false,
                durationMinutes = 40,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, 2)).willReturn(
            TurnRow(
                turnIndex = 2,
                questionText = "How do threads share memory?",
                questionAudioPath = null,
                answerTranscript = null,
                answeredAt = null,
            ),
        )
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(
            listOf(
                TurnRow(
                    turnIndex = 1,
                    questionText = "What is the difference between a process and a thread?",
                    questionAudioPath = null,
                    answerTranscript = previousAnswer,
                    answeredAt = Instant.now().minusSeconds(60),
                ),
            ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(2)
    }

    private fun assessment(transcript: String) =
        AnswerAssessment(
            transcript = transcript,
            suggestedNextAction = "move_on",
            nextQuestionText = "What happened next?",
            questionBasis = "Technical follow-up.",
            questionProbes = "Depth.",
            questionAskedBecause = "The answer needs one detail.",
        )
}
