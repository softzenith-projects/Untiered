package com.interviewos.api.interview

/**
 * What the server checks in the interviewer's next line before the candidate hears it
 * (interviewer design review, step 2).
 *
 * Pure, so every rule is tested without a model, a database or a round — and so the replay
 * harness runs the same functions the server does. Which rules actually *change* a turn is
 * the caller's decision, from [InterviewerRulesProperties]; this only says which ones fire.
 */
object TurnGuards {
    /** A rule that can reject the next line, and how the ledger names it. */
    enum class Rule(
        /** The `interview_events.event_type` written when it fires. */
        val event: String,
        /** The `interview_events.reason` code, also used on `planned_fallback_used`. */
        val reason: String,
    ) {
        /** The model gave no next question at all, on a turn that is not the last. */
        NO_QUESTION("planned_fallback_used", "no_question"),

        /** The line announces the end of the interview before the end. */
        WRAP_UP("wrap_up_blocked", "wrap_up"),

        /** Longer than the spoken limit. */
        OVER_LENGTH("question_over_limit", "over_length"),

        /** The same question as one already asked in this session. */
        REPEAT("duplicate_blocked", "repeat"),
        ;

        fun enabledIn(rules: InterviewerRulesProperties): Boolean =
            when (this) {
                NO_QUESTION -> rules.plannedFallback
                WRAP_UP -> rules.wrapUpGuard
                OVER_LENGTH -> rules.lengthGuard
                REPEAT -> rules.repeatGuard
            }
    }

    /** The next line, as the turn would deliver it, and what the server knows about where it came from. */
    data class NextLine(
        /** What the candidate would hear, or null when the model gave nothing. */
        val text: String?,
        /** True when [text] asks the round's planned question. */
        val asksPlanned: Boolean = false,
        /** The planned question's stored wording, when there is one. */
        val plannedText: String? = null,
    ) {
        /**
         * Exactly the stored question, with nothing of the model's in it. Stored questions are
         * already excluded by id within a round, and their length is the bank's, not the
         * model's: none of the rules below judge them.
         */
        val isStoredQuestion: Boolean
            get() = asksPlanned && text != null && plannedText != null && text.trim() == plannedText.trim()
    }

    /** What the server knows about the turn the line belongs to. */
    data class TurnFacts(
        /** The briefing turn, where the server itself asks for a few sentences before the question. */
        val briefing: Boolean = false,
        /** Questions already asked in this session, oldest first. The last one is the question just answered. */
        val askedSoFar: List<String> = emptyList(),
        /**
         * The model may ask the question just answered once more, in other words: the candidate
         * was redirected, given a hint or guided, and the previous turn was not already a re-ask.
         */
        val reAskAllowed: Boolean = false,
    )

    /** Every rule the line breaks, in the order they are listed in [Rule]. */
    fun violations(
        line: NextLine,
        facts: TurnFacts,
        rules: InterviewerRulesProperties,
    ): List<Rule> {
        val text = line.text?.trim()
        if (text.isNullOrEmpty()) return listOf(Rule.NO_QUESTION)
        if (line.isStoredQuestion) return emptyList()
        return buildList {
            if (isWrapUp(text, rules.wrapUpPhrases)) add(Rule.WRAP_UP)
            if (!facts.briefing && text.length > rules.maxQuestionChars) add(Rule.OVER_LENGTH)
            if (!line.asksPlanned && isRepeat(text, facts.askedSoFar, facts.reAskAllowed, rules.repeatThreshold)) add(Rule.REPEAT)
        }
    }

    fun isWrapUp(
        text: String,
        phrases: List<String>,
    ): Boolean {
        val said = text.lowercase().replace('’', '\'')
        return phrases.any { it.isNotBlank() && it.lowercase().replace('’', '\'') in said }
    }

    /**
     * Whether [text] asks a question already asked in this session.
     *
     * Against every earlier question, a similarity at or over [threshold] is a repeat. Against the
     * question just answered, when a re-ask is allowed, only the same words are: the model may ask
     * it again, but in different words.
     */
    fun isRepeat(
        text: String,
        askedSoFar: List<String>,
        reAskAllowed: Boolean,
        threshold: Double,
    ): Boolean {
        if (askedSoFar.isEmpty()) return false
        val current = askedSoFar.last()
        val earlier = askedSoFar.dropLast(1)
        if (earlier.any { similarity(text, it) >= threshold }) return true
        return if (reAskAllowed) normalise(text) == normalise(current) else similarity(text, current) >= threshold
    }

    /**
     * How alike two questions are, from 0 to 1: one minus the word-level edit distance over the
     * longer one's length, taken on the whole line and on its last sentence alone, whichever is
     * higher. The second catches the same question behind a different lead-in. It counts only when
     * both last sentences are a real question's length: "Why?" ends a great many different questions.
     */
    fun similarity(
        a: String,
        b: String,
    ): Double {
        val whole = ratio(words(a), words(b))
        val lastA = words(lastSentence(a))
        val lastB = words(lastSentence(b))
        if (lastA.size < MIN_SENTENCE_WORDS || lastB.size < MIN_SENTENCE_WORDS) return whole
        return maxOf(whole, ratio(lastA, lastB))
    }

    private const val MIN_SENTENCE_WORDS = 4

    /** Whether the question just answered was itself a re-ask of the one before it. */
    fun wasReAsk(
        askedSoFar: List<String>,
        threshold: Double,
    ): Boolean = askedSoFar.size >= 2 && similarity(askedSoFar[askedSoFar.size - 1], askedSoFar[askedSoFar.size - 2]) >= threshold

    internal fun normalise(text: String): String =
        text
            .lowercase()
            .replace('’', '\'')
            .replace(NON_WORD, " ")
            .trim()

    private fun words(text: String): List<String> = normalise(text).split(' ').filter { it.isNotEmpty() }

    private fun lastSentence(text: String): String =
        text
            .trim()
            .split(SENTENCE_BREAK)
            .lastOrNull { it.isNotBlank() }
            ?: text

    private fun ratio(
        a: List<String>,
        b: List<String>,
    ): Double {
        val longest = maxOf(a.size, b.size)
        if (longest == 0) return 1.0
        return 1.0 - editDistance(a, b).toDouble() / longest
    }

    private fun editDistance(
        a: List<String>,
        b: List<String>,
    ): Int {
        var previous = IntArray(b.size + 1) { it }
        for (i in 1..a.size) {
            val row = IntArray(b.size + 1)
            row[0] = i
            for (j in 1..b.size) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                row[j] = minOf(previous[j] + 1, row[j - 1] + 1, previous[j - 1] + cost)
            }
            previous = row
        }
        return previous[b.size]
    }

    private val NON_WORD = Regex("[^\\p{L}\\p{N}']+")
    private val SENTENCE_BREAK = Regex("(?<=[.!?])\\s+")
}
