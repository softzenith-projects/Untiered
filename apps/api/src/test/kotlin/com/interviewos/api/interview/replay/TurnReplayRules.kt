package com.interviewos.api.interview.replay

/**
 * The rule set the replay runs, and what it must find in the synthetic fixtures.
 *
 * Kept apart from [TurnReplay] so each step that adds a server rule adds it here, with the
 * turns it is expected to catch in `synthetic-late-stall.json`.
 */
object TurnReplayRules {
    val all: List<TurnReplay.Rule> = TurnReplay.currentRules

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
        )
}
