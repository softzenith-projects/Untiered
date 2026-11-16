package com.interviewos.api.ai

import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.jsonPath
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import kotlin.test.assertFailsWith

/**
 * What goes into a Gemini request's generation config (interviewer design review, step 3).
 * Each test checks the request body and then fails the call; no response is needed.
 */
class GeminiRequestSettingsTest {
    private val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    private val baseUrl = "https://gemini.example/v1beta"
    private val model = "gemini-3.1-flash-lite"

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
    private val round =
        RoundContext(
            phase = "warm-up",
            minutesElapsed = 0,
            minutesRemaining = 40,
            durationMinutes = 40,
            warmupInstruction = null,
            briefTheCandidate = false,
            mustConclude = false,
        )

    private fun gemini(
        builder: RestClient.Builder,
        thinkingLevel: String? = null,
        sendSamplingParams: Boolean = true,
    ) = GeminiInterviewAi(
        GeminiProperties(apiKey = "test-key", baseUrl = baseUrl, sendSamplingParams = sendSamplingParams),
        PromptLibrary(mapper),
        mapper,
        builder,
        model,
        inRoomThinkingLevel = thinkingLevel,
    )

    /** An in-room call: the opening question, the same settings as an answer assessment. */
    private fun inRoomCall(
        thinkingLevel: String? = null,
        sendSamplingParams: Boolean = true,
        vararg expectations: org.springframework.test.web.client.RequestMatcher,
    ) {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        var expect = server.expect(requestTo("$baseUrl/models/$model:generateContent"))
        expectations.forEach { expect = expect.andExpect(it) }
        expect.andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))

        assertFailsWith<AiUnavailableException> {
            gemini(builder, thinkingLevel, sendSamplingParams).composeOpeningQuestion(brief, round)
        }
        server.verify()
    }

    @Test
    fun `by default an in-room call sends today's budget and temperature`() {
        inRoomCall(
            expectations =
                arrayOf(
                    jsonPath("$.generationConfig.thinkingConfig.thinkingBudget").value(128),
                    jsonPath("$.generationConfig.thinkingConfig.thinkingLevel").doesNotExist(),
                    jsonPath("$.generationConfig.temperature").value(0.7),
                ),
        )
    }

    @Test
    fun `a thinking level replaces the budget, never joins it`() {
        inRoomCall(
            thinkingLevel = "minimal",
            expectations =
                arrayOf(
                    jsonPath("$.generationConfig.thinkingConfig.thinkingLevel").value("minimal"),
                    jsonPath("$.generationConfig.thinkingConfig.thinkingBudget").doesNotExist(),
                ),
        )
    }

    @Test
    fun `switching sampling parameters off sends no temperature, topP or topK`() {
        inRoomCall(
            sendSamplingParams = false,
            expectations =
                arrayOf(
                    jsonPath("$.generationConfig.temperature").doesNotExist(),
                    jsonPath("$.generationConfig.topP").doesNotExist(),
                    jsonPath("$.generationConfig.topK").doesNotExist(),
                    jsonPath("$.generationConfig.responseSchema").exists(),
                ),
        )
    }

    @Test
    fun `the report keeps unbounded thinking whatever the in-room level`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server
            .expect(requestTo("$baseUrl/models/$model:generateContent"))
            .andExpect(jsonPath("$.generationConfig.thinkingConfig").doesNotExist())
            .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE))

        assertFailsWith<AiUnavailableException> { gemini(builder, thinkingLevel = "minimal").composeReport(brief, emptyList()) }
        server.verify()
    }

    @Test
    fun `an unknown thinking level fails at startup, not on the first turn`() {
        assertFailsWith<IllegalArgumentException> { gemini(RestClient.builder(), thinkingLevel = "MINIMAL") }
        assertFailsWith<IllegalArgumentException> { gemini(RestClient.builder(), thinkingLevel = "none") }
    }
}
