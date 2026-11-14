package com.interviewos.api.interview.replay

import com.interviewos.api.interview.EchoedAnswer
import com.interviewos.api.interview.InterviewerRulesProperties
import com.interviewos.api.interview.TurnGuards

/**
 * The rule set the replay runs, and what it must find in the synthetic fixtures.
 *
 * Today's rules come first ([TurnReplay.currentRules]). The design review's step-2 rules follow,
 * each run through the same [TurnGuards] and [EchoedAnswer] functions the server calls, as if
 * every flag were on: the report says which turns each rule would change.
 */
object TurnReplayRules {
    private val allOn =
        InterviewerRulesProperties(
            finalVariant = true,
            plannedFallback = true,
            wrapUpGuard = true,
            lengthGuard = true,
            repeatGuard = true,
            echoAllAnswers = true,
            audioHashGuard = true,
        )

    /** The model's proposed next line, judged as the server would judge it. */
    private fun violations(context: TurnReplay.Context): List<TurnGuards.Rule> {
        if (context.finalTurn) return emptyList()
        val asked = context.earlier.map { it.question } + context.turn.question
        val helped =
            context.suggestedAction in setOf("redirect", "hint", "guide") ||
                (context.intervention ?: "none") != "none"
        return TurnGuards.violations(
            TurnGuards.NextLine(context.modelNextQuestion),
            TurnGuards.TurnFacts(
                // The briefing is the first main-round question, after the last warm-up answer.
                briefing = context.turn.phase == "warmup" && context.nextAsked?.phase == "main",
                askedSoFar = asked,
                reAskAllowed = helped && !TurnGuards.wasReAsk(asked, allOn.repeatThreshold),
            ),
            allOn,
        )
    }

    private fun fires(rule: TurnGuards.Rule): (TurnReplay.Context) -> Boolean = { rule in violations(it) }

    val stepTwo: List<TurnReplay.Rule> =
        listOf(
            TurnReplay.Rule("wrap_up_guard", "wrap-up language in the model's line before the last turn") {
                fires(TurnGuards.Rule.WRAP_UP)(it)
            },
            TurnReplay.Rule("length_guard", "the model's line over the limit, outside the briefing") {
                fires(TurnGuards.Rule.OVER_LENGTH)(it)
            },
            TurnReplay.Rule("repeat_guard", "the model's line repeats a question already asked in the session") {
                fires(TurnGuards.Rule.REPEAT)(it)
            },
            TurnReplay.Rule("echo_any_answer", "the transcript copies any earlier answer, not only the previous one") {
                EchoedAnswer.matchOf(it.turn.transcript, it.earlier.map { t -> t.transcript }) != null
            },
            TurnReplay.Rule("audio_hash", "the upload is byte-identical to an earlier one in the session") { context ->
                val hash = context.turn.audioSha256
                hash != null && context.earlier.any { it.audioSha256 == hash }
            },
            TurnReplay.Rule("browser_silent", "the browser measured no speech in the recording (diagnostic)") {
                it.turn.firstSoundHeard == false
            },
        )

    val all: List<TurnReplay.Rule> = TurnReplay.currentRules + stepTwo

    private const val S = "synthetic-late-stall"

    val expectedOnFixtures: Map<String, List<String>> =
        mapOf(
            // Turn 8 returned null and turn 11 an empty string; turn 12 is the last answer.
            "filler" to listOf("$S:8", "$S:11"),
            // Turn 9 chose `conclude` with nine minutes left.
            "conclude_rewritten" to listOf("$S:9"),
            // Turn 7 copies turn 5, two answers back — today's check only looks one back.
            "echo_previous" to emptyList(),
            // The briefing after turn 2.
            "over_length_reached" to listOf("$S:2"),
            // Turn 9: "That's our final topic..." with nine minutes left.
            "wrap_up_guard" to listOf("$S:9"),
            // Only the briefing ran long, and the briefing is exempt.
            "length_guard" to emptyList(),
            // Turn 5 asked WHERE/HAVING straight back; turn 10 asked turn 4's question again.
            "repeat_guard" to listOf("$S:5", "$S:10"),
            "echo_any_answer" to listOf("$S:7"),
            // Turn 11's upload is turn 6's again.
            "audio_hash" to listOf("$S:11"),
            "browser_silent" to listOf("$S:9"),
        )
}
