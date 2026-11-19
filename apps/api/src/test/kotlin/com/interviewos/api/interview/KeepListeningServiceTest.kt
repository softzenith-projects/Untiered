package com.interviewos.api.interview

import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Keep-listening through a real submitted answer (PRD 06, `interviewos.interviewer.turn-state`),
 * over the mocked database and model of [BankRoundHarness]. No live call.
 */
class KeepListeningServiceTest {
    private val on = InterviewerRulesProperties(finalVariant = true, turnState = true)
    private val requestId: UUID = UUID.fromString("176bd50a-e9a4-4df4-ad50-1c2f47a0c283")

    private fun TurnScenario.modelSays(
        turnState: String?,
        intent: String? = "answer",
        nextQuestion: String = "",
        transcript: String = "So basically when a thread, um, let me think",
    ) {
        harness.assessment =
            AnswerAssessment(
                transcript = transcript,
                suggestedNextAction = "follow_up",
                nextQuestionText = nextQuestion,
                turnState = turnState,
                candidateIntent = intent,
            )
    }

    private fun TurnScenario.submitAs(id: UUID = requestId) =
        harness.service.submitAnswer(candidate, sessionId, turnIndex, AnswerAudio(byteArrayOf(1, 2, 3), "audio/webm"), requestId = id)

    private fun TurnScenario.calls(method: String) = mockingDetails(harness.repository).invocations.count { it.method.name == method }

    @Test
    fun `off - a needs_time verdict is still recorded as the answer, exactly as before`() {
        val s = TurnScenario(InterviewerRulesProperties(finalVariant = true))
        s.round()
        s.modelSays("needs_time", nextQuestion = "What would you check first?")

        val response = s.submitAs()

        assertNull(response.keepListening)
        assertEquals("What would you check first?", response.nextTurn?.questionText)
        assertEquals(1, s.calls("recordAnswer"))
        assertEquals(0, s.calls("findKeepListening"))
        assertEquals(0, s.calls("turnMemory"))
        assertNull(s.harness.assessedRounds.single().turnCompletion)
        assertNull(s.harness.assessedRounds.single().answerKey)
        assertTrue(s.eventsOf("turn_keep_listening").isEmpty())
    }

    @Test
    fun `on, without the turn variant - nothing changes`() {
        val s = TurnScenario(InterviewerRulesProperties(turnState = true))
        s.round()
        s.modelSays("needs_time", nextQuestion = "What would you check first?")

        val response = s.submitAs()

        assertNull(response.keepListening)
        assertEquals(1, s.calls("recordAnswer"))
        assertNull(s.harness.assessedRounds.single().turnCompletion)
    }

    @Test
    fun `on - needs_time keeps listening and records nothing as answered`() {
        val s = TurnScenario(on)
        s.round()
        s.modelSays("needs_time")

        val response = s.submitAs()

        val keep = assertNotNull(response.keepListening)
        assertEquals("needs_time", keep.turnState)
        assertEquals(10_000, keep.waitMs)
        assertFalse(response.sessionComplete)
        assertNull(response.nextTurn)
        assertEquals(0, s.calls("recordAnswer"))
        assertEquals(0, s.calls("insertTurn"))
        assertEquals(0, s.calls("completeAnswerRequest"))
        assertEquals(1, s.calls("recordKeepListening"))
        // The claim is freed, so the rest of the answer can arrive as a new request.
        assertEquals(1, s.calls("releaseAnswerRequest"))
        val event = s.eventsOf("turn_keep_listening").single()
        assertEquals("applied", event.outcome)
        assertEquals("needs_time", event.reason)
        assertEquals(s.turnIndex, event.turnIndex)
        val context = assertNotNull(s.harness.assessedRounds.single().turnCompletion)
        assertEquals(0, context.waitsSoFar)
        assertTrue(context.mayWait)
    }

    @Test
    fun `on - cut_off waits the shorter time`() {
        val s = TurnScenario(on)
        s.round()
        s.modelSays("cut_off", transcript = "I'd split it into three parts: first the ingestion, second the")

        val keep = assertNotNull(s.submitAs().keepListening)

        assertEquals("cut_off", keep.turnState)
        assertEquals(5_000, keep.waitMs)
    }

    @Test
    fun `on - the waits come from the properties`() {
        val s = TurnScenario(on.copy(keepListeningCutOffMs = 1_234))
        s.round()
        s.modelSays("cut_off")

        assertEquals(1_234, s.submitAs().keepListening?.waitMs)
    }

    @Test
    fun `on - a complete verdict is answered as usual`() {
        val s = TurnScenario(on)
        s.round()
        s.modelSays("complete", nextQuestion = "What would you check first?", transcript = "I would add a B-tree index.")

        val response = s.submitAs()

        assertNull(response.keepListening)
        assertEquals("What would you check first?", response.nextTurn?.questionText)
        assertEquals(1, s.calls("recordAnswer"))
        assertEquals(0, s.calls("recordKeepListening"))
    }

    @Test
    fun `on - after two waits the next verdict is taken as the answer`() {
        val s = TurnScenario(on)
        s.round()
        given(s.harness.repository.findKeepListening(s.sessionId, s.candidate, s.turnIndex))
            .willReturn(KeepListeningRow(count = 2, requestId = UUID.randomUUID(), state = "needs_time"))
        s.modelSays("needs_time")

        val response = s.submitAs()

        assertNull(response.keepListening)
        assertNotNull(response.nextTurn)
        assertEquals(1, s.calls("recordAnswer"))
        assertEquals(0, s.calls("recordKeepListening"))
        assertEquals("fallback", s.eventsOf("turn_keep_listening").single().outcome)
        val context = assertNotNull(s.harness.assessedRounds.single().turnCompletion)
        assertEquals(2, context.waitsSoFar)
        assertFalse(context.mayWait)
    }

