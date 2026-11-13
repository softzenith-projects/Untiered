package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.SessionRepository
import com.interviewos.api.interview.SessionRow
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers
import org.mockito.BDDMockito.given
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

internal fun integrityTestSession(
    id: UUID,
    assigned: Boolean,
) = SessionRow(
    id = id,
    companyName = "",
    archetype = "general",
    archetypeConfidence = "inferred",
    roleTitle = "Software engineer",
    roundType = "technical_fundamentals",
    language = "english",
    status = "in_progress",
    startedAt = Instant.parse("2026-11-13T10:00:00Z"),
    endedAt = null,
    consentVideo = false,
    durationMinutes = 30,
    assigned = assigned,
)

private const val THREE_EVENTS =
    """{"events":[{"type":"tab_hidden","at":"2026-11-13T10:01:00Z","turnIndex":1},
       {"type":"window_blur","at":"2026-11-13T10:02:00Z"},
       {"type":"paste","at":"2026-11-13T10:03:00Z","surface":"code","chars":42}]}"""

/**
 * The integrity routes through the real [IntegrityService], with the repositories and the campus
 * gate mocked at the boundary. Which rows the SQL writes and reads is in
 * [CampusIntegrityDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [SessionIntegrityController::class, CampusIntegrityController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    IntegrityService::class,
)
class IntegrityControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var sessions: SessionRepository

    @MockitoBean private lateinit var integrity: IntegrityRepository

    @MockitoBean private lateinit var readiness: ReadinessRepository

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "someone@college.edu", null)
    private val sessionId = UUID.fromString("0a000000-0000-0000-0000-000000000051")
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val memberId = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val studentUser = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")
    private val staffPath = "/api/v1/campus/orgs/$orgId/students/$memberId/reports/$sessionId/integrity"

    @Test
    fun `no token is a 401 on every route`() {
        mockMvc.perform(post("/api/v1/sessions/$sessionId/integrity-events").json(THREE_EVENTS)).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/sessions/$sessionId/integrity")).andExpect(status().isUnauthorized)
        mockMvc.perform(get(staffPath)).andExpect(status().isUnauthorized)
        verifyNoInteractions(sessions, integrity, readiness, access, audit)
    }

    @Test
    fun `the owner's events on an assigned round are added up and written once`() {
        given(sessions.findSession(sessionId, userId)).willReturn(integrityTestSession(sessionId, assigned = true))
        given(integrity.increment(sessionId, userId, IntegrityIncrements(1, 1, 1, 42))).willReturn(true)

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/integrity-events").with(signedIn()).json(THREE_EVENTS))
            .andExpect(status().isNoContent)

        verify(integrity).increment(sessionId, userId, IntegrityIncrements(tabHidden = 1, windowBlur = 1, pastes = 1, pastedChars = 42))
    }

    @Test
    fun `someone else's session is a 404 and nothing is written`() {
        given(sessions.findSession(sessionId, userId)).willReturn(null)

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/integrity-events").with(signedIn()).json(THREE_EVENTS))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("not_found"))
        mockMvc.perform(get("/api/v1/sessions/$sessionId/integrity").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(integrity)
    }

    @Test
    fun `a personal round answers 204 and the write it reaches stores nothing`() {
        // The repository's insert is the guard: it selects only sessions with an assignment
        // attempt, so for a personal round it writes no row and reports false.
        given(sessions.findSession(sessionId, userId)).willReturn(integrityTestSession(sessionId, assigned = false))
        given(integrity.increment(sessionId, userId, IntegrityIncrements(1, 1, 1, 42))).willReturn(false)
        given(integrity.isAssigned(sessionId, userId)).willReturn(false)

        mockMvc
            .perform(post("/api/v1/sessions/$sessionId/integrity-events").with(signedIn()).json(THREE_EVENTS))
            .andExpect(status().isNoContent)
        mockMvc
            .perform(get("/api/v1/sessions/$sessionId/integrity").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.recorded").value(false))
            .andExpect(jsonPath("$.tabHidden").value(0))
            .andExpect(jsonPath("$.notes.length()").value(0))

        verify(integrity, never()).counts(anyUuid(), anyUuid())
    }

    @Test
    fun `a malformed batch is a 400 and nothing is written`() {
        given(sessions.findSession(sessionId, userId)).willReturn(integrityTestSession(sessionId, assigned = true))
        val tooMany = (1..51).joinToString(",", """{"events":[""", "]}") { """{"type":"tab_hidden","at":"x"}""" }

        for (body in listOf(tooMany, """{"events":[{"type":"screenshot","at":"x"}]}""", """{}""")) {
            mockMvc
                .perform(post("/api/v1/sessions/$sessionId/integrity-events").with(signedIn()).json(body))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("invalid_integrity_events"))
        }
        verify(integrity, never()).increment(anyUuid(), anyUuid(), anyIncrements())
    }

    @Test
    fun `the owner reads the same summary their college reads`() {
        given(sessions.findSession(sessionId, userId)).willReturn(integrityTestSession(sessionId, assigned = true))
        given(integrity.isAssigned(sessionId, userId)).willReturn(true)
        given(integrity.counts(sessionId, userId)).willReturn(IntegrityCounts(3, 0, 1, 200))
        given(integrity.answerTimings(sessionId, userId)).willReturn(
            listOf(
                """{"recordedMs":60000,"firstSoundMs":400,"speakingMs":40000,"pauseCount":1,"longestPauseMs":22000,"totalPauseMs":22000}""",
                """{"recordedMs":60000,"firstSoundMs":3000,"speakingMs":40000,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}""",
                "not json",
            ),
        )

        mockMvc
            .perform(get("/api/v1/sessions/$sessionId/integrity").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.recorded").value(true))
            .andExpect(jsonPath("$.tabHidden").value(3))
            .andExpect(jsonPath("$.pastes").value(1))
            .andExpect(jsonPath("$.pastedChars").value(200))
            .andExpect(jsonPath("$.fastAnswers").value(1))
            .andExpect(jsonPath("$.longPauses").value(1))
            .andExpect(jsonPath("$.notes[0]").value("Switched away from the interview tab 3 times."))
    }

    @Test
    fun `staff read through the same check as the report view, and the read is audited`() {
        val scope = OrgScope(orgId, userId, CampusRole.TPO, UUID.randomUUID(), platformAdmin = false, facultyBatchIds = emptySet())
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.attemptSessionOwner(scope, memberId, sessionId)).willReturn(studentUser)
        given(integrity.isAssigned(sessionId, studentUser)).willReturn(true)
        given(integrity.counts(sessionId, studentUser)).willReturn(IntegrityCounts.ZERO)
        given(integrity.answerTimings(sessionId, studentUser)).willReturn(emptyList())

        mockMvc
            .perform(get(staffPath).with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.recorded").value(true))
            .andExpect(jsonPath("$.notes[0]").value(org.hamcrest.Matchers.startsWith("Nothing was recorded")))

        verify(audit).record(scope, "integrity.viewed", "session", sessionId, mapOf("memberId" to memberId.toString()))
    }

    @Test
    fun `staff get 404 for a session that is not this member's assigned attempt, or a college they are not in`() {
        val scope = OrgScope(orgId, userId, CampusRole.FACULTY, UUID.randomUUID(), platformAdmin = false, facultyBatchIds = emptySet())
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.attemptSessionOwner(scope, memberId, sessionId)).willReturn(null)
        mockMvc.perform(get(staffPath).with(signedIn())).andExpect(status().isNotFound)

        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())
        mockMvc.perform(get(staffPath).with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(integrity, sessions, audit)
    }

    @Test
    fun `a student role cannot use the staff route`() {
        val scope = OrgScope(orgId, userId, CampusRole.STUDENT, UUID.randomUUID(), platformAdmin = false, facultyBatchIds = emptySet())
        given(access.resolve(identity, orgId)).willReturn(scope)

        mockMvc
            .perform(get(staffPath).with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        verifyNoInteractions(integrity, readiness)
    }

    private fun org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder.json(body: String) =
        contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }

    private fun anyUuid(): UUID = ArgumentMatchers.any(UUID::class.java) ?: UUID.randomUUID()

    private fun anyIncrements(): IntegrityIncrements =
        ArgumentMatchers.any(IntegrityIncrements::class.java) ?: IntegrityIncrements(0, 0, 0, 0)
}

/** With the campus switch off, the room still gets its 204, nothing is stored, and the staff route is closed. */
@WebMvcTest(
    controllers = [SessionIntegrityController::class, CampusIntegrityController::class],
    properties = ["interviewos.features.campus=false"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    IntegrityService::class,
)
class IntegritySwitchOffTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var sessions: SessionRepository

    @MockitoBean private lateinit var integrity: IntegrityRepository

    @MockitoBean private lateinit var readiness: ReadinessRepository

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("0a000000-0000-0000-0000-000000000051")

    @Test
    fun `events are answered 204 and nothing is stored`() {
        given(sessions.findSession(sessionId, userId)).willReturn(integrityTestSession(sessionId, assigned = true))

        mockMvc
            .perform(
                post("/api/v1/sessions/$sessionId/integrity-events")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(THREE_EVENTS),
            ).andExpect(status().isNoContent)

        verifyNoInteractions(integrity)
    }

    @Test
    fun `the owner's summary is not recorded and the staff route is a 404`() {
        given(sessions.findSession(sessionId, userId)).willReturn(integrityTestSession(sessionId, assigned = true))

        mockMvc
            .perform(get("/api/v1/sessions/$sessionId/integrity").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.recorded").value(false))
        mockMvc
            .perform(
                get("/api/v1/campus/orgs/${UUID.randomUUID()}/students/${UUID.randomUUID()}/reports/$sessionId/integrity").with(signedIn()),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(integrity, access, audit)
    }

    private fun signedIn() = jwt().jwt { builder: Jwt.Builder -> builder.subject(userId.toString()).claim("email", "a@b.edu") }
}
