package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.databind.ObjectMapper

/**
 * The two-variant assessment (design review, step 2a): what each prompt and schema allows.
 * No live call; this fills the real templates and reads the real schemas.
 */
class AssessmentVariantPromptTest {
    private val library = PromptLibrary(ObjectMapper())

    private fun prompt(
        variant: AssessmentVariant,
        phase: String = "main round",
        mustConclude: Boolean = false,
        briefTheCandidate: Boolean = false,
        minutesRemaining: Int = 9,
    ): String =
        library.assessAnswer(
            brief =
                InterviewBrief(
                    company = "Amazon",
                    archetype = "Global product company",
                    role = "SDE 2",
                    roundType = "Technical fundamentals.",
                    roundCovers = "- Operating systems",
                    language = "english",
                    candidateFunction = null,
                    candidateLevel = null,
                    targetLevel = null,
                    grounding = "General patterns.",
                    plannedQuestion = PlannedQuestion("What makes an index slow down a write?", "Amazon", askNow = false, reported = false),
                ),
            round =
                RoundContext(
                    phase = phase,
                    minutesElapsed = 60 - minutesRemaining,
                    minutesRemaining = minutesRemaining,
                    durationMinutes = 60,
                    warmupInstruction = null,
                    briefTheCandidate = briefTheCandidate,
                    mustConclude = mustConclude,
                    variant = variant,
                ),
            priorTurns = emptyList(),
            currentQuestion = "What is a deadlock?",
        )

    @Test
    fun `the legacy prompt is unchanged - clock, conclude and all`() {
        val legacy = prompt(AssessmentVariant.LEGACY, phase = "closing", minutesRemaining = 3)

        assertThat(legacy).contains("Remaining: 3")
        assertThat(legacy).contains("`conclude`")
        assertThat(legacy).contains("ask one last question")
    }

    @Test
    fun `the turn prompt has no clock, no conclude and no last question`() {
        for (phase in listOf("main round", "closing")) {
            val turn = prompt(AssessmentVariant.TURN, phase = phase, minutesRemaining = 3)

            assertThat(turn).doesNotContain("{{")
            assertThat(turn).doesNotContain("Elapsed")
            assertThat(turn).doesNotContain("Remaining")
            assertThat(turn).doesNotContain("minutes left")
            assertThat(turn).doesNotContain("conclude")
            assertThat(turn).doesNotContain("last question")
            // The rest of the prompt is the old one: the planned question and the 120-character rule are still there.
            assertThat(turn).contains("What makes an index slow down a write?")
            assertThat(turn).contains("hard limit of 120 characters")
        }
    }

    @Test
    fun `the briefing still tells the candidate how long the round has left`() {
        val briefing = prompt(AssessmentVariant.TURN, briefTheCandidate = true, minutesRemaining = 50)

        assertThat(briefing).contains("about 50 minutes left")
    }

    @Test
    fun `the final prompt asks for no next question`() {
        val final = prompt(AssessmentVariant.FINAL, mustConclude = true, minutesRemaining = 0)

        assertThat(final).doesNotContain("{{")
        assertThat(final).doesNotContain("nextQuestionText")
        assertThat(final).doesNotContain("questionProbes")
        assertThat(final).contains("last answer")
        assertThat(final).contains("Transcribe what you actually heard")
        assertThat(final).contains("`intervention`")
    }

    @Test
    fun `the turn schema forbids conclude and requires a next question`() {
        val schema = library.schema("assess-answer-turn")

        val actions =
            schema
                .path("properties")
                .path("suggestedNextAction")
                .path("enum")
                .toList()
                .map { it.asString() }
        assertThat(actions).doesNotContain("conclude").contains("move_on", "redirect", "hint", "guide")
        assertThat(schema.path("required").toList().map { it.asString() }).contains("nextQuestionText")
        assertThat(schema.path("properties").path("nextQuestionText").has("nullable")).isFalse()
    }

    @Test
    fun `the final schema has no next question at all`() {
        val schema = library.schema("assess-answer-final")

        assertThat(schema.path("properties").has("nextQuestionText")).isFalse()
        assertThat(schema.path("properties").has("questionBasis")).isFalse()
        assertThat(
            schema.path("required").toList().map { it.asString() },
        ).containsExactly("transcript", "suggestedNextAction", "intervention")
    }

    @Test
    fun `the legacy schema is untouched`() {
        val schema = library.schema("assess-answer")

        assertThat(
            schema
                .path("properties")
                .path("suggestedNextAction")
                .path("enum")
                .toList()
                .map { it.asString() },
        ).contains("conclude")
        assertThat(
            schema
                .path("properties")
                .path("nextQuestionText")
                .path("nullable")
                .asBoolean(),
        ).isTrue()
    }
}
