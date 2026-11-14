package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * A bank that runs out mid-round (design review, step 2b). Off, the round goes on with no
 * planned question, as before; on, the pool continues it, labelled as general knowledge.
 */
class BankPoolFallthroughTest {
    private val reported = BankFixtures.question("What is virtual memory for?", roundType = RoundType.TECHNICAL_FUNDAMENTALS)
    private val poolText = "What makes an index slow down a write?"

    private fun scenario(fallthrough: Boolean): TurnScenario {
        val s = TurnScenario(InterviewerRulesProperties(plannedFallback = true, bankPoolFallthrough = fallthrough))
        s.round()
        s.harness.bankHolds(RoundType.TECHNICAL_FUNDAMENTALS, reported)
        // The bank's one question has already been asked in this round.
        given(s.harness.repository.askedBankQuestions(s.candidate, s.sessionId))
            .willReturn(listOf(AskedBankQuestion(reported.id, Instant.now().minusSeconds(300), inThisRound = true)))
        s.poolHolds(poolText)
        s.modelReturns(nextQuestion = null)
        return s
    }

    @Test
    fun `off - a spent bank leaves the round with no planned question`() {
        val s = scenario(fallthrough = false)

        s.submit()

        val asked = s.harness.insertedTurns().single()
        assertNull(asked.poolQuestionId)
        assertNull(asked.bankQuestionId)
        assertEquals("unavailable", s.eventsOf("planned_fallback_used").single().outcome)
    }

    @Test
    fun `on - a spent bank hands over to the pool, labelled as general knowledge`() {
        val s = scenario(fallthrough = true)

        s.submit()

        val asked = s.harness.insertedTurns().single()
        assertEquals(poolText, asked.questionText)
        assertEquals(PoolFixtures.question(poolText, roundType = RoundType.TECHNICAL_FUNDAMENTALS).id, asked.poolQuestionId)
        assertNull(asked.bankQuestionId)
        assertEquals(ProvenanceTier.MODEL_KNOWLEDGE, asked.provenance?.tier)
    }

    @Test
    fun `the note no longer claims every main question was sourced`() {
        val note =
            GroundingNote.forRound("Amazon", Archetype.GLOBAL_PRODUCT, Confidence.RECOGNISED, RoundType.TECHNICAL_FUNDAMENTALS, 4, false)

        assertTrue(note.contains("start with the 4 questions reported for Amazon's"), note)
        assertTrue(note.contains("written from general patterns and are not cited"), note)
        assertTrue("come from" !in note, note)
    }
}
