package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.pool.anyArg
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
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

/**
 * Imports and invites through the real [CampusOnboardingService], with the gate and the
 * repositories mocked. Under test: the order of refusals (401, 404, 403, then the body), the
 * contract's error codes, and that nothing is written before the caller passed the gate.
 * The SQL is exercised by [CampusOnboardingDatabaseIntegrationTest].
 */
@WebMvcTest(
    controllers = [CampusOnboardingController::class, CampusAdminInviteController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusOnboardingService::class,
)
@EnableConfigurationProperties(StorageProperties::class)
class CampusOnboardingControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var invites: InviteRepository

    @MockitoBean private lateinit var structure: StructureRepository

    @MockitoBean private lateinit var audit: CampusAudit

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "staff@college.edu", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val callerMember = UUID.fromString("0a000000-0000-0000-0000-0000000000c1")
    private val batchId = UUID.fromString("0a000000-0000-0000-0000-0000000000b1")
    private val importId = UUID.fromString("0a000000-0000-0000-0000-0000000000d1")
    private val inviteId = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")

    private fun scope(role: CampusRole) = OrgScope(orgId, userId, role, callerMember, platformAdmin = false)

    private val platformScope = OrgScope(orgId, userId, null, null, platformAdmin = true)

    private val csv =
        MockMultipartFile(
            "file",
            "students.csv",
            "text/csv",
            "name,email,roll_number,department,batch,graduation_year\nAsha,asha@college.edu,1,CSE,CSE 2027,2027\n".toByteArray(),
        )

    @Test
    fun `no token is a 401 and nothing is resolved`() {
        mockMvc.perform(multipart("/api/v1/campus/orgs/$orgId/imports").file(csv)).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/invites")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/admin/campus/orgs/$orgId/invites")).andExpect(status().isUnauthorized)

        verifyNoInteractions(access, invites, structure, audit)
    }

    @Test
    fun `someone who is not staff of the college gets 404, and nothing is read`() {
        given(access.resolve(identity, orgId)).willThrow(ApiException.notFound())
        given(access.resolveAsPlatformAdmin(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(multipart("/api/v1/campus/orgs/$orgId/imports").file(csv).with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/imports/$importId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post("/api/v1/campus/orgs/$orgId/imports/$importId/commit").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/invites").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/resend").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"a@c.edu","fullName":"A","role":"college_admin"}"""),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(invites, structure, audit)
    }

    @Test
    fun `faculty may not import or invite, and a TPO may not invite staff`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.FACULTY))
        mockMvc
            .perform(multipart("/api/v1/campus/orgs/$orgId/imports").file(csv).with(signedIn()))
            .andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))
        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    // Invalid on purpose: the permission is checked before the body is.
                    .content("""{"email":"nope"}"""),
            ).andExpect(status().isForbidden)
        mockMvc.perform(get("/api/v1/campus/orgs/$orgId/invites").with(signedIn())).andExpect(status().isForbidden)

        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.TPO))
        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"new@college.edu","fullName":"New","role":"faculty"}"""),
            ).andExpect(status().isForbidden)
            .andExpect(jsonPath("$.error").value("campus_forbidden"))

        verifyNoInteractions(invites, audit)
    }

    @Test
    fun `an upload is validated against this college and stored as a preview`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(invites.importContext(scope, setOf("asha@college.edu"), setOf("1")))
            .willReturn(
                ImportContext(setOf("CSE"), listOf(ImportBatch(batchId, "CSE 2027", "CSE", 2027)), emptySet(), emptySet(), emptySet()),
            )
        given(invites.createImport(anyArg(), anyArg())).willReturn(importId)
        given(invites.findImport(scope, importId)).willReturn(header("previewed"))
        given(invites.importRows(scope, importId))
            .willReturn(listOf(ImportRowView(1, "Asha", "asha@college.edu", "1", "CSE", "CSE 2027", 2027, emptyList())))

        mockMvc
            .perform(multipart("/api/v1/campus/orgs/$orgId/imports").file(csv).with(signedIn()))
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(importId.toString()))
            .andExpect(jsonPath("$.status").value("previewed"))
            .andExpect(jsonPath("$.summary.valid").value(1))
            .andExpect(jsonPath("$.rows[0].problems.length()").value(0))

        verify(audit).record(scope, "import.created", "import", importId, mapOf("rows" to 1, "valid" to 1))
    }

    @Test
    fun `a malformed file is a 400 csv_invalid and nothing is stored`() {
        given(access.resolve(identity, orgId)).willReturn(scope(CampusRole.COLLEGE_ADMIN))
        val bad = MockMultipartFile("file", "x.csv", "text/csv", "name,roll\nAsha,1\n".toByteArray())

        mockMvc
            .perform(multipart("/api/v1/campus/orgs/$orgId/imports").file(bad).with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("csv_invalid"))

        verify(invites, never()).createImport(anyArg(), anyArg())
    }

    @Test
    fun `committing an import that is not open is a 409, and invites nothing`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(invites.findImport(scope, importId, lock = true)).willReturn(header("committed"))

        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/imports/$importId/commit").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("import_not_open"))

        given(invites.findImport(scope, importId, lock = true)).willReturn(header("previewed", expired = true))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/imports/$importId/commit").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("import_not_open"))

        verify(invites, never()).commitImport(scope, importId)
    }

    @Test
    fun `committing an open import reports invited and skipped`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(invites.findImport(scope, importId, lock = true)).willReturn(header("previewed"))
        given(invites.importRows(scope, importId)).willReturn(
            listOf(
                ImportRowView(1, "A", "a@c.edu", null, null, "CSE 2027", null, emptyList()),
                ImportRowView(2, null, "b@c.edu", null, null, "CSE 2027", null, listOf("missing_name")),
            ),
        )
        given(invites.commitImport(scope, importId)).willReturn(1)

        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/imports/$importId/commit").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.invited").value(1))
            .andExpect(jsonPath("$.skipped").value(1))
        verify(audit).record(scope, "import.committed", "import", importId, mapOf("invited" to 1, "skipped" to 1))
    }

    @Test
    fun `discarding an import is a 204`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(invites.findImport(scope, importId, lock = true)).willReturn(header("previewed"))

        mockMvc.perform(delete("/api/v1/campus/orgs/$orgId/imports/$importId").with(signedIn())).andExpect(status().isNoContent)
        verify(invites).discardImport(scope, importId)
        verify(audit).record(scope, "import.discarded", "import", importId)
    }

    @Test
    fun `a student invite needs a batch of this college`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)

        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"s@college.edu","fullName":"S","role":"student"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("batch_required"))
        // Another college's batch is not found here.
        mockMvc
            .perform(
                post("/api/v1/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"s@college.edu","fullName":"S","role":"student","batchId":"$batchId"}"""),
            ).andExpect(status().isNotFound)

        verify(invites, never()).createInvite(anyArg(), anyArg())
    }

    @Test
    fun `a TPO invites a student, and an existing member or open invite is a 409`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(structure.findBatch(scope, batchId)).willReturn(BatchView(batchId, UUID.randomUUID(), "CSE", 2027, "CSE 2027", 0))
        val body = """{"email":" S@College.edu ","fullName":" Sita ","role":"student","batchId":"$batchId","rollNumber":"21CS7"}"""

        given(invites.isMemberEmail(scope, "s@college.edu")).willReturn(true)
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites").with(signedIn()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("already_member"))

        given(invites.isMemberEmail(scope, "s@college.edu")).willReturn(false)
        given(invites.hasOpenInvite(scope, "s@college.edu")).willReturn(true)
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites").with(signedIn()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("already_invited"))

        given(invites.hasOpenInvite(scope, "s@college.edu")).willReturn(false)
        val created = NewInvite("s@college.edu", "Sita", CampusRole.STUDENT, batchId, "21CS7")
        given(invites.createInvite(scope, created)).willReturn(inviteId)
        given(invites.findInvite(scope, inviteId)).willReturn(invite(CampusRole.STUDENT))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites").with(signedIn()).contentType(MediaType.APPLICATION_JSON).content(body))
            .andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(inviteId.toString()))
            .andExpect(jsonPath("$.status").value("invited"))
            .andExpect(jsonPath("$.sendStatus").value("pending"))
        verify(audit).record(scope, "invite.created", "invite", inviteId, mapOf("role" to "student"))
    }

    @Test
    fun `resend is refused after ten emails, and for a closed invite`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(invites.findInvite(scope, inviteId, lock = true)).willReturn(invite(CampusRole.STUDENT, sendCount = 10))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/resend").with(signedIn()))
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error").value("resend_limit"))

        given(invites.findInvite(scope, inviteId, lock = true)).willReturn(invite(CampusRole.STUDENT, stored = "joined"))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/resend").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("invite_not_open"))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/revoke").with(signedIn()))
            .andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("invite_not_open"))

        verify(invites, never()).resend(scope, inviteId)
        verify(invites, never()).revoke(scope, inviteId)
    }

    @Test
    fun `a TPO resends and revokes a student invite but not a staff one`() {
        val scope = scope(CampusRole.TPO)
        given(access.resolve(identity, orgId)).willReturn(scope)
        given(invites.findInvite(scope, inviteId, lock = true)).willReturn(invite(CampusRole.COLLEGE_ADMIN))
        mockMvc
            .perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/revoke").with(signedIn()))
            .andExpect(status().isForbidden)

        given(invites.findInvite(scope, inviteId, lock = true)).willReturn(invite(CampusRole.STUDENT))
        given(invites.findInvite(scope, inviteId)).willReturn(invite(CampusRole.STUDENT))
        given(invites.resend(scope, inviteId)).willReturn(true)
        given(invites.revoke(scope, inviteId)).willReturn(true)
        mockMvc.perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/resend").with(signedIn())).andExpect(status().isOk)
        mockMvc.perform(post("/api/v1/campus/orgs/$orgId/invites/$inviteId/revoke").with(signedIn())).andExpect(status().isOk)
        verify(audit).record(scope, "invite.resent", "invite", inviteId)
        verify(audit).record(scope, "invite.revoked", "invite", inviteId)
    }

    @Test
    fun `the invite list rejects an unknown status and passes filters through`() {
        val scope = scope(CampusRole.COLLEGE_ADMIN)
        given(access.resolve(identity, orgId)).willReturn(scope)
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/invites?status=pending").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_status"))

        given(invites.listInvites(scope, InviteFilter("expired", CampusRole.STUDENT, null, "rao"), null, 101, false))
            .willReturn(listOf(invite(CampusRole.STUDENT)))
        mockMvc
            .perform(get("/api/v1/campus/orgs/$orgId/invites?status=expired&role=student&q=rao").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items.length()").value(1))
            .andExpect(jsonPath("$.nextCursor").value(null as Any?))
    }

    @Test
    fun `a platform admin invites a college's first admin, and only admin or TPO`() {
        given(access.resolveAsPlatformAdmin(identity, orgId)).willReturn(platformScope)
        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"head@college.edu","fullName":"Head","role":"student"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_role"))

        given(invites.createInvite(platformScope, NewInvite("head@college.edu", "Head", CampusRole.COLLEGE_ADMIN, null, null)))
            .willReturn(inviteId)
        given(invites.findInvite(platformScope, inviteId)).willReturn(invite(CampusRole.COLLEGE_ADMIN))
        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs/$orgId/invites")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"email":"head@college.edu","fullName":"Head","role":"college_admin"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.role").value("college_admin"))
        verify(audit).record(platformScope, "invite.created", "invite", inviteId, mapOf("role" to "college_admin"))

        given(invites.listInvites(platformScope, InviteFilter(), null, 101, true)).willReturn(listOf(invite(CampusRole.COLLEGE_ADMIN)))
        mockMvc
            .perform(get("/api/v1/admin/campus/orgs/$orgId/invites").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].role").value("college_admin"))
        verify(audit).recordPlatformAdminRead(platformScope, "invites.viewed", "organisation", orgId)
    }

    private fun header(
        status: String,
        expired: Boolean = false,
    ): ImportHeader {
        val now = Instant.now()
        return ImportHeader(importId, status, now, if (expired) now.minusSeconds(1) else now.plus(1, ChronoUnit.DAYS))
    }

    private fun invite(
        role: CampusRole,
        sendCount: Int = 1,
        stored: String = "invited",
    ): InviteRow {
        val now = Instant.now()
        val student = role == CampusRole.STUDENT
        return InviteRow(
            view =
                InviteView(
                    id = inviteId,
                    email = "s@college.edu",
                    fullName = "Sita",
                    role = role.dbValue,
                    batchId = if (student) batchId else null,
                    batchName = if (student) "CSE 2027" else null,
                    rollNumber = null,
                    status = stored,
                    sendStatus = "pending",
                    sendCount = sendCount,
                    lastSentAt = null,
                    createdAt = now.toString(),
                    expiresAt = now.plus(14, ChronoUnit.DAYS).toString(),
                    joinedAt = null,
                ),
            role = role,
            storedStatus = stored,
            createdAt = now,
            expiresAt = now.plus(14, ChronoUnit.DAYS),
            sendCount = sendCount,
        )
    }

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
