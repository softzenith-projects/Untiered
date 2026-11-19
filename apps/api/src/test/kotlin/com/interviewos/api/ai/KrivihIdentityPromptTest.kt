package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule

/**
 * The interviewer is Krivih, an AI, and says so (owner, 19 Nov 2026). The opening prompt used to
 * tell the model to say "I'm one of the engineers on the team" — a human, at the real employer —
 * which is the failure CLAUDE.md names: a candidate who believes a person from the company is
 * listening has been lied to.
 */
class KrivihIdentityPromptTest {
    private val library = PromptLibrary(JsonMapper.builder().addModule(KotlinModule.Builder().build()).build())

    private val brief =
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
        )

    private fun round(variant: AssessmentVariant) =
        RoundContext(
            phase = "main round",
            minutesElapsed = 20,
            minutesRemaining = 20,
            durationMinutes = 40,
            warmupInstruction = null,
            briefTheCandidate = false,
            mustConclude = false,
            variant = variant,
        )

    @Test
    fun `the opening introduces Krivih as an AI and never as someone at the employer`() {
        val opening = library.openingQuestion(brief, round(AssessmentVariant.TURN)).replace("\r\n", "\n")

        assertThat(opening).contains("Krivih, an AI interviewer").contains("Hi, I'm Krivih, your AI interviewer today.")
        assertThat(opening).contains("Never present yourself as a person")
        assertThat(opening).doesNotContain("Do not introduce yourself by name")
        assertThat(opening).doesNotContain("You are a working engineer or manager")
        assertThat(opening).doesNotContain("{{company}}")
    }

    @Test
    fun `every assessment variant knows it is Krivih and answers who-are-you honestly`() {
        AssessmentVariant.entries.forEach { variant ->
            val prompt =
                library
                    .assessAnswer(brief, round(variant), priorTurns = emptyList(), currentQuestion = "Explain indexing.")
                    .replace("\r\n", "\n")

            assertThat(prompt)
                .describedAs(variant.name)
                .contains("You are **Krivih, an AI interviewer**")
                .contains("whether you are a person")
                .contains("do\nnot do it again")
        }
    }
}
