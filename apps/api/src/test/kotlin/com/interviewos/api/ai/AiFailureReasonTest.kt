package com.interviewos.api.ai

import com.interviewos.api.interview.InterviewEvent
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.web.client.RestClient
import tools.jackson.databind.json.JsonMapper
import tools.jackson.module.kotlin.KotlinModule
import java.io.File
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** What the interview ledger learns about a model call (design review, step 1). */
class AiFailureReasonTest {
    private val mapper = JsonMapper.builder().addModule(KotlinModule.Builder().build()).build()
    private val baseUrl = "https://gemini.example/v1beta"
    private val model = "reasoning-model"

    private fun gemini(builder: RestClient.Builder) =
        GeminiInterviewAi(GeminiProperties(apiKey = "test-key", baseUrl = baseUrl), PromptLibrary(mapper), mapper, builder, model)

    private fun respond(
        builder: RestClient.Builder,
        body: String,
        times: Int = 1,
    ): MockRestServiceServer {
        val server = MockRestServiceServer.bindTo(builder).build()
        repeat(times) {
            server.expect(requestTo("$baseUrl/models/$model:generateContent")).andRespond(withSuccess(body, MediaType.APPLICATION_JSON))
        }
        return server
    }

    @Test
    fun `finish reasons are reduced to a bounded code or dropped`() {
        assertEquals("max_tokens", AiFailureReason.normaliseFinishReason("MAX_TOKENS"))
        assertEquals("stop", AiFailureReason.normaliseFinishReason(" stop "))
        assertNull(AiFailureReason.normaliseFinishReason("the model said: no"))
        assertNull(AiFailureReason.normaliseFinishReason(""))
        assertNull(AiFailureReason.normaliseFinishReason("x".repeat(AiFailureReason.MAX_FINISH_REASON + 1)))
    }

    @Test
    fun `output cut off at the token limit is malformed JSON with finish reason max_tokens`() {
        val builder = RestClient.builder()
        val truncated = """{"candidates":[{"content":{"parts":[{"text":"{\"company\":\"Exa"}]},"finishReason":"MAX_TOKENS"}]}"""
        val server = respond(builder, truncated, times = 2)

        val error = assertFailsWith<AiUnavailableException> { gemini(builder).composeRound("Java interview") }

        assertEquals(AiFailureReason.MALFORMED_JSON, error.reason)
        assertEquals("max_tokens", error.finishReason)
        server.verify()
    }

    @Test
    fun `an empty answer withheld for safety says so`() {
        val builder = RestClient.builder()
        respond(builder, """{"candidates":[{"content":{"parts":[]},"finishReason":"SAFETY"}]}""")

        val error = assertFailsWith<AiUnavailableException> { gemini(builder).composeRound("Java interview") }

        assertEquals(AiFailureReason.EMPTY_RESPONSE, error.reason)
        assertEquals("safety", error.finishReason)
    }

    @Test
    fun `a blocked prompt has no candidate, only prompt feedback`() {
        val builder = RestClient.builder()
        respond(builder, """{"promptFeedback":{"blockReason":"OTHER"}}""")

        val error = assertFailsWith<AiUnavailableException> { gemini(builder).composeRound("Java interview") }

        assertEquals("blocked_other", error.finishReason)
    }

    @Test
    fun `JSON in the wrong shape is a decode failure`() {
        val builder = RestClient.builder()
        respond(builder, """{"candidates":[{"content":{"parts":[{"text":"{\"company\":[1,2]}"}]},"finishReason":"STOP"}]}""")

        val error = assertFailsWith<AiUnavailableException> { gemini(builder).composeRound("Java interview") }

        assertEquals(AiFailureReason.DECODE_FAILED, error.reason)
        assertEquals("stop", error.finishReason)
    }

