package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.AnswerTiming
import java.util.Locale

// Interview integrity signals (campus spec §5, contract "Module 5"): the wire shapes and the
// rules, with no I/O, so every number and every sentence a college reads about a student can
// be checked by a unit test.
//
// A signal is a count. Nothing here decides what a count means: a tab hidden three times may
// be a phone call, a paste may be the student's own notes, a fast answer may be a well-prepared
// one. The notes say what was counted, in plain sentences, and stop there.

/** One event the browser saw in an assigned round. Only the type and the paste length are kept. */
data class IntegrityEventInput(
    val type: String? = null,
    /** When the browser saw it. Accepted for the contract's shape; only the count is stored. */
    val at: String? = null,
    val turnIndex: Int? = null,
    /** Where a paste landed: `code` (the editor) or `text` (a typed answer field). */
    val surface: String? = null,
    /** How many characters were pasted. Never the text itself. */
    val chars: Int? = null,
)

data class IntegrityEventBatch(
    val events: List<IntegrityEventInput>? = null,
)

/** What staff and the student both read, exactly the same for each (contract `IntegritySummary`). */
data class IntegritySummary(
    /** False for a round that was not assigned: nothing was watched, so there is nothing to show. */
    val recorded: Boolean,
    val tabHidden: Int,
    val windowBlur: Int,
    val pastes: Int,
    val pastedChars: Int,
    val fastAnswers: Int,
    val longPauses: Int,
    val notes: List<String>,
) {
    companion object {
        /** A personal round, or one read while the campus switch is off. */
        val NOT_RECORDED = IntegritySummary(false, 0, 0, 0, 0, 0, 0, emptyList())
    }
}

/** How much one batch adds to a session's counters, already clamped to the caps. */
data class IntegrityIncrements(
    val tabHidden: Int,
    val windowBlur: Int,
    val pastes: Int,
    val pastedChars: Int,
) {
    val isEmpty: Boolean get() = tabHidden == 0 && windowBlur == 0 && pastes == 0 && pastedChars == 0
}

/** A session's stored counters. */
data class IntegrityCounts(
    val tabHidden: Int,
    val windowBlur: Int,
    val pastes: Int,
    val pastedChars: Int,
) {
    companion object {
        val ZERO = IntegrityCounts(0, 0, 0, 0)
    }
}

/** The answer-timing signals, worked out from `session_turns.answer_timing`. */
data class TimingSignals(
    val fastAnswers: Int,
    val longPauses: Int,
    /** Turns whose timing was measured at all; zero means the browser sent none. */
    val measuredTurns: Int,
)

object IntegrityRules {
    /** At most this many events in one request (contract). */
    const val MAX_EVENTS_PER_REQUEST = 50

    /** No counter grows past this per session (contract). The table's checks say the same. */
    const val COUNTER_CAP = 10_000

    /** Pasted characters per session are capped here (contract). */
    const val PASTED_CHARS_CAP = 100_000

    /**
     * A "fast answer": speech was heard within this long of the microphone opening…
     *
     * One second is quicker than people normally begin a considered spoken answer, and is
     * the same span the browser treats as the gap between words ([AnswerTiming.PAUSE_MS]).
     */
    const val FAST_START_MS = 1_000L

    /**
     * …and then ran for at least this long. A short answer that starts at once ("Yes, I
     * have") is ordinary; a long one that starts at once is what this counts.
     */
    const val FAST_MIN_SPEAKING_MS = 20_000L

    /** A "long pause": the longest silence inside one answer was at least this long. */
    const val LONG_PAUSE_MS = 20_000L

    val EVENT_TYPES = setOf("tab_hidden", "window_blur", "paste")
    private val SURFACES = setOf("code", "text")

    /**
     * Validates a batch and adds it up. A batch that cannot be what the room sends is
     * `400 invalid_integrity_events`; one paste larger than the session cap counts as the cap.
     */
    fun tally(batch: IntegrityEventBatch?): IntegrityIncrements {
        val events = batch?.events ?: throw invalid("events is required.")
        if (events.size > MAX_EVENTS_PER_REQUEST) {
            throw invalid("Send at most $MAX_EVENTS_PER_REQUEST events at a time.")
        }
        var tabHidden = 0
        var windowBlur = 0
        var pastes = 0
        var pastedChars = 0L
        for (event in events) {
            if (event.type !in EVENT_TYPES) throw invalid("Unknown integrity event type.")
            if (event.surface != null && event.surface !in SURFACES) throw invalid("Unknown paste surface.")
            if (event.turnIndex != null && event.turnIndex < 0) throw invalid("turnIndex must not be negative.")
            if (event.chars != null && event.chars < 0) throw invalid("chars must not be negative.")
            when (event.type) {
                "tab_hidden" -> {
                    tabHidden++
                }

                "window_blur" -> {
                    windowBlur++
                }

                "paste" -> {
                    pastes++
                    pastedChars += (event.chars ?: 0).coerceAtMost(PASTED_CHARS_CAP)
                }
            }
        }
        return IntegrityIncrements(
            tabHidden = tabHidden,
            windowBlur = windowBlur,
            pastes = pastes,
            pastedChars = pastedChars.coerceAtMost(PASTED_CHARS_CAP.toLong()).toInt(),
        )
    }

