package com.interviewos.api.interview.replay

import com.interviewos.api.interview.EchoedAnswer
import com.interviewos.api.interview.QuestionLength
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.io.File
import java.time.Duration
import java.time.Instant

/**
 * Stored model outputs, fed back through the server's turn rules with no model call
 * (interviewer design review, evaluation layer 0).
 *
 * The input is one JSON file per session in the shape `replay/README.md` describes — the shape
 * the export SQL there produces, so a real export drops in where the synthetic fixtures are.
 * The output is, per rule, which turns it would have changed. It answers one question: which
 * of the failures in a recorded round would code alone have caught?
 */
object TurnReplay {
    data class Session(
        val sessionId: String,
        val roundType: String,
        val durationMinutes: Int,
        val enteredAt: Instant?,
        val turns: List<Turn>,
    )

    data class Turn(
        val turnIndex: Int,
        val phase: String,
        val question: String,
        val transcript: String?,
        /** The assessment as stored: what the model returned for this answer. */
        val assessment: JsonNode?,
        val answeredAt: Instant?,
        val speakingMs: Long?,
        val firstSoundHeard: Boolean?,
        val bankQuestionId: String?,
        val poolQuestionId: String?,
        val audioSha256: String?,
    )

    /** Everything a rule may look at for one answered turn. */
    data class Context(
        val session: Session,
        /** Index into [Session.turns] of the turn whose answer is being replayed. */
        val position: Int,
    ) {
        val turn: Turn get() = session.turns[position]
        val earlier: List<Turn> get() = session.turns.subList(0, position)

        /** What the candidate was asked next, as stored. Null on the last turn. */
        val nextAsked: Turn? get() = session.turns.getOrNull(position + 1)

        /** The round ended on this answer: there is no next turn. */
        val finalTurn: Boolean get() = nextAsked == null

        val modelNextQuestion: String?
            get() = assessment("nextQuestionText")

        val suggestedAction: String?
            get() = assessment("suggestedNextAction")

        val intervention: String?
            get() = assessment("intervention")

        /** Minutes left on the clock when this answer arrived, or null if the export has no times. */
        val minutesRemaining: Long?
            get() {
                val start = session.enteredAt ?: return null
                val at = turn.answeredAt ?: return null
                return session.durationMinutes - Duration.between(start, at).toMinutes()
            }

        private fun assessment(field: String): String? =
            turn.assessment
                ?.path(field)
                ?.takeIf { it.isString }
                ?.asString()
                ?.takeIf { it.isNotBlank() }
    }

    /** A server rule, asked whether it would have changed this turn. */
    data class Rule(
        val name: String,
        val description: String,
        val fires: (Context) -> Boolean,
    )

    /**
     * The rules as the server has them today — what already happens. Step 2 adds the new ones
     * (see [TurnReplayRules]).
     */
    val currentRules: List<Rule> =
        listOf(
            Rule("filler", "no next question from the model on a non-final turn; the generic filler is spoken") {
                !it.finalTurn && it.modelNextQuestion == null
            },
            Rule("conclude_rewritten", "the model chose `conclude` before the round was over; rewritten to move_on") {
                !it.finalTurn && it.suggestedAction == "conclude"
            },
            Rule("echo_previous", "the transcript repeats the previous answer word for word (today's echo check)") {
                EchoedAnswer.isEcho(it.turn.transcript, it.earlier.lastOrNull { t -> t.transcript != null }?.transcript)
            },
            Rule("over_length_reached", "the next question as asked was over ${QuestionLength.MAX_CHARS} characters") {
                (it.nextAsked?.question?.length ?: 0) > QuestionLength.MAX_CHARS
            },
        )

    data class RuleResult(
        val rule: Rule,
        /** "session:turnIndex" for every turn the rule fired on. */
        val turns: List<String>,
    )

    data class Report(
        val sessions: Int,
        val answeredTurns: Int,
        val results: List<RuleResult>,
    ) {
        fun render(): String =
            buildString {
                appendLine("Turn replay: $sessions session(s), $answeredTurns answered turn(s)")
                appendLine()
                val width = results.maxOfOrNull { it.rule.name.length } ?: 10
                for (result in results) {
                    val share =
                        if (answeredTurns == 0) "0.0" else "%.1f".format(100.0 * result.turns.size / answeredTurns)
                    appendLine("${result.rule.name.padEnd(width)}  ${result.turns.size.toString().padStart(4)}  ($share%)")
                    appendLine("${" ".repeat(width)}  ${result.rule.description}")
                    if (result.turns.isNotEmpty()) appendLine("${" ".repeat(width)}  turns: ${result.turns.joinToString(", ")}")
                }
            }
    }

    fun run(
        sessions: List<Session>,
        rules: List<Rule>,
    ): Report {
        val contexts =
            sessions.flatMap { session ->
                session.turns.indices
                    .filter { session.turns[it].transcript != null }
                    .map { Context(session, it) }
            }
        return Report(
            sessions = sessions.size,
            answeredTurns = contexts.size,
            results =
                rules.map { rule ->
                    RuleResult(rule, contexts.filter(rule.fires).map { "${it.session.sessionId}:${it.turn.turnIndex}" })
                },
        )
    }

    fun load(
        directory: File,
        mapper: ObjectMapper,
    ): List<Session> =
        directory
            .listFiles { file -> file.extension == "json" }
            .orEmpty()
            .sortedBy { it.name }
            .map { read(mapper.readTree(it)) }

    fun read(node: JsonNode): Session =
        Session(
            sessionId = node.path("sessionId").asString(),
            roundType = node.path("roundType").asString(),
            durationMinutes = node.path("durationMinutes").asInt(),
            enteredAt = text(node, "enteredAt")?.let(::instant),
            turns =
                node.path("turns").toList().map { turn ->
                    val timing = turn.path("timing")
                    Turn(
                        turnIndex = turn.path("turnIndex").asInt(),
                        phase = text(turn, "phase") ?: "main",
                        question = turn.path("question").asString(),
                        transcript = text(turn, "transcript"),
                        assessment = turn.path("assessment").takeIf { it.isObject },
                        answeredAt = text(turn, "answeredAt")?.let(::instant),
                        speakingMs = timing.path("speakingMs").takeIf { it.isNumber }?.asLong(),
                        firstSoundHeard = if (timing.isObject) timing.path("firstSoundMs").isNumber else null,
                        bankQuestionId = text(turn, "bankQuestionId"),
                        poolQuestionId = text(turn, "poolQuestionId"),
                        audioSha256 = text(turn, "audioSha256"),
                    )
                },
        )

    private fun text(
        node: JsonNode,
        field: String,
    ): String? =
        node
            .path(field)
            .takeIf { it.isString }
            ?.asString()
            ?.takeIf { it.isNotBlank() }

    /** Postgres' `json_build_object` writes `2026-11-12T10:15:00.123+00:00`, which [Instant.parse] accepts. */
    private fun instant(value: String): Instant =
        java.time.OffsetDateTime
            .parse(value)
            .toInstant()
}
