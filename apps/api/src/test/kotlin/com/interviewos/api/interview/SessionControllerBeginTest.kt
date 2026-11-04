package com.interviewos.api.interview

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

/**
 * `POST /api/v1/sessions/{id}/begin` — the candidate has entered the room, so the clock
 * starts.
 *
 * The round's clock used to start when the session row was written: before the problem
 * was composed and before the device check, so a five-minute round opened on 3:50. The
 * service is handed the token subject and nothing the caller supplied.
 */
@WebMvcTest(SessionController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class SessionControllerBeginTest {
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

    private val candidate: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId: UUID = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `starts the caller's own round and returns the deadline to count down to`() {
        val enteredAt = Instant.parse("2026-09-12T11:50:00Z")
        given(interviewService.begin(candidate, sessionId)).willReturn(sessionStartedAt(enteredAt))

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/begin").with(tokenFor(candidate)))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.startedAt").value("2026-09-12T11:50:00Z"))
            .andExpect(jsonPath("$.scheduledEndAt").value("2026-09-12T11:55:00Z"))
    }

    @Test
    fun `a round that is not the caller's is not found`() {
        willThrow(ApiException.notFound()).given(interviewService).begin(candidate, sessionId)

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/begin").with(tokenFor(candidate)))
            .andExpect(status().isNotFound)
    }

    @Test
    fun `rejects a begin with no token`() {
        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/begin"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(interviewService)
    }

    private fun sessionStartedAt(startedAt: Instant) =
        SessionView(
            id = sessionId,
            companyName = "Amazon",
            archetype = "product_company",
            archetypeLabel = "Product company",
            archetypeConfidence = "recognised",
            groundingNote = "Questions follow the pattern for product companies.",
            roleTitle = "SDE 2",
            roundType = "coding_practical",
            roundLabel = "Coding",
            language = "english",
            status = "in_progress",
            consentVideo = false,
            startedAt = startedAt,
            endedAt = null,
            durationMinutes = 5,
            scheduledEndAt = startedAt.plusSeconds(5 * 60),
            turnsCompleted = 0,
            maxTurns = InterviewPlan.maxTurnsFor(5),
            currentTurn = null,
        )

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
