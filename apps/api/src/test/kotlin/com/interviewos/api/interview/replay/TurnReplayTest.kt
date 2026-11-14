package com.interviewos.api.interview.replay

import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import java.io.File

/**
 * Runs the turn replay and prints a per-rule summary.
 *
 * On the synthetic fixtures (the default) it also checks the counts, so the harness itself is
 * tested. Pointed at a real export it only reports:
 *
 * ```
 * REPLAY_DIR=/path/to/export ./gradlew test --tests '*TurnReplayTest*'
 * ```
 *
 * The summary is printed and written to `build/reports/turn-replay.txt`. An export holds
 * candidate transcripts: keep it outside the repository.
 */
class TurnReplayTest {
    private val mapper = JsonMapper.builder().build()

    private val exportDir: File? = System.getenv("REPLAY_DIR")?.takeIf { it.isNotBlank() }?.let(::File)

    private val directory: File =
        exportDir ?: File(checkNotNull(javaClass.getResource("/replay/fixtures")) { "replay fixtures missing" }.toURI())

    @Test
    fun `replays stored turns through the server rules`() {
        val sessions = TurnReplay.load(directory, mapper)
        val report = TurnReplay.run(sessions, TurnReplayRules.all)
        val rendered = report.render()
        println(rendered)
        File("build/reports").apply { mkdirs() }.resolve("turn-replay.txt").writeText(rendered)

        if (exportDir != null) return
        assertEquals(13, report.answeredTurns)
        assertEquals(TurnReplayRules.expectedOnFixtures, report.results.associate { it.rule.name to it.turns })
    }
}