    /** Adds [increments] to [current] the way the database does: each counter stops at its cap. */
    fun apply(
        current: IntegrityCounts,
        increments: IntegrityIncrements,
    ): IntegrityCounts =
        IntegrityCounts(
            tabHidden = capped(current.tabHidden, increments.tabHidden, COUNTER_CAP),
            windowBlur = capped(current.windowBlur, increments.windowBlur, COUNTER_CAP),
            pastes = capped(current.pastes, increments.pastes, COUNTER_CAP),
            pastedChars = capped(current.pastedChars, increments.pastedChars, PASTED_CHARS_CAP),
        )

    /** Whether one answer began within [FAST_START_MS] and then ran for [FAST_MIN_SPEAKING_MS] or more. */
    fun isFastAnswer(timing: AnswerTiming): Boolean {
        val firstSound = timing.firstSoundMs ?: return false
        return firstSound <= FAST_START_MS && timing.speakingMs >= FAST_MIN_SPEAKING_MS
    }

    /** Whether one answer's longest pause was [LONG_PAUSE_MS] or more. */
    fun hasLongPause(timing: AnswerTiming): Boolean = timing.longestPauseMs >= LONG_PAUSE_MS

    fun timingSignals(timings: List<AnswerTiming>): TimingSignals =
        TimingSignals(
            fastAnswers = timings.count(::isFastAnswer),
            longPauses = timings.count(::hasLongPause),
            measuredTurns = timings.size,
        )

    /** The summary of an assigned round. */
    fun summary(
        counts: IntegrityCounts,
        timing: TimingSignals,
    ): IntegritySummary =
        IntegritySummary(
            recorded = true,
            tabHidden = counts.tabHidden,
            windowBlur = counts.windowBlur,
            pastes = counts.pastes,
            pastedChars = counts.pastedChars,
            fastAnswers = timing.fastAnswers,
            longPauses = timing.longPauses,
            notes = notes(counts, timing),
        )

    /**
     * Plain sentences, built only from the numbers. Each says what was counted and how many
     * times — never what it suggests. When nothing was counted, the note says so: a round with
     * no signals is a round where nothing was recorded, not a round that was "clean".
     */
    fun notes(
        counts: IntegrityCounts,
        timing: TimingSignals,
    ): List<String> {
        val notes = mutableListOf<String>()
        if (counts.tabHidden > 0) {
            notes += "Switched away from the interview tab ${times(counts.tabHidden)}."
        }
        if (counts.windowBlur > 0) {
            notes += "The interview window lost focus ${times(counts.windowBlur)}."
        }
        if (counts.pastes > 0) {
            notes += "Pasted text ${times(counts.pastes)}, ${characters(counts.pastedChars)} in total."
        }
        if (timing.fastAnswers > 0) {
            val subject = if (timing.fastAnswers == 1) "1 answer" else "${timing.fastAnswers} answers"
            notes += "$subject began within 1 second of recording and ran for 20 seconds or more."
        }
        if (timing.longPauses > 0) {
            val subject = if (timing.longPauses == 1) "1 answer" else "${timing.longPauses} answers"
            notes += "$subject included a pause of 20 seconds or longer."
        }
        if (notes.isEmpty()) {
            notes += "Nothing was recorded: no tab switches, window focus changes, pastes, or answer timing patterns."
        }
        if (timing.measuredTurns == 0) {
            notes += "Answer timing was not measured for this round."
        }
        return notes
    }

    private fun times(count: Int): String =
        when (count) {
            1 -> "once"
            2 -> "twice"
            else -> "$count times"
        }

    private fun characters(count: Int): String = if (count == 1) "1 character" else "${String.format(Locale.ROOT, "%,d", count)} characters"

    private fun capped(
        current: Int,
        add: Int,
        cap: Int,
    ): Int = (current.toLong() + add).coerceAtMost(cap.toLong()).toInt()

    private fun invalid(message: String) = ApiException.badRequest(message, code = "invalid_integrity_events")
}
