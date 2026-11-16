package com.interviewos.api.interview

import com.interviewos.api.interview.TurnGuards.NextLine
import com.interviewos.api.interview.TurnGuards.Rule
import com.interviewos.api.interview.TurnGuards.TurnFacts
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** Each server rule on the interviewer's next line, on its own (design review, step 2). */
class TurnGuardsTest {
    private val rules = InterviewerRulesProperties()
    private val asked =
        listOf(
            "What is a process?",
            "How is a thread different from a process?",
            "When would one query need both WHERE and HAVING?",
        )

    private fun violations(
        text: String?,
        facts: TurnFacts = TurnFacts(askedSoFar = asked),
        asksPlanned: Boolean = false,
        plannedText: String? = null,
    ) = TurnGuards.violations(NextLine(text, asksPlanned, plannedText), facts, rules)

    // -- no question --------------------------------------------------------

    @Test
    fun `a missing or blank line is no question and nothing else`() {
        assertEquals(listOf(Rule.NO_QUESTION), violations(null))
        assertEquals(listOf(Rule.NO_QUESTION), violations("   "))
    }

    @Test
    fun `a fresh short question breaks no rule`() {
        assertEquals(emptyList(), violations("What makes an index slow down a write?"))
    }

    // -- wrap-up ------------------------------------------------------------

    @Test
    fun `wrap-up language is caught whatever its case or apostrophe`() {
        assertTrue(Rule.WRAP_UP in violations("That's our final topic. What is normalisation?"))
        assertTrue(Rule.WRAP_UP in violations("One LAST QUESTION: what is a deadlock?"))
        assertTrue(Rule.WRAP_UP in violations("We’ve covered a lot. What is a deadlock?"))
        assertTrue(Rule.WRAP_UP in violations("We have covered threads. What is a deadlock?"))
    }

    @Test
    fun `the phrase list is configuration`() {
        val custom = rules.copy(wrapUpPhrases = listOf("to wrap up"))
        val line = NextLine("To wrap up, what is a deadlock?")
        assertEquals(listOf(Rule.WRAP_UP), TurnGuards.violations(line, TurnFacts(askedSoFar = asked), custom))
        assertEquals(emptyList(), TurnGuards.violations(NextLine("Final topic: deadlocks?"), TurnFacts(), custom))
    }

    @Test
    fun `final as an ordinary word is not wrap-up`() {
        assertFalse(TurnGuards.isWrapUp("How does a final field behave across threads?", rules.wrapUpPhrases))
    }

    // -- length -------------------------------------------------------------

    @Test
    fun `over the limit is caught at one character over and not at the limit`() {
        val atLimit = "Q".repeat(QuestionLength.MAX_CHARS - 1) + "?"
        assertFalse(Rule.OVER_LENGTH in violations(atLimit))
        assertTrue(Rule.OVER_LENGTH in violations(atLimit + "x"))
    }

    @Test
    fun `the briefing turn may run long`() {
        val briefing = "For the next forty minutes we will cover operating systems and databases. Think out loud. What is a process?"
        val longer = "$briefing Take your time with it."
        assertTrue(longer.length > QuestionLength.MAX_CHARS)
        assertFalse(Rule.OVER_LENGTH in violations(longer, TurnFacts(briefing = true, askedSoFar = asked)))
    }

    @Test
    fun `a stored planned question is never judged, however long`() {
        val stored = "Tell me about a time you had to change a design late in a project. " + "What forced it, and what did it cost you?"
        val long = stored + " Take your time."
        assertEquals(emptyList(), violations(long, asksPlanned = true, plannedText = long))
    }

    @Test
    fun `a model lead-in in front of the planned question is judged`() {
        val planned = "What makes an index slow down a write?"
        val lead = "That's our final topic. $planned"
        assertEquals(listOf(Rule.WRAP_UP), violations(lead, asksPlanned = true, plannedText = planned))
    }

    // -- repeats ------------------------------------------------------------

    @Test
    fun `asking an earlier question again word for word is a repeat`() {
        assertTrue(Rule.REPEAT in violations("How is a thread different from a process?"))
    }

    @Test
    fun `punctuation and case do not hide a repeat`() {
        assertTrue(Rule.REPEAT in violations("how is a THREAD different from a process"))
    }

