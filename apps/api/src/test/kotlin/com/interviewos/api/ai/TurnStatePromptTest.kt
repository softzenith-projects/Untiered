package com.interviewos.api.ai

import org.assertj.core.api.Assertions.assertThat
import org.junit.jupiter.api.Test
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Turn state, intent and the answer key in the turn prompt and schema (PRD 06). No live call:
 * this fills the real templates and reads the real schemas.
 */
class TurnStatePromptTest {
    private val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    private val library = PromptLibrary(mapper)

    private fun round(
        variant: AssessmentVariant = AssessmentVariant.TURN,
        turnCompletion: TurnCompletionContext? = null,
        answerKey: AnswerKey? = null,
    ) = RoundContext(
        phase = "main round",
        minutesElapsed = 20,
        minutesRemaining = 20,
        durationMinutes = 40,
        warmupInstruction = null,
        briefTheCandidate = false,
        mustConclude = false,
        variant = variant,
        turnCompletion = turnCompletion,
        answerKey = answerKey,
    )

    private fun prompt(round: RoundContext): String =
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
                ),
            round = round,
            priorTurns = listOf(TurnTranscript("What is a process?", "A program in execution.")),
            currentQuestion = "Explain indexing.",
            // A Windows checkout has CRLF templates; CI has LF.
        ).replace("\r\n", "\n")

    @Test
    fun `with both flags off the turn prompt and schema are exactly what they were`() {
        val off = prompt(round())

        assertThat(off).doesNotContain("had they finished").doesNotContain("turnState").doesNotContain("conceptsCovered")
        assertThat(off).contains("A: A program in execution.\n\n## The ground this round has to cover")
        assertEquals(library.schema("assess-answer-turn"), library.assessmentSchema(round()))
    }

    @Test
    fun `the turn-completion section carries the protocol and the interview examples`() {
        val on = prompt(round(turnCompletion = TurnCompletionContext(waitsSoFar = 0, mayWait = true)))

        assertThat(on).doesNotContain("{{")
        assertThat(on).contains("## First: had they finished?")
        assertThat(on).contains("*conversationally* complete, not long")
        assertThat(on).contains("`cut_off`", "`needs_time`", "`repeat_request`", "`self_correction`", "`asks_question`")
        assertThat(on).contains("let me think", "give me a second", "O(n) -> O(log n)", "horizontal or vertical")
        assertThat(on).contains("Set\n`nextQuestionText` to an empty string")
        assertThat(on).contains("This is the first time the recording has stopped on this question.")
        // After the conversation, before the round's ground: the rest of the prompt is untouched.
        assertThat(on.indexOf("## First: had they finished?"))
            .isGreaterThan(on.indexOf("Conversation so far:"))
            .isLessThan(on.indexOf("## The ground this round has to cover"))
    }

    @Test
    fun `the wait note says when the room will not wait again`() {
        val once = prompt(round(turnCompletion = TurnCompletionContext(waitsSoFar = 1, mayWait = true)))
        val atCap = prompt(round(turnCompletion = TurnCompletionContext(waitsSoFar = 2, mayWait = false)))

        assertThat(once).contains("You have already waited once on this question.")
        assertThat(atCap).contains("You have already waited 2 times").contains("Do not wait again")
    }

    @Test
    fun `the final and legacy variants never carry the new sections or fields`() {
        val context = TurnCompletionContext(0, true)
        val key = AnswerKey(strongAnswerCovers = listOf("B-tree lookups"))
        for (variant in listOf(AssessmentVariant.FINAL, AssessmentVariant.LEGACY)) {
            val round = round(variant = variant, turnCompletion = context, answerKey = key)

            assertThat(prompt(round)).doesNotContain("had they finished").doesNotContain("B-tree lookups")
            assertEquals(library.schema(variant.resource), library.assessmentSchema(round))
        }
    }

    @Test
    fun `the turn-state schema requires the verdict and still allows an empty next line`() {
        val schema = library.assessmentSchema(round(turnCompletion = TurnCompletionContext(0, true)))
        val properties = schema.path("properties")

        assertThat(properties.path("turnState").path("enum").toList().map { it.asString() })
            .containsExactly("complete", "cut_off", "needs_time")
        assertThat(properties.path("candidateIntent").path("enum").toList().map { it.asString() }).contains(
            "answer",
            "confirmation",
            "clarification",
            "repeat_request",
            "hint_request",
            "asks_question",
            "self_correction",
            "off_topic",
        )
        assertThat(properties.path("selfCorrection").path("nullable").asBoolean()).isTrue()
        assertThat(schema.path("required").toList().map { it.asString() })
            .contains("transcript", "suggestedNextAction", "intervention", "nextQuestionText", "turnState", "candidateIntent")
        // "" is a valid next line on a keep-listening turn: no minimum length was added.
        assertThat(properties.path("nextQuestionText").has("minLength")).isFalse()
        assertEquals(120, properties.path("nextQuestionText").path("maxLength").asInt())
        assertThat(properties.has("conceptsCovered")).isFalse()
    }

    @Test
    fun `the answer key renders the pool question's covers, follow-ups and what is already shown`() {
        val key =
            AnswerKey(
                strongAnswerCovers = listOf("B-tree lookups in log time", "write amplification"),
                followUps = listOf("When would you not index a column?"),
                alreadyDemonstrated = listOf("processes vs threads", " ", "processes vs threads"),
            )
        val on = prompt(round(answerKey = key))

        assertThat(on).doesNotContain("{{")
        assertThat(on).contains("## What a strong answer to the question just asked covers")
        assertThat(on).contains("- B-tree lookups in log time\n- write amplification")
        assertThat(on).contains("Follow-ups prepared for it, to use when they fit:\n- When would you not index a column?")
        assertThat(on).contains("Already demonstrated earlier in this round:\n- processes vs threads\n\n")
        assertThat(on).contains("never present it as something\nAmazon expects")
        assertThat(on).contains("Never ask again about anything already demonstrated.")

        val schema = library.assessmentSchema(round(answerKey = key))
        assertThat(schema.path("properties").path("conceptsCovered").path("type").asString()).isEqualTo("ARRAY")
        assertThat(schema.path("properties").has("turnState")).isFalse()
    }

    @Test
    fun `with no pool question the answer key says so instead of inventing one`() {
        val on = prompt(round(answerKey = AnswerKey()))

        assertThat(on).contains("(nothing recorded for this question: judge it on your own knowledge of the topic)")
        assertThat(on).contains("Already demonstrated earlier in this round:\n(nothing recorded yet)")
        assertThat(on).doesNotContain("Follow-ups prepared")
    }

    @Test
    fun `turn state and intent parse leniently, and absent means complete answer`() {
        assertEquals(TurnState.COMPLETE, TurnState.parse(null))
        assertEquals(TurnState.COMPLETE, TurnState.parse("finished"))
        assertEquals(TurnState.CUT_OFF, TurnState.parse(" Cut_Off "))
        assertEquals(TurnState.NEEDS_TIME, TurnState.parse("needs_time"))
        assertEquals(CandidateIntent.ANSWER, CandidateIntent.parse(null))
        assertEquals(CandidateIntent.ANSWER, CandidateIntent.parse("small_talk"))
        assertEquals(CandidateIntent.REPEAT_REQUEST, CandidateIntent.parse("repeat_request"))
        assertThat(CandidateIntent.entries.filter { it.reAsksTheQuestion })
            .containsExactlyInAnyOrder(CandidateIntent.CLARIFICATION, CandidateIntent.REPEAT_REQUEST, CandidateIntent.ASKS_QUESTION)
    }

    @Test
    fun `an assessment stored before these fields still parses, and a new one stores none of them when absent`() {
        val old = """{"transcript":"An answer.","suggestedNextAction":"move_on","intervention":"none","nextQuestionText":"Next?"}"""
        val parsed = mapper.readValue(old, AnswerAssessment::class.java)

        assertNull(parsed.turnState)
        assertNull(parsed.conceptsCovered)
        val written = mapper.writeValueAsString(parsed)
        assertThat(written).doesNotContain("turnState", "candidateIntent", "selfCorrection", "conceptsCovered", "conceptsMissing")
    }

    @Test
    fun `a keep-listening verdict parses with an empty next line`() {
        val json =
            """{"transcript":"So basically when a thread, um, let me think","suggestedNextAction":"follow_up",""" +
                """"intervention":"none","nextQuestionText":"","turnState":"needs_time","candidateIntent":"answer",""" +
                """"conceptsCovered":["threads share memory"]}"""
        val parsed = mapper.readValue(json, AnswerAssessment::class.java)

        assertEquals(TurnState.NEEDS_TIME, TurnState.parse(parsed.turnState))
        assertEquals("", parsed.nextQuestionText)
        assertEquals(listOf("threads share memory"), parsed.conceptsCovered)
        assertThat(mapper.writeValueAsString(parsed)).contains("\"turnState\":\"needs_time\"")
    }
}
