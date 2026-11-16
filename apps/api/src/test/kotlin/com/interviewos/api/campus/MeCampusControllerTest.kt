package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
private val identity = SupabaseIdentity(userId, "student@college.edu", null)

private fun signedIn() =
    jwt().jwt { builder: Jwt.Builder ->
        builder.subject(userId.toString()).claim("email", identity.email)
    }

/** `/me/campus`: the caller's own college context, by their verified user id only. */
@WebMvcTest(controllers = [MeCampusController::class], properties = ["interviewos.features.campus=true"])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    MeCampusService::class,
    OrgLogos::class,
)
@EnableConfigurationProperties(StorageProperties::class)
class MeCampusControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var members: MemberRepository

    @MockitoBean private lateinit var audit: CampusAudit

    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")
    private val memberId = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")

    @Test
    fun `someone in no college gets an empty context, not an error`() {
        mockMvc
            .perform(get("/api/v1/me/campus").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.student").value(null as Any?))
            .andExpect(jsonPath("$.staff.length()").value(0))
    }

    @Test
    fun `a student sees their college and batch, and staff their roles`() {
        given(members.ownStudentMembership(userId))
            .willReturn(OwnStudentMembership(orgId, "Demo College", null, batchId, "CSE 2027", "21CS001"))
        given(members.ownStaffMemberships(userId)).willReturn(listOf(OwnStaffMembership(orgId, "Demo College", null, "tpo")))

        mockMvc
            .perform(get("/api/v1/me/campus").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.student.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.student.batchName").value("CSE 2027"))
            .andExpect(jsonPath("$.student.rollNumber").value("21CS001"))
            .andExpect(jsonPath("$.staff[0].role").value("tpo"))
    }

    @Test
    fun `leaving needs a student membership, and is audited`() {
        mockMvc.perform(post("/api/v1/me/campus/leave").with(signedIn())).andExpect(status().isNotFound)
        verifyNoInteractions(audit)

        val scope = OrgScope(orgId, userId, CampusRole.STUDENT, memberId, platformAdmin = false)
        given(access.resolveOwnStudentMembership(identity)).willReturn(scope)
        given(members.leave(scope)).willReturn(true)

        mockMvc.perform(post("/api/v1/me/campus/leave").with(signedIn())).andExpect(status().isNoContent)
        verify(audit).record(scope, "member.left", "member", memberId)
    }

    @Test
    fun `no token is a 401`() {
        mockMvc.perform(get("/api/v1/me/campus")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/v1/me/campus/leave")).andExpect(status().isUnauthorized)
        verifyNoInteractions(access, members, audit)
    }
}

/** With the switch at its default (off), the whole campus surface answers 404. */
@WebMvcTest(controllers = [MeCampusController::class])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    MeCampusService::class,
    OrgLogos::class,
)
@EnableConfigurationProperties(StorageProperties::class)
class CampusSwitchedOffControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var members: MemberRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @Test
    fun `campus routes are not found while the feature is off`() {
        mockMvc.perform(get("/api/v1/me/campus").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post("/api/v1/me/campus/leave").with(signedIn())).andExpect(status().isNotFound)
        verifyNoInteractions(access, members, audit)
    }
}