    @Test
    fun `the same question behind a new lead-in is a repeat`() {
        assertTrue(Rule.REPEAT in violations("Let's go back to basics for a moment. How is a thread different from a process?"))
    }

    @Test
    fun `a follow-up sharing the thread's words is not a repeat`() {
        assertFalse(Rule.REPEAT in violations("Which memory does a thread not share with its process?"))
        assertFalse(Rule.REPEAT in violations("Give me a query that needs HAVING but not WHERE."))
    }

    @Test
    fun `two different questions ending in the same short sentence are not repeats`() {
        assertTrue(TurnGuards.similarity("Would you pick Postgres here? Why?", "Would you shard the queue? Why?") < rules.repeatThreshold)
    }

    @Test
    fun `the question just answered may be re-asked once in other words when help was given`() {
        val facts = TurnFacts(askedSoFar = asked, reAskAllowed = true)
        assertFalse(Rule.REPEAT in violations("Take an orders table. When would one query need both WHERE and HAVING?", facts))
        assertTrue(Rule.REPEAT in violations("When would one query need both WHERE and HAVING?", facts))
    }

    @Test
    fun `without help the question just answered may not be asked again`() {
        assertTrue(Rule.REPEAT in violations("When would one query need both WHERE and HAVING?"))
    }

    @Test
    fun `an allowed re-ask still may not repeat an older question`() {
        val facts = TurnFacts(askedSoFar = asked, reAskAllowed = true)
        assertTrue(Rule.REPEAT in violations("What is a process?", facts))
    }

    @Test
    fun `a re-ask is spotted so the next turn may not re-ask again`() {
        assertTrue(TurnGuards.wasReAsk(asked + "When would one query need both WHERE and HAVING?", rules.repeatThreshold))
        assertFalse(TurnGuards.wasReAsk(asked, rules.repeatThreshold))
    }

    @Test
    fun `the threshold is configuration`() {
        val loose = rules.copy(repeatThreshold = 0.5)
        // Two substitutions and two extra words out of ten: 0.6.
        val line = NextLine("How is a coroutine different from a thread in practice?")
        assertEquals(listOf(Rule.REPEAT), TurnGuards.violations(line, TurnFacts(askedSoFar = asked), loose))
        assertEquals(emptyList(), TurnGuards.violations(line, TurnFacts(askedSoFar = asked), rules))
    }

    @Test
    fun `nothing asked yet means nothing to repeat`() {
        assertFalse(TurnGuards.isRepeat("What is a process?", emptyList(), reAskAllowed = false, threshold = 0.85))
    }

    @Test
    fun `every rule is reported, not just the first`() {
        val all = "x".repeat(QuestionLength.MAX_CHARS) + ". That's our final topic. How is a thread different from a process?"
        assertEquals(listOf(Rule.WRAP_UP, Rule.OVER_LENGTH, Rule.REPEAT), violations(all))
    }

    // -- echo and pace (2f) -------------------------------------------------

    private val longAnswer = "So an index is like a lookup table, it makes reads faster because the database does not scan every row."

    @Test
    fun `an echo of the previous answer and of an older one are told apart`() {
        assertEquals(EchoedAnswer.Match.PREVIOUS, EchoedAnswer.matchOf(longAnswer, listOf("Something else entirely here.", longAnswer)))
        assertEquals(EchoedAnswer.Match.EARLIER, EchoedAnswer.matchOf(longAnswer, listOf(longAnswer, "WHERE filters rows first.")))
        assertNull(EchoedAnswer.matchOf(longAnswer, listOf("WHERE filters rows first.", null)))
        assertNull(EchoedAnswer.matchOf(longAnswer, emptyList()))
    }

    @Test
    fun `pace outside the plausible range is named, never inside it`() {
        fun timing(speakingMs: Long) = AnswerTiming(speakingMs + 500, 200, speakingMs, 0, 0, 0)
        assertNull(AnswerPace.outOfRange("one two three four five six", timing(3_000)))
        assertEquals("too_fast", AnswerPace.outOfRange("word ".repeat(30), timing(2_000)))
        assertEquals("too_slow", AnswerPace.outOfRange("yes I think so", timing(60_000)))
        assertNull(AnswerPace.outOfRange("yes", timing(400)), "under a second of speech is not a pace")
        assertNull(AnswerPace.outOfRange("anything", null))
    }
}
