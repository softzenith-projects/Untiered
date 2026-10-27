package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.doThrow
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

@WebMvcTest(InterviewEventAdminController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class InterviewEventAdminControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var adminAccess: AdminAccess

    @MockitoBean
    private lateinit var repository: InterviewEventRepository

    private val adminId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")
    private val ownerId = UUID.fromString("1b64ac46-cbe4-45a8-ab77-21d082b2a8bb")

    @Test
    fun `admin can read one bounded session timeline`() {
        given(repository.timeline(sessionId, 25)).willReturn(
            InterviewTimeline(
                sessionId = sessionId,
                userId = ownerId,
                status = "in_progress",
                roundType = "technical_fundamentals",
                durationMinutes = 20,
                enteredAt = Instant.parse("2026-10-10T10:00:00Z"),
                endedAt = null,
                observedThrough = Instant.parse("2026-10-10T10:06:00Z"),
                observedDurationSeconds = 360,
                events =
                    listOf(
                        InterviewEventView(
                            id = 7,
                            occurredAt = Instant.parse("2026-10-10T10:06:00Z"),
                            turnIndex = 2,
                            requestId = null,
                            event = "client_heartbeat",
                            phase = "submitting",
                            provider = null,
                            operation = null,
                            outcome = null,
                            errorType = null,
                            action = null,
                            intervention = null,
                            durationMs = null,
                        ),
                    ),
            ),
        )

        mockMvc
            .perform(get("/api/v1/admin/interview-events/$sessionId?limit=25").with(tokenFor(adminId)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.userId").value(ownerId.toString()))
            .andExpect(jsonPath("$.observedDurationSeconds").value(360))
            .andExpect(jsonPath("$.events[0].event").value("client_heartbeat"))
            .andExpect(jsonPath("$.events[0].phase").value("submitting"))

        verify(repository).timeline(sessionId, 25)
    }

    @Test
    fun `lookup without a token is rejected before admin or database access`() {
        mockMvc
            .perform(get("/api/v1/admin/interview-events/$sessionId"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(adminAccess, repository)
    }

    @Test
    fun `authenticated non admin sees not found and cannot query the ledger`() {
        doThrow(
            com.interviewos.api.common.ApiException
                .notFound(),
        ).`when`(adminAccess)
            .require(SupabaseIdentity(adminId, "operator@example.com", null, setOf("google")))

        mockMvc
            .perform(get("/api/v1/admin/interview-events/$sessionId").with(tokenFor(adminId)))
            .andExpect(status().isNotFound)

        verifyNoInteractions(repository)
    }

    @Test
    fun `unknown path is a not found envelope rather than an internal error`() {
        mockMvc
            .perform(get("/api/v1/no-such-endpoint").with(tokenFor(adminId)))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("not_found"))
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "operator@example.com")
                .claim("app_metadata", mapOf("provider" to "google", "providers" to listOf("google")))
        }
}
