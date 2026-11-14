package com.interviewos.api.interview

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * Server rules on what the interviewer says next (interviewer design review, step 2).
 *
 * **Every rule defaults to off, which is the behaviour before it existed.** While a rule is off
 * it still runs, and writes what it would have done to the interview ledger with outcome
 * `shadow` — so the owner can see how often each would fire on real rounds before turning it
 * on. Turned on, it writes outcome `applied`.
 *
 * ```yaml
 * interviewos:
 *   interviewer:
 *     final-variant: true
 *     planned-fallback: true
 * ```
 */
@ConfigurationProperties(prefix = "interviewos.interviewer")
data class InterviewerRulesProperties(
    /**
     * Two response shapes, chosen by the server before the call. On a turn that continues, the
     * schema has no `conclude` and requires a next question, and the prompt carries no clock.
     * On the last turn (time up, turn ceiling, or the candidate ending it) the schema has no
     * next question at all: the server already speaks the closing line.
     */
    val finalVariant: Boolean = false,
    /**
     * When the model's question is missing or a rule below rejects it, ask the round's planned
     * question instead of the generic "let's move to another part of this round". Where no
     * stored question fits (warm-up, a project deep-dive, a role the pool does not cover), the
     * generic question is still used and the event's outcome is `unavailable`, which is the alert.
     */
    val plannedFallback: Boolean = false,
    /** Outside the last turn, a question announcing the end ("final topic", "last question"...) is replaced. */
    val wrapUpGuard: Boolean = false,
    /** A model-written question over [maxQuestionChars] is replaced. The briefing turn is exempt. */
    val lengthGuard: Boolean = false,
    val maxQuestionChars: Int = QuestionLength.MAX_CHARS,
    /** A model-written question this close to one already asked in the session is replaced. */
    val repeatGuard: Boolean = false,
    /** Word-level similarity, 0 to 1, at or above which two questions are the same question. */
    val repeatThreshold: Double = 0.85,
    /** The echo check compares the transcript with every earlier answer, not only the last. */
    val echoAllAnswers: Boolean = false,
    /** An upload byte-identical to an earlier one in the session is refused before the model call. */
    val audioHashGuard: Boolean = false,
    /** Phrases that announce the end of the interview, matched case-insensitively. */
    val wrapUpPhrases: List<String> = DEFAULT_WRAP_UP_PHRASES,
) {
    companion object {
        val DEFAULT_WRAP_UP_PHRASES = listOf("final topic", "last question", "we've covered", "we have covered")
    }
}
