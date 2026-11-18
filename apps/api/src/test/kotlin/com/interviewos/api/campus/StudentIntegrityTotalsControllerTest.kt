package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.SessionRepository
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
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
import java.util.UUID

/**
 * `GET /campus/orgs/{org}/students/{memberId}/integrity` (contract "Module 5"): the counts of all
 * of one student's assigned rounds, for the staff student page. Same order as every campus route:
 * no token 401, not staff there 404, wrong role 403, student outside the college or the faculty
 * member's batches 404, then the numbers. The SQL's college and batch narrowing is in
 * [CampusIntegrityDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [CampusStudentIntegrityController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    IntegrityService::class,
)
class StudentIntegrityTotalsControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var sessions: SessionRepository

    @MockitoBean private lateinit var integrity: IntegrityRepository

    @MockitoBean private lateinit var readiness: ReadinessRepository

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val memberId = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val studentUser = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")
    private val first = UUID.fromString("0a000000-0000-0000-0000-000000000051")
    private val second = UUID.fromString("0a000000-0000-0000-0000-000000000052")
    private val path = "/api/v1/campus/orgs/$orgId/students/$memberId/integrity"

    private fun scope(role: CampusRole) = OrgScope(orgId, userId, role, UUID.randomUUID(), platformAdmin = false)

    @Test
    fun `no token is a 401 and nothing is read`() {
        mockMvc.perform(get(path)).andExpect(status().isUnauthorized)
        verifyNoInteractions(sessions, integrity, readiness, access, audit)
    }

    @Test
    fun `someone who is not staff of the college gets 404`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(get(path).with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(integrity, readiness, audit)
    }

    @Test
    fun `a student role gets 403 before anything is read`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.STUDENT))

        mockMvc
            .perform(get(path).with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))

        verifyNoInteractions(integrity, readiness, audit)
    }

    @Test
    fun `a student outside the college or the faculty member's batches is a 404 and nothing is counted or audited`() {
        val scope = scope(CampusRole.FACULTY)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.studentInScope(scope, memberId)).willReturn(false)

        mockMvc.perform(get(path).with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(integrity, audit)
    }

    @Test
    fun `the counts of every assigned round are added up, and the read is audited`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.studentInScope(scope, memberId)).willReturn(true)
        given(readiness.attemptSessions(scope, memberId)).willReturn(
            listOf(AttemptSessionRow(first, studentUser), AttemptSessionRow(second, studentUser)),
        )
        given(integrity.counts(first, studentUser)).willReturn(IntegrityCounts(tabHidden = 2, windowBlur = 1, pastes = 1, pastedChars = 80))
        given(integrity.counts(second, studentUser)).willReturn(IntegrityCounts(tabHidden = 0, windowBlur = 3, pastes = 0, pastedChars = 0))
        given(integrity.answerTimings(first, studentUser)).willReturn(
            listOf("""{"recordedMs":60000,"firstSoundMs":400,"speakingMs":40000,"pauseCount":1,"longestPauseMs":22000,"totalPauseMs":22000}"""),
        )
        given(integrity.answerTimings(second, studentUser)).willReturn(emptyList())

        mockMvc
            .perform(get(path).with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.rounds").value(2))
            .andExpect(jsonPath("$.windowSwitches").value(6))
            .andExpect(jsonPath("$.tabHidden").value(2))
            .andExpect(jsonPath("$.windowBlur").value(4))
            .andExpect(jsonPath("$.pastes").value(1))
            .andExpect(jsonPath("$.fastAnswers").value(1))
            .andExpect(jsonPath("$.longPauses").value(1))

        verify(audit).record(scope, "integrity_totals.viewed", CampusOrgService.TARGET_MEMBER, memberId)
    }

    @Test
    fun `a student with no assigned rounds has zero counts`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.studentInScope(scope, memberId)).willReturn(true)
        given(readiness.attemptSessions(scope, memberId)).willReturn(emptyList())

        mockMvc
            .perform(get(path).with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.rounds").value(0))
            .andExpect(jsonPath("$.windowSwitches").value(0))
    }

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
