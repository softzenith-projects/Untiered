package com.interviewos.api.interview

import com.interviewos.api.ai.ComposedCase
import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.clearInvocations
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID
import kotlin.test.assertTrue

/**
 * `POST /api/v1/sessions` with `candidateStage` set (task 051) — the field that lets a
 * candidate correct [CandidateStage.of]'s guess rather than sit whatever round it derived.
 *
 * Through the real [InterviewService], the same way [SessionControllerBankRoundTest]
 * exercises the round it replaced: this is the endpoint, not a hand-rolled call to the
 * service, so a validation rule that never reaches the wire would not be caught here.
 */
@WebMvcTest(SessionController::class)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    SessionControllerCandidateStageTest.Wiring::class,
)
class SessionControllerCandidateStageTest {
    @TestConfiguration
    class Wiring {
        @Bean
        fun harness() = BankRoundHarness()

        @Bean
        fun interviewService(harness: BankRoundHarness) = harness.service
    }

    @Autowired
    private lateinit var mockMvc: MockMvc

    @Autowired
    private lateinit var harness: BankRoundHarness

    @MockitoBean
    private lateinit var reportService: ReportService

    @MockitoBean
    private lateinit var readinessService: ReadinessService

    @MockitoBean
    private lateinit var roundDeletion: RoundDeletion

    private val candidate = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @BeforeEach
    fun reset() {
        clearInvocations(harness.repository)
        harness.briefs.clear()
    }

    /**
     * The hole this task closes: a plain title with no resume derives mid-level and is
     * refused nothing, but a candidate who says they are a student must get the campus
     * round's protections — including the refusal of a round no fresher loop contains.
     */
    @Test
    fun `a stated student is refused a system design round even with a plain title and no resume`() {
        val body =
            """
            {"companyName":"Google","roleTitle":"Software Engineer","roundType":"system_design",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":45,
             "candidateStage":"student"}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("round_not_run_at_this_level"))

        assertTrue(harness.insertedTurns().isEmpty())
    }

    /**
     * The other direction: a resume that reads as a fresher's must not stop a candidate
     * who says they are already working from sitting the round they asked for.
     */
    @Test
    fun `a stated professional is not refused the round a thin resume would have blocked`() {
        val resolution = harness.archetypes.resolve("Infosys")
        given(
            harness.repository.insertSession(
                candidate,
                "Infosys",
                resolution.archetype,
                resolution.confidence,
                "Graduate Engineer Trainee",
                "system_design",
                "english",
                true,
                false,
                45,
                DeclaredStage.PROFESSIONAL,
            ),
        ).willReturn(sessionId)
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "Infosys",
                archetype = resolution.archetype.dbValue,
                archetypeConfidence = resolution.confidence.dbValue,
                roleTitle = "Graduate Engineer Trainee",
                roundType = "system_design",
                language = "english",
                status = "in_progress",
                startedAt = null,
                endedAt = null,
                consentVideo = false,
                durationMinutes = 40,
                declaredStage = DeclaredStage.PROFESSIONAL,
            ),
        )
        harness.case =
            ComposedCase(
                title = "A design round",
                summary = "A design round for a graduate trainee who says they are already working.",
                constraints = listOf("Reasonable scale"),
                openingPrompt = "What does this system have to do?",
                deepDiveOptions = listOf("Data model"),
            )

        val body =
            """
            {"companyName":"Infosys","roleTitle":"Graduate Engineer Trainee","roundType":"system_design",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":45,
             "candidateStage":"professional"}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isCreated)

        assertTrue(
            !harness.briefs
                .last()
                .levelCalibration
                .contains("campus and new-graduate hiring"),
        )
    }

    @Test
    fun `an unrecognised candidate stage is rejected cleanly, and nothing is written`() {
        val body =
            """
            {"companyName":"Google","roleTitle":"Software Engineer","roundType":"coding_practical",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":45,
             "candidateStage":"sophomore"}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("unknown_candidate_stage"))

        verifyNoInteractions(harness.repository)
    }

    @Test
    fun `an unsupported interview language is rejected before anything is written`() {
        val body =
            """
            {"companyName":"Google","roleTitle":"Software Engineer","roundType":"coding_practical",
             "language":"french","consentAudio":true,"consentVideo":false,"durationMinutes":45}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isBadRequest)

        verifyNoInteractions(harness.repository)
    }

    @Test
    fun `company and role are optional and normalise to honest general context`() {
        val resolution = harness.archetypes.resolve("General practice")
        given(
            harness.repository.insertSession(
                candidate,
                "General practice",
                resolution.archetype,
                resolution.confidence,
                "Role not specified",
                "system_design",
                "english",
                true,
                false,
                30,
                null,
            ),
        ).willReturn(sessionId)
        given(harness.repository.findSession(sessionId, candidate)).willReturn(
            SessionRow(
                id = sessionId,
                companyName = "General practice",
                archetype = resolution.archetype.dbValue,
                archetypeConfidence = resolution.confidence.dbValue,
                roleTitle = "Role not specified",
                roundType = "system_design",
                language = "english",
                status = "in_progress",
                startedAt = null,
                endedAt = null,
                consentVideo = false,
                durationMinutes = 30,
            ),
        )
        harness.case =
            ComposedCase(
                title = "A general design round",
                summary = "A design problem without employer-specific assumptions.",
                constraints = listOf("State assumptions"),
                openingPrompt = "What does this system need to do?",
                deepDiveOptions = listOf("Data model"),
            )

        val body =
            """
            {"companyName":"","roleTitle":"","roundType":"system_design",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":30}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.companyName").value("General practice"))
            .andExpect(jsonPath("$.roleTitle").value("Role not specified"))
    }

    /** 4 November 2026: rounds are 30, 45 or 60 minutes, and nothing in between. */
    @Test
    fun `rejects a length that is not one of the three before anything is written`() {
        val body =
            """
            {"companyName":"","roleTitle":"","roundType":"technical_fundamentals",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":40}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("duration_invalid"))

        verifyNoInteractions(harness.repository)
    }

    @Test
    fun `rejects a five minute pseudo-round before anything is written`() {
        val body =
            """
            {"companyName":"","roleTitle":"","roundType":"technical_fundamentals",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":5}
            """.trimIndent()

        mockMvc
            .perform(
                post("/api/v1/sessions")
                    .with(tokenFor(candidate))
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isBadRequest)

        verifyNoInteractions(harness.repository)
    }

    @Test
    fun `rejects a start with no token even when candidateStage is set`() {
        val body =
            """
            {"companyName":"Google","roleTitle":"Software Engineer","roundType":"coding_practical",
             "language":"english","consentAudio":true,"consentVideo":false,"durationMinutes":45,
             "candidateStage":"student"}
            """.trimIndent()

        mockMvc
            .perform(post("/api/v1/sessions").contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(harness.repository)
    }

    private fun tokenFor(userId: UUID) =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(userId.toString())
                .claim("email", "candidate@example.com")
        }
}
