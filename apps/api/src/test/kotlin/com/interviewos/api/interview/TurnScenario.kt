package com.interviewos.api.interview

import com.interviewos.api.ai.AiUsage
import com.interviewos.api.ai.AnswerAssessment
import com.interviewos.api.ai.AnswerAudio
import com.interviewos.api.pool.PoolQuestion
import org.mockito.BDDMockito.given
import java.time.Instant
import java.util.UUID

/**
 * One answer submitted mid-round, over [BankRoundHarness]: a session, the turn being answered,
 * the answers before it, and whatever the model returns. For the turn rules (design review,
 * steps 1 and 2), where every test needs the same round with one thing changed.
 */
class TurnScenario(
    rules: InterviewerRulesProperties = InterviewerRulesProperties(),
    val harness: BankRoundHarness = BankRoundHarness(interviewerRules = rules),
) {
    val candidate: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    val sessionId: UUID = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    /** The model this scenario's assessment is reported as coming from. */
    var servingModel = "gemini-3.1-flash-lite"
    var finishReason: String? = "stop"

    /**
     * A round of [durationMinutes], [minutesElapsed] in, with [earlier] answered and [current]
     * waiting for its answer. Six answers in by default, so the turn is in the main round and
     * past the briefing.
     */
    fun round(
        current: String = "How would you index a table that is mostly written to?",
        earlier: List<Pair<String, String>> = defaultEarlier,
        minutesElapsed: Long = 20,
        durationMinutes: Int = 40,
        roundType: RoundType = RoundType.TECHNICAL_FUNDAMENTALS,
        companyName: String = "Amazon",
        roleTitle: String = "SDE 2",
        focusTopic: String? = null,
        answeredBefore: Int = earlier.size,
    ) {
        val turnIndex = earlier.size
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = companyName,
                archetype = Archetype.GLOBAL_PRODUCT.dbValue,
                archetypeConfidence = Confidence.RECOGNISED.dbValue,
                roleTitle = roleTitle,
                roundType = roundType.dbValue,
                language = "english",
                status = "in_progress",
                startedAt = Instant.now().minusSeconds(minutesElapsed * 60),
                endedAt = null,
                consentVideo = false,
                durationMinutes = durationMinutes,
                focusTopic = focusTopic,
            ),
        )
        given(harness.repository.findTurn(sessionId, candidate, turnIndex)).willReturn(
            TurnRow(turnIndex = turnIndex, questionText = current, questionAudioPath = null, answerTranscript = null, answeredAt = null),
        )
        given(harness.repository.listTranscript(sessionId, candidate)).willReturn(
            earlier.mapIndexed { index, (question, answer) ->
                TurnRow(
                    turnIndex = index,
                    questionText = question,
                    questionAudioPath = null,
                    answerTranscript = answer,
                    answeredAt = Instant.now().minusSeconds(60L * (earlier.size - index)),
                    nextAction = "move_on",
                )
            } +
                TurnRow(
                    turnIndex = turnIndex,
                    questionText = current,
                    questionAudioPath = null,
                    answerTranscript = null,
                    answeredAt = null,
                ),
        )
        given(harness.repository.countAnsweredTurns(sessionId, candidate)).willReturn(answeredBefore)
        this.turnIndex = turnIndex
    }

    var turnIndex = 0
        private set

    fun modelReturns(
        nextQuestion: String?,
        transcript: String = "An index has to be updated on every insert, so writes get slower as indexes are added.",
        action: String = "move_on",
        intervention: String = "none",
        askedPlanned: Boolean? = false,
    ) {
        harness.assessmentUsage = AiUsage(servingModel, 0, 0, finishReason = finishReason)
        harness.assessment =
            AnswerAssessment(
                transcript = transcript,
                suggestedNextAction = action,
                intervention = intervention,
                nextQuestionText = nextQuestion,
                questionBasis = "Fundamentals rounds test depth.",
                questionProbes = "Depth.",
                questionAskedBecause = "You mentioned writes.",
                askedPlannedQuestion = askedPlanned,
            )
    }

    fun submit(
        endRound: Boolean = false,
        timing: String? = null,
        audio: ByteArray = byteArrayOf(1, 2, 3),
    ) = harness.service.submitAnswer(
        candidate,
        sessionId,
        turnIndex,
        AnswerAudio(audio, "audio/webm"),
        speaksLocally = true,
        endRound = endRound,
        timing = timing,
    )

    fun eventsOf(type: String): List<InterviewEvent> = harness.events.filter { it.type == type }

    /** The pool holds [texts] for this round, so the selector has planned questions to give. */
    fun poolHolds(
        vararg texts: String,
        roundType: RoundType = RoundType.TECHNICAL_FUNDAMENTALS,
    ): List<PoolQuestion> {
        given(harness.directory.resolve("Amazon")).willReturn(BankFixtures.amazon)
        val questions = texts.map { PoolFixtures.question(it, roundType = roundType) }
        harness.poolHolds(roundType, *questions.toTypedArray())
        return questions
    }

    /** How many times the model was asked to assess an answer. */
    fun assessments(): Int = harness.assessedRounds.size

    fun askedNext(): String = harness.insertedTurns().single().questionText

    companion object {
        val defaultEarlier =
            listOf(
                "Tell me about yourself." to "I am a backend engineer working mostly in Java.",
                "What have you built recently?" to "A payments reconciliation service.",
                "What do you work in day to day?" to "Spring Boot, Postgres and Kafka.",
                "What is a process?" to "A program in execution with its own memory.",
                "How is a thread different from a process?" to "Threads share their process's memory.",
                "When would one query need both WHERE and HAVING?" to "WHERE filters rows, HAVING filters groups.",
            )
    }
}
