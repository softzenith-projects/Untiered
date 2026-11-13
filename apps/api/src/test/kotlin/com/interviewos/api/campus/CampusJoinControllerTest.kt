package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.pool.anyArg
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Opening and accepting an invite link, through the real [CampusJoinService] with the
 * repositories mocked. Every refusal code of the contract, in order, and that a refused
 * accept writes nothing. The single-use race is in [CampusOnboardingDatabaseIntegrationTest].
 */
@WebMvcTest(controllers = [CampusJoinController::class], properties = ["interviewos.features.campus=true"])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusJoinService::class,
    MeCampusService::class,
    OrgLogos::class,
)
@EnableConfigurationProperties(StorageProperties::class)
class CampusJoinControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var invites: InviteRepository

    @MockitoBean private lateinit var notifications: CampusNotifications

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var users: UserRepository

    @MockitoBean private lateinit var members: MemberRepository

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "Rao@College.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")
    private val inviteId = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")
    private val memberId = UUID.fromString("0a000000-0000-0000-0000-0000000000c9")
    private val token = InviteTokens.generate()
    private val future: Instant = Instant.now().plus(10, ChronoUnit.DAYS)

    private val agreed = """{"consentVersion":"campus-2026-11-13","agreeDataSharing":true,"agreeAiEvaluation":true}"""

    private fun invite(
        role: CampusRole = CampusRole.STUDENT,
        email: String = "rao@college.edu",
        status: String = "invited",
        expiresAt: Instant = future,
        orgActive: Boolean = true,
        rollNumber: String? = "21CS001",
    ) = TokenInvite(
        id = inviteId,
        orgId = orgId,
        orgName = "Demo College",
        orgActive = orgActive,
        logoPath = null,
        role = role,
        batchId = if (role == CampusRole.STUDENT) batchId else null,
        batchName = if (role == CampusRole.STUDENT) "CSE 2027" else null,
        email = email,
        rollNumber = rollNumber,
        status = status,
        expiresAt = expiresAt,
    )

    private fun stub(
        invite: TokenInvite,
        lock: Boolean,
    ) {
        given(invites.findByTokenHash(anyArg(), org.mockito.ArgumentMatchers.eq(lock))).willReturn(invite)
    }

    private fun accept(body: String = agreed) =
        mockMvc.perform(
            post("/api/v1/campus/invites/$token/accept").with(signedIn()).contentType(MediaType.APPLICATION_JSON).content(body),
        )

    @Test
    fun `no token is a 401`() {
        mockMvc.perform(get("/api/v1/campus/invites/$token")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/v1/campus/invites/$token/accept")).andExpect(status().isUnauthorized)
        verifyNoInteractions(invites, audit, users)
    }

    @Test
    fun `the preview shows the college, a masked invited email and the server's consent copy`() {
        stub(invite(), lock = false)

        mockMvc
            .perform(get("/api/v1/campus/invites/$token").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.orgName").value("Demo College"))
            .andExpect(jsonPath("$.role").value("student"))
            .andExpect(jsonPath("$.batchName").value("CSE 2027"))
            .andExpect(jsonPath("$.invitedEmailMasked").value("r***@college.edu"))
            .andExpect(jsonPath("$.signedInEmail").value("rao@college.edu"))
            .andExpect(jsonPath("$.emailMatches").value(true))
            .andExpect(jsonPath("$.consentVersion").value("campus-2026-11-13"))
            .andExpect(jsonPath("$.shared.length()").value(CampusJoinService.SHARED.size))
            .andExpect(jsonPath("$.notShared[1]").value("Your resume file."))
            .andExpect(jsonPath("$.aiNotice").value(CampusJoinService.AI_NOTICE))
    }

    @Test
    fun `an unknown, malformed, expired, revoked, used or suspended invite is the same 404`() {
        fun expectNotFound(path: String = "/api/v1/campus/invites/$token") =
            mockMvc
                .perform(get(path).with(signedIn()))
                .andExpect(status().isNotFound)
                .andExpect(jsonPath("$.error").value("invite_not_found"))

        expectNotFound()
        expectNotFound("/api/v1/campus/invites/not-a-token")
        for (closed in listOf(
            invite(expiresAt = Instant.now().minusSeconds(1)),
            invite(status = "revoked"),
            invite(status = "joined"),
            invite(status = "expired"),
            invite(orgActive = false),
        )) {
            stub(closed, lock = false)
            expectNotFound()
            stub(closed, lock = true)
            accept().andExpect(status().isNotFound).andExpect(jsonPath("$.error").value("invite_not_found"))
        }
        verify(invites, never()).insertMembership(anyArg(), anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `a student must agree to both statements, of the current version`() {
        stub(invite(), lock = true)

        accept("""{"consentVersion":"campus-2026-11-13","agreeDataSharing":true,"agreeAiEvaluation":false}""")
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("consent_required"))
        accept("""{"agreeDataSharing":true,"agreeAiEvaluation":true}""")
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("consent_required"))
        accept("""{"consentVersion":"campus-2026-01-01","agreeDataSharing":true,"agreeAiEvaluation":true}""")
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("consent_version_stale"))

        verify(invites, never()).insertMembership(anyArg(), anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `a different signed-in email needs an explicit confirmation`() {
        stub(invite(email = "21cs001@college.edu"), lock = true)
        given(invites.insertMembership(anyArg(), anyArg(), anyArg(), anyArg())).willReturn(memberId)
        given(invites.markJoined(anyArg(), anyArg())).willReturn(true)
        given(access.resolveOwnStudentMembership(identity)).willReturn(studentScope())

        accept().andExpect(status().isConflict).andExpect(jsonPath("$.error").value("email_mismatch_unconfirmed"))
        verify(invites, never()).insertMembership(anyArg(), anyArg(), anyArg(), anyArg())

        accept(agreed.dropLast(1) + ""","confirmDifferentEmail":true}""").andExpect(status().isOk)
        verify(invites).insertMembership(invite(email = "21cs001@college.edu"), userId, "21CS001", "campus-2026-11-13")
    }

    @Test
    fun `already a member here, or a student elsewhere, is refused`() {
        stub(invite(), lock = true)
        given(invites.isJoinedIn(orgId, userId)).willReturn(true)
        accept().andExpect(status().isConflict).andExpect(jsonPath("$.error").value("already_member"))

        given(invites.isJoinedIn(orgId, userId)).willReturn(false)
        given(invites.isStudentAnywhere(userId)).willReturn(true)
        accept().andExpect(status().isConflict).andExpect(jsonPath("$.error").value("already_in_college"))

        verify(invites, never()).insertMembership(anyArg(), anyArg(), anyArg(), anyArg())
        verifyNoInteractions(audit)
    }

    @Test
    fun `a student joins with consent recorded, and gets their campus context back`() {
        stub(invite(), lock = true)
        given(invites.insertMembership(anyArg(), anyArg(), anyArg(), anyArg())).willReturn(memberId)
        given(invites.markJoined(anyArg(), anyArg())).willReturn(true)
        val scope = studentScope()
        given(access.resolveOwnStudentMembership(identity)).willReturn(scope)
        given(members.ownStudentMembership(userId))
            .willReturn(OwnStudentMembership(orgId, "Demo College", null, batchId, "CSE 2027", "21CS001"))

        accept()
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.joinedOrgId").value(orgId.toString()))
            .andExpect(jsonPath("$.student.orgId").value(orgId.toString()))
            .andExpect(jsonPath("$.staff.length()").value(0))

        verify(users).provision(identity)
        verify(invites).insertMembership(invite(), userId, "21CS001", "campus-2026-11-13")
        verify(invites).markJoined(invite(), memberId)
        verify(audit).record(
            scope,
            "member.joined",
            "member",
            memberId,
            mapOf("inviteId" to inviteId, "role" to "student", "emailMatched" to true, "rollNumberDropped" to false),
        )
    }

    @Test
    fun `a roll number taken since the invite is dropped rather than blocking the join`() {
        stub(invite(), lock = true)
        given(invites.rollNumberHeld(orgId, "21CS001")).willReturn(true)
        given(invites.insertMembership(anyArg(), anyArg(), anyArg(), anyArg())).willReturn(memberId)
        given(invites.markJoined(anyArg(), anyArg())).willReturn(true)
        given(access.resolveOwnStudentMembership(identity)).willReturn(studentScope())

        accept().andExpect(status().isOk)
        verify(invites).insertMembership(invite(), userId, null, "campus-2026-11-13")
    }

    @Test
    fun `a staff invite ignores the agree flags and records no consent`() {
        stub(invite(role = CampusRole.TPO, rollNumber = null), lock = true)
        given(invites.insertMembership(anyArg(), anyArg(), anyArg(), anyArg())).willReturn(memberId)
        given(invites.markJoined(anyArg(), anyArg())).willReturn(true)
        given(access.resolve(identity, orgId)).willReturn(OrgScope(orgId, userId, CampusRole.TPO, memberId, platformAdmin = false))

        accept("""{"agreeDataSharing":false}""").andExpect(status().isOk).andExpect(jsonPath("$.joinedOrgId").value(orgId.toString()))
        verify(invites).insertMembership(invite(role = CampusRole.TPO, rollNumber = null), userId, null, null)
        verify(invites, never()).isStudentAnywhere(userId)
    }

    private fun studentScope() = OrgScope(orgId, userId, CampusRole.STUDENT, memberId, platformAdmin = false)

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
