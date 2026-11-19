package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.any
import org.mockito.ArgumentMatchers.anyBoolean
import org.mockito.ArgumentMatchers.anyInt
import org.mockito.ArgumentMatchers.eq
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/** The answer route's keep-listening response on the wire (PRD 06, `interviewos.interviewer.turn-state`). */
@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerKeepListeningTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var interviewService: InterviewService

    @MockitoBean
    private lateinit var reportService: ReportService

    @MockitoBean
    private lateinit var readinessService: ReadinessService

    @MockitoBean
    private lateinit var roundDeletion: RoundDeletion

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val requestId = UUID.fromString("176bd50a-e9a4-4df4-ad50-1c2f47a0c283")
    private val audio = MockMultipartFile("audio", "answer.webm", "audio/webm", byteArrayOf(1, 2, 3))

    private fun givenTheServiceAnswers(response: SubmitAnswerResponse) {
        given(
            interviewService.submitAnswer(
                same(candidate),
                same(sessionId),
                anyInt(),
                anything(),
                anyBoolean(),
                anyBoolean(),
                anything(),
                anything(),
            ),
        ).willReturn(response)
    }

    // Matchers that hand Kotlin a value of the parameter's type, so no null meets a non-null parameter.
    private fun <T> same(value: T): T {
        eq(value)
        return value
    }

    @Suppress("UNCHECKED_CAST")
    private fun <T> anything(): T {
        any<T>()
        return null as T
    }

    @Test
    fun `a keep-listening verdict reaches the room with its wait and no next turn`() {
        givenTheServiceAnswers(
            SubmitAnswerResponse(
                sessionComplete = false,
                turnsCompleted = 6,
                nextTurn = null,
                keepListening = KeepListening(turnState = "needs_time", waitMs = 10_000),
            ),
        )

        mockMvc
            .perform(
                multipart("/api/v1/sessions/$sessionId/turns")
                    .file(audio)
                    .param("turnIndex", "6")
                    .param("requestId", requestId.toString())
                    .with(tokenFor(candidate)),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.sessionComplete").value(false))
            .andExpect(jsonPath("$.nextTurn").doesNotExist())
            .andExpect(jsonPath("$.keepListening.turnState").value("needs_time"))
            .andExpect(jsonPath("$.keepListening.waitMs").value(10_000))
    }

    @Test
    fun `an ordinary answer carries no keep-listening field at all`() {
        givenTheServiceAnswers(
            SubmitAnswerResponse(
                sessionComplete = false,
                turnsCompleted = 7,
                nextTurn = TurnView(7, "What would you check first?", null, "pending", "main", false),
            ),
        )

        mockMvc
            .perform(
                multipart("/api/v1/sessions/$sessionId/turns")
                    .file(audio)
                    .param("turnIndex", "6")
                    .param("requestId", requestId.toString())
                    .with(tokenFor(candidate)),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.nextTurn.questionText").value("What would you check first?"))
            .andExpect(jsonPath("$.keepListening").doesNotExist())
    }

    @Test
    fun `an answer without a token is refused before the service`() {
        mockMvc
            .perform(
                multipart("/api/v1/sessions/$sessionId/turns")
                    .file(audio)
                    .param("turnIndex", "6")
                    .param("requestId", requestId.toString()),
            ).andExpect(status().isUnauthorized)

        verifyNoInteractions(interviewService)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
