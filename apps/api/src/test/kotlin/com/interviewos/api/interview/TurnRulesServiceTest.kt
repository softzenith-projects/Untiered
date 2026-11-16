package com.interviewos.api.interview

import com.interviewos.api.ai.AssessmentVariant
import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import java.security.MessageDigest
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The step-2 rules through a real submitted answer: each one off (the old behaviour, plus a
 * `shadow` event) and on (the line replaced, an `applied` event). Design review, step 2.
 */
class TurnRulesServiceTest {
    private val genericFiller = "Let's move to another part of this round. How would you approach it in practice?"
    private val plannedText = "What makes an index slow down a write?"

    private fun scenario(rules: InterviewerRulesProperties = InterviewerRulesProperties()) = TurnScenario(rules)

    private fun TurnScenario.event(type: String) = eventsOf(type).single()

    // -- 2b: the fallback ---------------------------------------------------

    @Test
    fun `off - a missing question is still the generic filler, and is counted`() {
        val s = scenario()
        s.round()
        s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = null)

        s.submit()

        assertEquals(genericFiller, s.askedNext())
        val fallback = s.event("planned_fallback_used")
        assertEquals("shadow", fallback.outcome)
        assertEquals("no_question", fallback.reason)
    }

    @Test
    fun `on - a missing question becomes the planned question, with its id`() {
        val s = scenario(InterviewerRulesProperties(plannedFallback = true))
        s.round()
        val pool = s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = null)

        s.submit()

        val asked = s.harness.insertedTurns().single()
        assertEquals(plannedText, asked.questionText)
        assertEquals(pool.single().id, asked.poolQuestionId)
        assertTrue(asked.provenance?.askedBecause != "You mentioned writes.", "the model's reasoning was about a question nobody asked")
        val fallback = s.event("planned_fallback_used")
        assertEquals("applied", fallback.outcome)
        assertEquals("no_question", fallback.reason)
    }

    @Test
    fun `on - with no stored question the filler is used and the event is the alert`() {
        val s = scenario(InterviewerRulesProperties(plannedFallback = true))
        // The pool is not written for this role, and the bank holds nothing.
        s.round(roleTitle = "Product Manager")
        s.modelReturns(nextQuestion = null)

        s.submit()

        assertEquals(genericFiller, s.askedNext())
        assertEquals("unavailable", s.event("planned_fallback_used").outcome)
    }

    @Test
    fun `on - a custom-topic round falls back to its own topic, not an alert`() {
        val s = scenario(InterviewerRulesProperties(plannedFallback = true))
        s.round(roundType = RoundType.CUSTOM_TOPIC, focusTopic = "Kubernetes")
        s.modelReturns(nextQuestion = null)

        s.submit()

        assertTrue("Kubernetes" in s.askedNext())
        assertEquals("applied", s.event("planned_fallback_used").outcome)
    }

    @Test
    fun `on - in the closing phase a planned question is looked up for the fallback`() {
        val s = scenario(InterviewerRulesProperties(plannedFallback = true))
        s.round(minutesElapsed = 37)
        s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = null)

        s.submit()

        assertEquals(plannedText, s.askedNext())
    }

    @Test
    fun `on - the warm-up never takes a main-round question as its fallback`() {
        val s = scenario(InterviewerRulesProperties(plannedFallback = true))
        // Only a project deep-dive warms up for several turns.
        s.round(earlier = TurnScenario.defaultEarlier.take(1), minutesElapsed = 2, roundType = RoundType.PROJECT_DEEP_DIVE)
        s.poolHolds(plannedText, roundType = RoundType.PROJECT_DEEP_DIVE)
        s.modelReturns(nextQuestion = null)

        s.submit()

        assertEquals(genericFiller, s.askedNext())
        assertEquals("unavailable", s.event("planned_fallback_used").outcome)
    }

    // -- 2c: wrap-up --------------------------------------------------------

    private val wrapUp = "That's our final topic. What is normalisation in databases?"

    @Test
    fun `off - wrap-up language reaches the candidate and is counted`() {
        val s = scenario()
        s.round()
        s.modelReturns(nextQuestion = wrapUp)

        s.submit()

        assertEquals(wrapUp, s.askedNext())
        assertEquals("shadow", s.event("wrap_up_blocked").outcome)
    }

    @Test
    fun `on - wrap-up language is replaced by the planned question`() {
        val s = scenario(InterviewerRulesProperties(wrapUpGuard = true, plannedFallback = true))
        s.round()
        s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = wrapUp)

        s.submit()

        assertEquals(plannedText, s.askedNext())
        assertEquals("applied", s.event("wrap_up_blocked").outcome)
        assertEquals("wrap_up", s.event("planned_fallback_used").reason)
    }

    // -- 2d: length ---------------------------------------------------------

    private val longQuestion =
        "Given everything you have said about indexes, replication lag and the write path, " +
            "how would you decide which of those indexes to drop first?"

    @Test
    fun `off - an over-long question is kept and counted`() {
        val s = scenario()
        s.round()
        s.modelReturns(nextQuestion = longQuestion)

        s.submit()

        assertEquals(longQuestion, s.askedNext())
        assertTrue(s.eventsOf("question_over_limit").any { it.outcome == "shadow" && it.reason == "over_length" })
    }

    @Test
    fun `on - an over-long question is replaced`() {
        val s = scenario(InterviewerRulesProperties(lengthGuard = true))
        s.round()
        s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = longQuestion)

        s.submit()

        assertEquals(plannedText, s.askedNext())
    }

    @Test
    fun `on - the briefing turn may run long`() {
        val s = scenario(InterviewerRulesProperties(lengthGuard = true))
        // A fundamentals round warms up for one turn: answering it is what the briefing follows.
        s.round(current = "Tell me about yourself.", earlier = emptyList(), minutesElapsed = 2)
        s.modelReturns(nextQuestion = longQuestion)

        s.submit()

        assertEquals(longQuestion, s.askedNext())
        assertTrue(s.eventsOf("question_over_limit").none { it.reason == "over_length" })
    }

    // -- 2e: repeats --------------------------------------------------------

    @Test
    fun `off - a repeated question reaches the candidate and is counted`() {
        val s = scenario()
        s.round()
        s.modelReturns(nextQuestion = "How is a thread different from a process?")

        s.submit()

        assertEquals("How is a thread different from a process?", s.askedNext())
        assertEquals("shadow", s.event("duplicate_blocked").outcome)
    }

    @Test
    fun `on - a repeated question is replaced without asking the model again`() {
        val s = scenario(InterviewerRulesProperties(repeatGuard = true))
        s.round()
        s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = "How is a thread different from a process?")

        s.submit()

        assertEquals(plannedText, s.askedNext())
        assertEquals(1, s.assessments())
        assertEquals("applied", s.event("duplicate_blocked").outcome)
    }

    @Test
    fun `on - a redirect may re-ask the question in other words`() {
        val s = scenario(InterviewerRulesProperties(repeatGuard = true))
        s.round(current = "When would one query need both WHERE and HAVING?", earlier = TurnScenario.defaultEarlier.take(5))
        val reworded = "Take an orders table. What goes in WHERE and what in HAVING?"
        s.modelReturns(nextQuestion = reworded, action = "redirect", intervention = "redirected")

        s.submit()

        assertEquals(reworded, s.askedNext())
        assertTrue(s.eventsOf("duplicate_blocked").isEmpty())
    }

    @Test
    fun `on - a redirect may not re-ask in the same words`() {
        val s = scenario(InterviewerRulesProperties(repeatGuard = true))
        s.round(current = "When would one query need both WHERE and HAVING?", earlier = TurnScenario.defaultEarlier.take(5))
        s.poolHolds(plannedText)
        s.modelReturns(nextQuestion = "When would one query need both WHERE and HAVING?", action = "redirect", intervention = "redirected")

        s.submit()

        assertEquals(plannedText, s.askedNext())
    }

    // -- 2f: echoes ---------------------------------------------------------

    private val copied =
        "So an index is like a lookup table, it makes reads faster because the database does not scan every row of the table."

    private fun TurnScenario.roundWithAnOlderAnswer() =
        round(
            earlier =
                TurnScenario.defaultEarlier.take(4) +
                    listOf(
                        "When would one query need both WHERE and HAVING?" to copied,
                        "What does a covering index save you?" to "It saves going back to the table for the row.",
                    ),
        )

    @Test
    fun `off - a copy of an older answer is accepted and counted`() {
        val s = scenario()
        s.roundWithAnOlderAnswer()
        s.modelReturns(nextQuestion = plannedText, transcript = copied)

        s.submit()

        val echo = s.event("echo_detected")
        assertEquals("shadow", echo.outcome)
        assertEquals("earlier_answer", echo.reason)
        assertEquals(1, s.harness.insertedTurns().size)
    }

    @Test
    fun `on - a copy of an older answer is refused`() {
        val s = scenario(InterviewerRulesProperties(echoAllAnswers = true))
        s.roundWithAnOlderAnswer()
        s.modelReturns(nextQuestion = plannedText, transcript = copied)

        val failure = assertFailsWith<ApiException> { s.submit() }

        assertEquals(EchoedAnswer.ERROR_CODE, failure.code)
        assertEquals("applied", s.event("echo_detected").outcome)
        assertTrue(s.harness.insertedTurns().isEmpty())
    }

    @Test
    fun `off - a copy of the previous answer is refused, as it always was`() {
        val s = scenario()
        val previous = "WHERE filters the rows before grouping, and HAVING filters the groups after aggregation."
        s.round(earlier = TurnScenario.defaultEarlier.dropLast(1) + ("When would one query need both WHERE and HAVING?" to previous))
        s.modelReturns(nextQuestion = plannedText, transcript = previous)

        assertFailsWith<ApiException> { s.submit() }

        val echo = s.event("echo_detected")
        assertEquals("previous_answer", echo.reason)
        assertEquals("applied", echo.outcome)
    }

    private fun sha256(bytes: ByteArray) = MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

    @Test
    fun `off - a resent recording is assessed and counted`() {
        val s = scenario()
        s.round()
        s.modelReturns(nextQuestion = plannedText)
        val audio = byteArrayOf(9, 9, 9)
        given(s.harness.repository.answerAudioHashes(s.sessionId, s.candidate)).willReturn(setOf(sha256(audio)))

        s.submit(audio = audio)

        assertEquals("shadow", s.event("echo_detected").outcome)
        assertEquals(1, s.assessments())
    }

    @Test
    fun `on - a resent recording is refused before the model is called`() {
        val s = scenario(InterviewerRulesProperties(audioHashGuard = true))
        s.round()
        s.modelReturns(nextQuestion = plannedText)
        val audio = byteArrayOf(9, 9, 9)
        given(s.harness.repository.answerAudioHashes(s.sessionId, s.candidate)).willReturn(setOf(sha256(audio)))

        val failure = assertFailsWith<ApiException> { s.submit(audio = audio) }

        assertEquals(EchoedAnswer.ERROR_CODE, failure.code)
        assertEquals("audio_hash", s.event("echo_detected").reason)
        assertEquals(0, s.assessments())
    }

    @Test
    fun `a new recording passes the hash check`() {
        val s = scenario(InterviewerRulesProperties(audioHashGuard = true))
        s.round()
        s.modelReturns(nextQuestion = plannedText)
        given(s.harness.repository.answerAudioHashes(s.sessionId, s.candidate)).willReturn(setOf(sha256(byteArrayOf(1))))

        s.submit(audio = byteArrayOf(2))

        assertTrue(s.eventsOf("echo_detected").isEmpty())
    }

    // -- 2a: the two variants -----------------------------------------------

    @Test
    fun `off - every turn uses the one legacy shape`() {
        val s = scenario()
        s.round()
        s.modelReturns(nextQuestion = plannedText)

        s.submit(endRound = true)

        assertEquals(
            AssessmentVariant.LEGACY,
            s.harness.assessedRounds
                .single()
                .variant,
        )
    }

    @Test
    fun `on - a turn that continues asks for the turn shape`() {
        val s = scenario(InterviewerRulesProperties(finalVariant = true))
        s.round()
        s.modelReturns(nextQuestion = plannedText)

        s.submit()

        assertEquals(
            AssessmentVariant.TURN,
            s.harness.assessedRounds
                .single()
                .variant,
        )
    }

    @Test
    fun `on - the candidate ending the round asks for the final shape and ends it`() {
        val s = scenario(InterviewerRulesProperties(finalVariant = true))
        s.round()
        s.modelReturns(nextQuestion = null, action = "conclude")

        val response = s.submit(endRound = true)

        assertEquals(
            AssessmentVariant.FINAL,
            s.harness.assessedRounds
                .single()
                .variant,
        )
        assertTrue(response.sessionComplete)
        assertTrue(s.eventsOf("planned_fallback_used").isEmpty(), "the last turn has no next line to judge")
    }

    @Test
    fun `on - the clock running out asks for the final shape`() {
        val s = scenario(InterviewerRulesProperties(finalVariant = true))
        s.round(minutesElapsed = 40)
        s.modelReturns(nextQuestion = null, action = "conclude")

        s.submit()

        assertEquals(
            AssessmentVariant.FINAL,
            s.harness.assessedRounds
                .single()
                .variant,
        )
    }
}
