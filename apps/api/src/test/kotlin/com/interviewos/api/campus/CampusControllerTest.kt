package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.patch
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

/**
 * The college routes through the real [CampusOrgService], with the gate ([CampusAccess]) and
 * the repositories mocked at the boundary. What is under test is the order of refusals — no
 * token 401, not in the college 404, wrong role 403 — and that nothing is read or written
 * before the caller has passed them. The real SQL is exercised by
 * [CampusIsolationDatabaseIntegrationTest].
 */
@WebMvcTest(controllers = [CampusController::class], properties = ["interviewos.features.campus=true"])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusOrgService::class,
    OrgLogos::class,
)
@EnableConfigurationProperties(StorageProperties::class)
class CampusControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var orgs: OrganisationRepository

    @MockitoBean private lateinit var structure: StructureRepository

    @MockitoBean private lateinit var members: MemberRepository

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val callerMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val otherMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c2")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")

    private fun scope(role: CampusRole) = OrgScope(orgId, userId, role, callerMember, platformAdmin = false)

    @Test
    fun `a staff member reads their college`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(orgs.find(scope)).willReturn(orgRow())

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.id").value(orgId.toString()))
            .andExpect(jsonPath("$.slug").value("demo-college"))
            .andExpect(jsonPath("$.interviewsUsed").value(0))
            .andExpect(jsonPath("$.logoUrl").doesNotExist())

        // Handed to the audit writer, which records it only when the reader is a platform admin.
        verify(audit).recordPlatformAdminRead(scope, "org.viewed", "organisation", orgId)
    }

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/members")).andExpect(status().isUnauthorized)

        verifyNoInteractions(access, orgs, structure, members, audit)
    }

    @Test
    fun `someone who is not staff of the college gets 404, not 403`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/members").with(signedIn()))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.error").value("not_found"))
        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/departments")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"code":"CSE","name":"Computer Science"}"""),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(orgs, structure, members, audit)
    }

    @Test
    fun `faculty cannot change the college's structure`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.FACULTY))

        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/departments")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    // Invalid on purpose: the permission is checked before the body is.
                    .content("""{"code":"not a code"}"""),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))

        verifyNoInteractions(structure, audit)
    }

    @Test
    fun `a TPO cannot read the audit log or change a role`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.TPO))

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/audit-log").with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        mockMvc
            .perform(
                patch("/api/v1/campus/orgs/$orgId/members/$otherMember/role")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"role":"college_admin"}"""),
            ).andExpect(status().isForbidden)

        verifyNoInteractions(members, audit)
    }

    @Test
    fun `a TPO may remove a student but not a member of staff`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(members.find(scope, otherMember)).willReturn(member(otherMember, CampusRole.FACULTY))

        mockMvc
            .perform(delete("/api/v1/campus/orgs/$orgId/members/$otherMember").with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        verify(members, never()).remove(scope, otherMember)

        given(members.find(scope, otherMember)).willReturn(member(otherMember, CampusRole.STUDENT))
        given(members.remove(scope, otherMember)).willReturn(true)
        mockMvc
            .perform(delete("/api/v1/campus/orgs/$orgId/members/$otherMember").with(signedIn()))
            .andExpect(status().isNoContent)
        verify(audit).record(scope, "member.removed", "member", otherMember, mapOf("role" to "student"))
    }

    @Test
    fun `the last college admin can be neither demoted nor removed`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(members.find(scope, otherMember)).willReturn(member(otherMember, CampusRole.COLLEGE_ADMIN))
        given(members.countCollegeAdmins(scope)).willReturn(1L)

        mockMvc
            .perform(
                patch("/api/v1/campus/orgs/$orgId/members/$otherMember/role")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"role":"tpo"}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("last_admin"))
        mockMvc
            .perform(delete("/api/v1/campus/orgs/$orgId/members/$otherMember").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("last_admin"))

        verify(members, never()).changeStaffRole(scope, otherMember, CampusRole.TPO)
        verify(members, never()).remove(scope, otherMember)
    }

    @Test
    fun `an admin cannot remove themselves`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(members.find(scope, callerMember)).willReturn(member(callerMember, CampusRole.COLLEGE_ADMIN))
        given(members.countCollegeAdmins(scope)).willReturn(3L)

        mockMvc
            .perform(delete("/api/v1/campus/orgs/$orgId/members/$callerMember").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("cannot_remove_self"))
    }

    @Test
    fun `an admin changes a role and it is audited with both roles`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(members.find(scope, otherMember))
            .willReturn(member(otherMember, CampusRole.FACULTY), member(otherMember, CampusRole.TPO))
        given(members.changeStaffRole(scope, otherMember, CampusRole.TPO)).willReturn(true)

        mockMvc
            .perform(
                patch("/api/v1/campus/orgs/$orgId/members/$otherMember/role")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"role":"tpo"}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.role").value("tpo"))
            .andExpect(jsonPath("$.id").value(otherMember.toString()))

        verify(audit).record(scope, "member.role_changed", "member", otherMember, mapOf("from" to "faculty", "to" to "tpo"))
    }

    @Test
    fun `a student's role is not changed through the staff route`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(members.find(scope, otherMember)).willReturn(member(otherMember, CampusRole.STUDENT))

        mockMvc
            .perform(
                patch("/api/v1/campus/orgs/$orgId/members/$otherMember/role")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"role":"college_admin"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("not_staff"))
    }

    @Test
    fun `an id from another college is not found, even to an admin`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        // The repository looks ids up with org_id = :orgId, so another college's batch is null.
        given(structure.findBatch(scope, batchId)).willReturn(null)

        mockMvc
            .perform(delete("/api/v1/campus/orgs/$orgId/batches/$batchId").with(signedIn()))
            .andExpect(status().isNotFound)
        verify(structure, never()).deleteBatch(scope, batchId)
    }

    @Test
    fun `creating a department with a taken code is a 409`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(structure.createDepartment(scope, "CSE", "Computer Science")).willReturn(null)

        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/departments")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"code":"cse","name":"Computer Science"}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("department_code_taken"))
    }

    @Test
    fun `members are paged with a cursor`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        val rows = (1..CampusCursor.PAGE_SIZE + 1).map { member(UUID.randomUUID(), CampusRole.STUDENT) }
        given(members.list(scope, MemberFilter(CampusRole.STUDENT), null, CampusCursor.PAGE_SIZE + 1)).willReturn(rows)

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/members?role=student").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items.length()").value(CampusCursor.PAGE_SIZE))
            .andExpect(jsonPath("$.items[0].email").value("person@college.edu"))
            .andExpect(jsonPath("$.nextCursor").isString)
    }

    @Test
    fun `an unknown role filter is a 400`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.TPO))

        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/members?role=platform_admin").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_role"))
    }

    private fun orgRow() =
        OrgRow(
            id = orgId,
            name = "Demo College",
            slug = "demo-college",
            city = "Pune",
            state = "Maharashtra",
            logoPath = null,
            contactName = null,
            contactEmail = null,
            contactPhone = null,
            status = "active",
            interviewAllowance = 100,
            createdAt = Instant.parse("2026-11-13T10:00:00Z"),
            staffCount = 2,
            studentCount = 40,
        )

    private fun member(
        id: UUID,
        role: CampusRole,
    ): MemberRow {
        val joinedAt = Instant.parse("2026-11-13T10:00:00Z")
        val student = role == CampusRole.STUDENT
        return MemberRow(
            view =
                MemberView(
                    id = id,
                    name = "A Person",
                    email = "person@college.edu",
                    role = role.dbValue,
                    batchId = if (student) batchId else null,
                    batchName = if (student) "CSE 2027" else null,
                    departmentCode = if (student) "CSE" else null,
                    rollNumber = null,
                    joinedAt = joinedAt.toString(),
                    active = false,
                ),
            userId = UUID.randomUUID(),
            role = role,
            joinedAt = joinedAt,
        )
    }

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
