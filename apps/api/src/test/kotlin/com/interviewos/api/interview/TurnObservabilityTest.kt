package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** What the ledger records about every turn (design review, step 1). Nothing here changes a turn. */
class TurnObservabilityTest {
    private val scenario = TurnScenario()

    @Test
    fun `the decision names the model that served it and why it stopped`() {
        scenario.round()
        scenario.servingModel = "gemini-3.6-flash"
        scenario.modelReturns(nextQuestion = "What does a covering index save you?")

        scenario.submit()

        val decision = scenario.eventsOf("interviewer_decision").single()
        assertEquals("gemini-3.6-flash", decision.model)
        assertEquals("stop", decision.finishReason)
    }

    @Test
    fun `time from upload to the next question is on the response-ready event`() {
        scenario.round()
        scenario.modelReturns(nextQuestion = "What does a covering index save you?")

        scenario.submit()

        val ready = scenario.eventsOf("answer_response_ready").single()
        assertNotNull(ready.durationMs)
        assertTrue(ready.durationMs!! >= 0)
    }

    @Test
    fun `an answer the browser heard no sound in is counted, and still assessed`() {
        scenario.round()
        scenario.modelReturns(nextQuestion = "What does a covering index save you?")
        val silent =
            """{"recordedMs":9000,"firstSoundMs":null,"speakingMs":0,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}"""

        scenario.submit(timing = silent)

        assertEquals("browser_silent", scenario.eventsOf("no_speech_heard").single().reason)
        assertEquals(1, scenario.harness.insertedTurns().size)
    }

    @Test
    fun `an answer with speech in it is not counted as silent`() {
        scenario.round()
        scenario.modelReturns(nextQuestion = "What does a covering index save you?")
        val spoken =
            """{"recordedMs":9000,"firstSoundMs":400,"speakingMs":8000,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}"""

        scenario.submit(timing = spoken)

        assertTrue(scenario.eventsOf("no_speech_heard").isEmpty())
    }

    @Test
    fun `an over-long question that reaches the candidate is counted, not cut`() {
        scenario.round()
        val long =
            "So, thinking about everything you said about indexes and the write path, " +
                "how would you decide which of those indexes to drop first?"
        assertTrue(long.length > QuestionLength.MAX_CHARS)
        scenario.modelReturns(nextQuestion = long)

        scenario.submit()

        assertEquals(long, scenario.askedNext())
        // The length rule, off, also writes a shadow event; this is the one for what was spoken.
        val counted = scenario.eventsOf("question_over_limit").single { it.outcome == "ready" }
        assertEquals("model_written", counted.reason)
        assertEquals("ready", counted.outcome)
        assertEquals(scenario.turnIndex + 1, counted.turnIndex)
    }

    @Test
    fun `a question within the limit is not counted`() {
        scenario.round()
        scenario.modelReturns(nextQuestion = "What does a covering index save you?")

        scenario.submit()

        assertTrue(scenario.eventsOf("question_over_limit").isEmpty())
    }
}