    @Test
    fun `HTTP failures are told apart`() {
        val cases =
            mapOf(
                HttpStatus.NOT_FOUND to AiFailureReason.MODEL_NOT_FOUND,
                HttpStatus.BAD_REQUEST to AiFailureReason.REQUEST_REJECTED,
                HttpStatus.REQUEST_TIMEOUT to AiFailureReason.TIMEOUT,
                HttpStatus.TOO_MANY_REQUESTS to AiFailureReason.RATE_LIMITED,
                HttpStatus.SERVICE_UNAVAILABLE to AiFailureReason.PROVIDER_ERROR,
            )
        for ((status, reason) in cases) {
            val builder = RestClient.builder()
            MockRestServiceServer
                .bindTo(builder)
                .build()
                .expect(requestTo("$baseUrl/models/$model:generateContent"))
                .andRespond(withStatus(status).body("{}").contentType(MediaType.APPLICATION_JSON))

            val error = assertFailsWith<AiUnavailableException> { gemini(builder).composeRound("Java interview") }
            assertEquals(reason, error.reason, "HTTP ${status.value()}")
        }
    }

    @Test
    fun `a successful call carries its finish reason on the usage`() {
        val builder = RestClient.builder()
        val valid =
            """{"candidates":[{"content":{"parts":[{"text":"{\"company\":\"Example\",\"role\":\"Engineer\",\"level\":\"mid\",\"roundType\":\"technical_fundamentals\",\"durationMinutes\":30,\"language\":\"english\",\"understood\":\"Java interview\",\"assumptions\":[],\"confidence\":\"high\"}"}]},"finishReason":"STOP"}]}"""
        respond(builder, valid)

        val result = gemini(builder).composeRound("Java interview")

        assertEquals("stop", result.usage.finishReason)
        assertEquals(model, result.usage.model)
    }

    @Test
    fun `the chain records the serving model on success and the reason on failure`() {
        val failing = RestClient.builder()
        MockRestServiceServer
            .bindTo(failing)
            .build()
            .expect(requestTo("$baseUrl/models/$model:generateContent"))
            .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE).body("{}").contentType(MediaType.APPLICATION_JSON))
        val healthy = RestClient.builder()
        val valid =
            """{"candidates":[{"content":{"parts":[{"text":"{\"company\":\"Example\",\"role\":\"Engineer\",\"level\":\"mid\",\"roundType\":\"technical_fundamentals\",\"durationMinutes\":30,\"language\":\"english\",\"understood\":\"Java interview\",\"assumptions\":[],\"confidence\":\"high\"}"}]},"finishReason":"STOP"}]}"""
        MockRestServiceServer
            .bindTo(healthy)
            .build()
            .expect(requestTo("$baseUrl/models/strong-model:generateContent"))
            .andRespond(withSuccess(valid, MediaType.APPLICATION_JSON))
        val strong =
            GeminiInterviewAi(
                GeminiProperties(apiKey = "test-key", baseUrl = baseUrl),
                PromptLibrary(mapper),
                mapper,
                healthy,
                "strong-model",
            )
        val events = mutableListOf<InterviewEvent>()
        val chain = FallbackInterviewAi(listOf(gemini(failing), strong), eventRecorder = events::add)

        AiSpendContext.of(UUID.randomUUID(), UUID.randomUUID()) { chain.composeRound("Java interview") }

        val failed = events.single { it.type == "provider_attempt_failed" }
        assertEquals("provider_error", failed.reason)
        val succeeded = events.single { it.type == "provider_attempt_succeeded" }
        assertEquals("strong-model", succeeded.model)
        assertEquals("stop", succeeded.finishReason)
    }

    @Test
    fun `every failure reason is allowed by the ledger's reason constraint`() {
        val migration = File(MIGRATIONS, "20261114200000_interview_event_reasons.sql").readText()
        for (reason in AiFailureReason.entries) {
            assertTrue("'${reason.dbValue}'" in migration, "${reason.dbValue} is missing from the reason check constraint")
        }
    }

    private companion object {
        /** apps/api is the working directory under Gradle. */
        const val MIGRATIONS = "../../supabase/migrations"
    }
}
