package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.ReportService
import com.interviewos.api.user.SupabaseIdentity
import org.hamcrest.Matchers.containsString
import org.hamcrest.Matchers.not
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
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
import org.springframework.test.web.servlet.request.MockHttpServletRequestBuilder
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals

/**
 * The faculty-view routes (contract "Module 8") through the real [CampusFacultyService] and
 * [CampusReadinessService], with the gate and the repositories mocked: no token 401, not staff
 * 404, wrong role 403 (checked before the body), then validation and the happy paths. The SQL —
 * isolation between colleges and faculty narrowing — is [CampusFacultyDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [CampusFacultyController::class, MeCampusReadinessController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusReadinessService::class,
    CampusFacultyService::class,
)
class CampusFacultyControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var readiness: ReadinessRepository

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var comments: StaffCommentRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var reports: ReportService

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val callerMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val otherStaff = UUID.fromString("0a000000-0000-0000-0000-0000000000c2")
    private val studentMember = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val studentUser = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")
    private val departmentId = UUID.fromString("0a000000-0000-0000-0000-0000000000f1")
    private val sessionId = UUID.fromString("0a000000-0000-0000-0000-000000000051")
    private val commentId = UUID.fromString("0a000000-0000-0000-0000-000000000071")

    private val base = "/api/v1/campus/orgs/$orgId"
    private val created = Instant.parse("2026-11-13T09:00:00Z")

    private fun scope(role: CampusRole) = OrgScope(orgId, userId, role, callerMember, platformAdmin = false)

    private fun platformAdmin() = OrgScope(orgId, userId, role = null, memberId = null, platformAdmin = true)

    private fun comment(
        author: UUID? = callerMember,
        body: String = "Strong on joins; revisit normal forms.",
    ) = StaffCommentRow(commentId, studentMember, sessionId, author, "Ms Rao", body, created, null)

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        mockMvc.perform(get("$base/attention")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("$base/students/$studentMember/comments")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("$base/students/$studentMember/comments").json("""{"body":"x"}""")).andExpect(status().isUnauthorized)
        mockMvc.perform(patch("$base/comments/$commentId").json("""{"body":"x"}""")).andExpect(status().isUnauthorized)
        mockMvc.perform(delete("$base/comments/$commentId")).andExpect(status().isUnauthorized)

        verifyNoInteractions(access, readiness, assignments, comments, audit)
    }

    @Test
    fun `someone who is not staff of the college gets 404 on every route`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(get("$base/attention").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("$base/students/$studentMember/comments").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(post("$base/students/$studentMember/comments").with(signedIn()).json("""{"body":"x"}"""))
            .andExpect(status().isNotFound)
        mockMvc.perform(patch("$base/comments/$commentId").with(signedIn()).json("""{"body":"x"}""")).andExpect(status().isNotFound)
        mockMvc.perform(delete("$base/comments/$commentId").with(signedIn())).andExpect(status().isNotFound)

        verifyNoInteractions(readiness, assignments, comments, audit)
    }

    @Test
    fun `a platform admin may read the attention list but not the college's private notes`() {
        given(access.resolve(identity, orgId)).willReturn(platformAdmin())

        mockMvc
            .perform(get("$base/students/$studentMember/comments").with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        mockMvc
            .perform(post("$base/students/$studentMember/comments").with(signedIn()).json("{}"))
            .andExpect(status().isForbidden)

        verifyNoInteractions(comments)
    }

    @Test
    fun `a bad reason is 400 invalid_reason`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.FACULTY))

        mockMvc
            .perform(get("$base/attention").param("reason", "lazy").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_reason"))
    }

    @Test
    fun `the attention list reads the readiness computation and keeps only students with a reason`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(readiness.weights(scope)).willReturn(ReadinessWeightSet.DEFAULT)
        val idle = UUID.fromString("0a000000-0000-0000-0000-0000000000d2")
        given(readiness.students(scope, ReadinessFilter())).willReturn(
            listOf(
                student(studentMember, "Asha", lastActiveAt = Instant.now().minus(1, ChronoUnit.DAYS)),
                student(idle, "Bilal", lastActiveAt = null),
            ),
        )
        given(readiness.assignments(scope)).willReturn(emptyList())
        given(readiness.interviewEvidence(scope, ReadinessFilter())).willReturn(emptyList())

        mockMvc
            .perform(get("$base/attention").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(1))
            .andExpect(jsonPath("$[0].memberId").value(idle.toString()))
            .andExpect(jsonPath("$[0].reasons[0]").value("inactive"))
            .andExpect(jsonPath("$[0].band").value("not_enough_evidence"))
            .andExpect(jsonPath("$[0].overdue").value(0))

        mockMvc
            .perform(get("$base/attention").param("reason", "overdue").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))
    }

    @Test
    fun `a student outside the college or the caller's scope is a 404 for notes`() {
        val scope = scope(CampusRole.FACULTY)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(comments.studentInScope(scope, studentMember)).willReturn(false)

        mockMvc.perform(get("$base/students/$studentMember/comments").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(post("$base/students/$studentMember/comments").with(signedIn()).json("""{"body":"Hello"}"""))
            .andExpect(status().isNotFound)

        verify(comments, never()).insert(anyScope(), anyUuid(), anyUuidOrNull(), anyString())
    }

    @Test
    fun `listing notes marks the caller's own`() {
        val scope = scope(CampusRole.FACULTY)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(comments.studentInScope(scope, studentMember)).willReturn(true)
        given(comments.list(scope, studentMember)).willReturn(listOf(comment(), comment(author = otherStaff).copy(id = UUID.randomUUID())))

        mockMvc
            .perform(get("$base/students/$studentMember/comments").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].isMine").value(true))
            .andExpect(jsonPath("$[1].isMine").value(false))
            .andExpect(jsonPath("$[0].authorName").value("Ms Rao"))
            .andExpect(jsonPath("$[0].sessionId").value(sessionId.toString()))
    }

    @Test
    fun `creating a note validates the body and the session, then audits without the text`() {
        val scope = scope(CampusRole.FACULTY)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(comments.studentInScope(scope, studentMember)).willReturn(true)

        mockMvc
            .perform(post("$base/students/$studentMember/comments").with(signedIn()).json("""{"body":"   "}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_comment"))
        mockMvc
            .perform(post("$base/students/$studentMember/comments").with(signedIn()).json("""{"body":"${"a".repeat(2001)}"}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_comment"))

        // A personal round, or another student's: not one of this member's assigned sessions.
        given(readiness.attemptSessionOwner(scope, studentMember, sessionId)).willReturn(null)
        mockMvc
            .perform(
                post("$base/students/$studentMember/comments").with(signedIn()).json("""{"body":"Good","sessionId":"$sessionId"}"""),
            ).andExpect(status().isNotFound)
        verify(comments, never()).insert(anyScope(), anyUuid(), anyUuidOrNull(), anyString())

        given(readiness.attemptSessionOwner(scope, studentMember, sessionId)).willReturn(studentUser)
        given(comments.insert(scope, studentMember, sessionId, "Strong on joins; revisit normal forms.")).willReturn(commentId)
        given(comments.find(scope, commentId)).willReturn(comment())
        mockMvc
            .perform(
                post("$base/students/$studentMember/comments")
                    .with(signedIn())
                    .json("""{"body":"  Strong on joins; revisit normal forms.  ","sessionId":"$sessionId"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(commentId.toString()))
            .andExpect(jsonPath("$.isMine").value(true))

        val detail = auditDetail("staff_comment.created")
        assertEquals(mapOf("memberId" to studentMember.toString(), "sessionId" to sessionId.toString()), detail)
    }

    @Test
    fun `only the author may edit a note`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(comments.find(scope, commentId)).willReturn(comment(author = otherStaff))

        mockMvc
            .perform(patch("$base/comments/$commentId").with(signedIn()).json("""{"body":""}"""))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        verify(comments, never()).updateBody(anyScope(), anyUuid(), anyString())

        given(comments.find(scope, commentId)).willReturn(comment())
        mockMvc
            .perform(patch("$base/comments/$commentId").with(signedIn()).json("""{"body":""}"""))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_comment"))
        mockMvc
            .perform(patch("$base/comments/$commentId").with(signedIn()).json("""{"body":"Revised"}"""))
            .andExpect(status().isOk)
        verify(comments).updateBody(scope, commentId, "Revised")
        verify(audit).record(scope, "staff_comment.edited", "staff_comment", commentId, mapOf("memberId" to studentMember.toString()))
    }

    @Test
    fun `the author or a college admin may delete a note, nobody else`() {
        val faculty = scope(CampusRole.FACULTY)
        given(access.resolve(identity, orgId)).willReturn(faculty)
        given(comments.find(faculty, commentId)).willReturn(comment(author = otherStaff))
        mockMvc.perform(delete("$base/comments/$commentId").with(signedIn())).andExpect(status().isForbidden)
        verify(comments, never()).delete(anyScope(), anyUuid())

        given(comments.find(faculty, commentId)).willReturn(comment())
        given(comments.delete(faculty, commentId)).willReturn(true)
        mockMvc.perform(delete("$base/comments/$commentId").with(signedIn())).andExpect(status().isNoContent)

        val admin = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(admin)
        given(comments.find(admin, commentId)).willReturn(comment(author = otherStaff))
        given(comments.delete(admin, commentId)).willReturn(true)
        mockMvc.perform(delete("$base/comments/$commentId").with(signedIn())).andExpect(status().isNoContent)
        verify(audit).record(
            admin,
            "staff_comment.deleted",
            "staff_comment",
            commentId,
            mapOf("memberId" to studentMember.toString(), "byAuthor" to false),
        )

        given(comments.find(admin, commentId)).willReturn(null)
        mockMvc.perform(delete("$base/comments/$commentId").with(signedIn())).andExpect(status().isNotFound)
    }

    @Test
    fun `a student's own readiness never carries staff notes`() {
        val own = OrgScope(orgId, userId, CampusRole.STUDENT, studentMember, platformAdmin = false)
        given(access.resolveOwnStudentMembership(identity)).willReturn(own)
        given(assignments.activeOrg(own)).willReturn(ActiveOrg("College A", 10))
        given(readiness.weights(own)).willReturn(ReadinessWeightSet.DEFAULT)
        given(readiness.students(own, ReadinessFilter(memberId = studentMember))).willReturn(
            listOf(student(studentMember, "Asha", lastActiveAt = null)),
        )
        given(readiness.assignments(own)).willReturn(emptyList())
        given(readiness.interviewEvidence(own, ReadinessFilter(memberId = studentMember))).willReturn(emptyList())

        mockMvc
            .perform(get("/api/v1/me/campus/readiness").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.comments").doesNotExist())
            .andExpect(content().string(not(containsString("comment"))))

        verifyNoInteractions(comments)
    }

    private fun student(
        memberId: UUID,
        name: String,
        lastActiveAt: Instant?,
    ) = ReadinessStudentRow(memberId, UUID.randomUUID(), name, null, batchId, "CSE 2027", departmentId, "CSE", lastActiveAt)

    private fun auditDetail(action: String): Map<*, *> =
        mockingDetails(audit)
            .invocations
            .single { it.method.name == "record" && it.arguments[1] == action }
            .arguments[4] as Map<*, *>

    private fun anyScope(): OrgScope = ArgumentMatchers.any(OrgScope::class.java) ?: scope(CampusRole.TPO)

    private fun anyUuid(): UUID = ArgumentMatchers.any(UUID::class.java) ?: UUID.randomUUID()

    private fun anyUuidOrNull(): UUID? = ArgumentMatchers.any(UUID::class.java)

    private fun anyString(): String = ArgumentMatchers.anyString() ?: ""

    private fun MockHttpServletRequestBuilder.json(body: String) = contentType(MediaType.APPLICATION_JSON).content(body)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
