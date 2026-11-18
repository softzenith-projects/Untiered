package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.AnswerTiming
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class IntegrityRulesTest {
    @Test
    fun `a student's rounds add up, window switches being tab and blur together`() {
        val totals =
            IntegrityRules.totals(
                listOf(
                    IntegrityCounts(tabHidden = 2, windowBlur = 1, pastes = 1, pastedChars = 50) to TimingSignals(1, 0, 5),
                    IntegrityCounts(tabHidden = 0, windowBlur = 3, pastes = 0, pastedChars = 0) to TimingSignals(0, 2, 4),
                ),
            )

        assertEquals(StudentIntegrityTotals(rounds = 2, windowSwitches = 6, tabHidden = 2, windowBlur = 4, pastes = 1, fastAnswers = 1, longPauses = 2), totals)
        assertEquals(StudentIntegrityTotals(0, 0, 0, 0, 0, 0, 0), IntegrityRules.totals(emptyList()))
    }

    private fun event(
        type: String,
        chars: Int? = null,
        surface: String? = null,
    ) = IntegrityEventInput(type = type, at = "2026-11-13T10:00:00Z", turnIndex = 0, surface = surface, chars = chars)

    private fun timing(
        firstSoundMs: Long?,
        speakingMs: Long,
        longestPauseMs: Long = 0,
        pauseCount: Int = if (longestPauseMs > 0) 1 else 0,
    ) = AnswerTiming(
        recordedMs = 120_000,
        firstSoundMs = firstSoundMs,
        speakingMs = speakingMs,
        pauseCount = pauseCount,
        longestPauseMs = longestPauseMs,
        totalPauseMs = longestPauseMs,
    )

    // -- tally and caps -------------------------------------------------------------------

    @Test
    fun `a batch is counted by type and the pasted characters are summed`() {
        val tally =
            IntegrityRules.tally(
                IntegrityEventBatch(
                    listOf(
                        event("tab_hidden"),
                        event("tab_hidden"),
                        event("window_blur"),
                        event("paste", chars = 120, surface = "code"),
                        event("paste", chars = 30, surface = "text"),
                        event("paste"),
                    ),
                ),
            )
        assertEquals(IntegrityIncrements(tabHidden = 2, windowBlur = 1, pastes = 3, pastedChars = 150), tally)
    }

    @Test
    fun `more than 50 events, an unknown type, a bad surface or a negative count is refused`() {
        val bad =
            listOf(
                IntegrityEventBatch(List(51) { event("tab_hidden") }),
                IntegrityEventBatch(listOf(event("screenshot"))),
                IntegrityEventBatch(listOf(IntegrityEventInput(type = null))),
                IntegrityEventBatch(listOf(event("paste", surface = "clipboard"))),
                IntegrityEventBatch(listOf(event("paste", chars = -1))),
                IntegrityEventBatch(listOf(IntegrityEventInput(type = "tab_hidden", turnIndex = -1))),
                IntegrityEventBatch(null),
                null,
            )
        for (batch in bad) {
            val error = assertThrows<ApiException> { IntegrityRules.tally(batch) }
            assertEquals("invalid_integrity_events", error.code)
        }
        assertEquals(50, IntegrityRules.tally(IntegrityEventBatch(List(50) { event("window_blur") })).windowBlur)
        assertTrue(IntegrityRules.tally(IntegrityEventBatch(emptyList())).isEmpty)
    }

    @Test
    fun `one huge paste counts as the session cap, not more`() {
        val tally = IntegrityRules.tally(IntegrityEventBatch(listOf(event("paste", chars = Int.MAX_VALUE), event("paste", chars = 50_000))))
        assertEquals(IntegrityRules.PASTED_CHARS_CAP, tally.pastedChars)
    }

    @Test
    fun `counters stop at their caps when a batch is added`() {
        val near = IntegrityCounts(tabHidden = 9_990, windowBlur = 10_000, pastes = 3, pastedChars = 99_900)
        val after = IntegrityRules.apply(near, IntegrityIncrements(tabHidden = 50, windowBlur = 1, pastes = 2, pastedChars = 500))
        assertEquals(IntegrityCounts(tabHidden = 10_000, windowBlur = 10_000, pastes = 5, pastedChars = 100_000), after)
        assertEquals(10_000, IntegrityRules.COUNTER_CAP)
        assertEquals(100_000, IntegrityRules.PASTED_CHARS_CAP)
    }

    // -- timing thresholds ------------------------------------------------------------------

    @Test
    fun `a fast answer starts within one second and then runs for at least twenty`() {
        assertTrue(IntegrityRules.isFastAnswer(timing(firstSoundMs = 1_000, speakingMs = 20_000)))
        assertTrue(IntegrityRules.isFastAnswer(timing(firstSoundMs = 0, speakingMs = 60_000)))
        assertFalse(IntegrityRules.isFastAnswer(timing(firstSoundMs = 1_001, speakingMs = 60_000)), "started after a second")
        assertFalse(IntegrityRules.isFastAnswer(timing(firstSoundMs = 200, speakingMs = 19_999)), "too short to count")
        assertFalse(IntegrityRules.isFastAnswer(timing(firstSoundMs = null, speakingMs = 0)), "nothing was heard")
    }

    @Test
    fun `a long pause is a longest silence of twenty seconds or more`() {
        assertTrue(IntegrityRules.hasLongPause(timing(firstSoundMs = 3_000, speakingMs = 60_000, longestPauseMs = 20_000)))
        assertFalse(IntegrityRules.hasLongPause(timing(firstSoundMs = 3_000, speakingMs = 60_000, longestPauseMs = 19_999)))
        assertFalse(IntegrityRules.hasLongPause(timing(firstSoundMs = 3_000, speakingMs = 60_000)))
    }

    @Test
    fun `timing signals count turns, not events`() {
        val signals =
            IntegrityRules.timingSignals(
                listOf(
                    timing(firstSoundMs = 300, speakingMs = 45_000, longestPauseMs = 25_000),
                    timing(firstSoundMs = 4_000, speakingMs = 45_000, longestPauseMs = 21_000),
                    timing(firstSoundMs = 4_000, speakingMs = 45_000),
                ),
            )
        assertEquals(TimingSignals(fastAnswers = 1, longPauses = 2, measuredTurns = 3), signals)
    }

    // -- notes -------------------------------------------------------------------------------

    @Test
    fun `notes are plain sentences built from the counts`() {
        val summary =
            IntegrityRules.summary(
                IntegrityCounts(tabHidden = 3, windowBlur = 1, pastes = 2, pastedChars = 1_240),
                TimingSignals(fastAnswers = 1, longPauses = 2, measuredTurns = 5),
            )
        assertTrue(summary.recorded)
        assertEquals(
            listOf(
                "Switched away from the interview tab 3 times.",
                "The interview window lost focus once.",
                "Pasted text twice, 1,240 characters in total.",
                "1 answer began within 1 second of recording and ran for 20 seconds or more.",
                "2 answers included a pause of 20 seconds or longer.",
            ),
            summary.notes,
        )
    }

    @Test
    fun `an all-zero summary says nothing was recorded, not that the round was clean`() {
        val summary = IntegrityRules.summary(IntegrityCounts.ZERO, TimingSignals(0, 0, measuredTurns = 4))
        assertEquals(
            listOf("Nothing was recorded: no tab switches, window focus changes, pastes, or answer timing patterns."),
            summary.notes,
        )
        assertFalse(summary.notes.any { it.contains("clean", ignoreCase = true) })
    }

    @Test
    fun `a round with no measured timing says so`() {
        val notes = IntegrityRules.notes(IntegrityCounts(1, 0, 0, 0), TimingSignals(0, 0, measuredTurns = 0))
        assertEquals(listOf("Switched away from the interview tab once.", "Answer timing was not measured for this round."), notes)
    }

    @Test
    fun `no note ever carries a judgement`() {
        val cases =
            listOf(
                IntegrityCounts.ZERO to TimingSignals(0, 0, 0),
                IntegrityCounts(1, 1, 1, 1) to TimingSignals(1, 1, 1),
                IntegrityCounts(10_000, 10_000, 10_000, 100_000) to TimingSignals(40, 40, 40),
                IntegrityCounts(2, 0, 0, 0) to TimingSignals(0, 0, 3),
            )
        for ((counts, timing) in cases) {
            for (note in IntegrityRules.notes(counts, timing)) {
                val lower = note.lowercase()
                for (word in JUDGEMENT_WORDS) {
                    assertFalse(Regex("\\b$word").containsMatchIn(lower), "\"$note\" contains the judgement \"$word\"")
                }
                assertTrue(note.endsWith("."), "\"$note\" is a sentence")
            }
        }
    }

    @Test
    fun `a round that was not assigned shows nothing`() {
        val none = IntegritySummary.NOT_RECORDED
        assertFalse(none.recorded)
        assertEquals(0, none.tabHidden + none.windowBlur + none.pastes + none.pastedChars + none.fastAnswers + none.longPauses)
        assertTrue(none.notes.isEmpty())
    }

    private companion object {
        val JUDGEMENT_WORDS =
            listOf(
                "suspicious",
                "suspect",
                "cheat",
                "dishonest",
                "violation",
                "flag",
                "risk",
                "concern",
                "clean",
                "integrity breach",
                "misconduct",
                "plagiar",
                "copied",
                "fraud",
                "likely",
                "probably",
                "unusual",
                "abnormal",
                "warning",
                "fail",
                "pass",
                "verdict",
            )
    }
}