    @Test
    fun `on - one earlier wait still allows a second`() {
        val s = TurnScenario(on)
        s.round()
        given(s.harness.repository.findKeepListening(s.sessionId, s.candidate, s.turnIndex))
            .willReturn(KeepListeningRow(count = 1, requestId = UUID.randomUUID(), state = "cut_off"))
        s.modelSays("needs_time")

        assertNotNull(s.submitAs().keepListening)
        assertEquals(1, s.calls("recordKeepListening"))
    }

    @Test
    fun `on - a retry of the request told to keep listening gets the same answer and no model call`() {
        val s = TurnScenario(on)
        s.round()
        given(s.harness.repository.findKeepListening(s.sessionId, s.candidate, s.turnIndex))
            .willReturn(KeepListeningRow(count = 1, requestId = requestId, state = "cut_off"))

        val response = s.submitAs(requestId)

        assertEquals("cut_off", response.keepListening?.turnState)
        assertEquals(5_000, response.keepListening?.waitMs)
        assertEquals(0, s.assessments())
        assertEquals(0, s.calls("recordKeepListening"))
        assertEquals(0, s.calls("recordAnswer"))
    }

    @Test
    fun `on - a workspace round never keeps listening`() {
        val s = TurnScenario(on)
        s.round()
        val row = checkNotNull(s.harness.repository.findSession(s.sessionId, s.candidate))
        given(s.harness.repository.findSession(s.sessionId, s.candidate)).willReturn(row.copy(workspace = "{}"))
        s.modelSays("needs_time", nextQuestion = "What would you check first?")

        val response = s.submitAs()

        assertNull(response.keepListening)
        assertEquals(1, s.calls("recordAnswer"))
        assertEquals(0, s.calls("findKeepListening"))
    }

    @Test
    fun `on - a repeat request may ask the same question again`() {
        val current = "How would you index a table that is mostly written to?"
        val s = TurnScenario(on.copy(repeatGuard = true))
        s.round(current = current)
        s.modelSays("complete", intent = "repeat_request", nextQuestion = current, transcript = "Sorry, can you repeat the question?")

        assertEquals(current, s.submitAs().nextTurn?.questionText)
        assertTrue(s.eventsOf("duplicate_blocked").isEmpty())
    }

    @Test
    fun `on - the same repeat without the intent is still caught by the repeat guard`() {
        val current = "How would you index a table that is mostly written to?"
        val s = TurnScenario(on.copy(repeatGuard = true))
        s.round(current = current)
        s.modelSays("complete", intent = "answer", nextQuestion = current, transcript = "I would index the foreign keys.")

        s.submitAs()

        assertEquals("applied", s.eventsOf("duplicate_blocked").single().outcome)
    }

    @Test
    fun `on - a repeat request spends none of the follow-up budget`() {
        val s = TurnScenario(on)
        s.round()
        // The last two answers were both followed up, which spends the budget of two...
        given(s.harness.repository.listTranscript(s.sessionId, s.candidate)).willReturn(followedUpTwice(s.turnIndex))
        s.modelSays("complete", nextQuestion = "What would you check first?", transcript = "I would add an index.")

        s.submitAs()
        assertTrue(s.harness.assessedRounds.single().mustMoveOn)

        // ...unless one of them was the candidate asking to hear the question again.
        val t = TurnScenario(on)
        t.round()
        given(t.harness.repository.listTranscript(t.sessionId, t.candidate)).willReturn(followedUpTwice(t.turnIndex))
        given(t.harness.repository.turnMemory(t.sessionId, t.candidate))
            .willReturn(listOf(TurnMemory(turnIndex = t.turnIndex - 1, candidateIntent = "repeat_request", conceptsCovered = emptyList())))
        t.modelSays("complete", nextQuestion = "What would you check first?", transcript = "I would add an index.")

        t.submitAs()
        assertFalse(t.harness.assessedRounds.single().mustMoveOn)
    }

    @Test
    fun `answer key - the pool question's key and earlier concepts reach the model`() {
        val s = TurnScenario(InterviewerRulesProperties(finalVariant = true, answerKey = true))
        s.round()
        given(s.harness.repository.poolAnswerKey(s.sessionId, s.candidate, s.turnIndex))
            .willReturn(PoolAnswerKey(listOf("write amplification"), listOf("When would you not index?")))
        given(s.harness.repository.turnMemory(s.sessionId, s.candidate))
            .willReturn(listOf(TurnMemory(turnIndex = 3, candidateIntent = null, conceptsCovered = listOf("processes own memory"))))
        s.modelSays(null, intent = null, nextQuestion = "What would you check first?", transcript = "I would add an index.")

        val response = s.submitAs()

        val key = assertNotNull(s.harness.assessedRounds.single().answerKey)
        assertEquals(listOf("write amplification"), key.strongAnswerCovers)
        assertEquals(listOf("When would you not index?"), key.followUps)
        assertEquals(listOf("processes own memory"), key.alreadyDemonstrated)
        // The answer key alone never keeps listening.
        assertNull(s.harness.assessedRounds.single().turnCompletion)
        assertNull(response.keepListening)
    }

    private fun followedUpTwice(turnIndex: Int): List<TurnRow> =
        TurnScenario.defaultEarlier.mapIndexed { index, (question, answer) ->
            TurnRow(
                turnIndex = index,
                questionText = question,
                questionAudioPath = null,
                answerTranscript = answer,
                answeredAt = Instant.now().minusSeconds(60L * (turnIndex - index)),
                nextAction = if (index >= turnIndex - 2) "follow_up" else "move_on",
            )
        } + TurnRow(turnIndex = turnIndex, questionText = "Current?", questionAudioPath = null, answerTranscript = null, answeredAt = null)
}
