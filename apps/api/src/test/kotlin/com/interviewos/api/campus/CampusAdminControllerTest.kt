package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mockingDetails
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.HttpMethod
import org.springframework.http.MediaType
import org.springframework.mock.web.MockMultipartFile
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** `/admin/campus/orgs`: onboarding colleges, for the platform-admin allow-list only. */
@WebMvcTest(
    controllers = [CampusAdminController::class],
    properties = ["interviewos.features.campus=true", "interviewos.storage.supabase-url=https://project.supabase.co"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusAdminService::class,
    OrgLogos::class,
)
@EnableConfigurationProperties(StorageProperties::class)
class CampusAdminControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var orgs: OrganisationRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var storage: ObjectStorage

    @MockitoBean private lateinit var transactionManager: PlatformTransactionManager

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "op@untiered.tech", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val admin = PlatformAdmin(userId)
    private val adminScope = OrgScope(orgId, userId, null, null, platformAdmin = true)

    @Test
    fun `someone off the allow-list gets 404 on every admin route`() {
        given(access.requirePlatformAdmin(identity)).willThrow(ApiException.notFound())
        given(access.resolveAsPlatformAdmin(identity, orgId)).willThrow(ApiException.notFound())

        mockMvc.perform(get("/api/v1/admin/campus/orgs").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/v1/admin/campus/orgs/$orgId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"Demo College","slug":"demo-college"}"""),
            ).andExpect(status().isNotFound)
        mockMvc
            .perform(multipart(HttpMethod.PUT, "/api/v1/admin/campus/orgs/$orgId/logo").file(png()).with(signedIn()))
            .andExpect(status().isNotFound)

        verifyNoInteractions(orgs, audit, storage)
    }

    @Test
    fun `no token is a 401`() {
        mockMvc.perform(get("/api/v1/admin/campus/orgs")).andExpect(status().isUnauthorized)
        verifyNoInteractions(access, orgs)
    }

    @Test
    fun `an admin lists colleges with their member counts`() {
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(orgs.listAll(admin)).willReturn(listOf(orgRow(logoPath = "$orgId/logo-${UUID.randomUUID()}.png")))

        mockMvc
            .perform(get("/api/v1/admin/campus/orgs").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].id").value(orgId.toString()))
            .andExpect(jsonPath("$[0].staffCount").value(2))
            .andExpect(jsonPath("$[0].studentCount").value(40))
            .andExpect(
                jsonPath("$[0].logoUrl").value(
                    org.hamcrest.Matchers.startsWith("https://project.supabase.co/storage/v1/object/public/org-logos/$orgId/"),
                ),
            )
    }

    @Test
    fun `an admin creates a college and it is audited`() {
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        val fields = OrgFields("Demo College", "Pune", null, null, null, null, 50, "active")
        given(orgs.create(admin, "demo-college", fields)).willReturn(orgId)
        given(access.resolveAsPlatformAdmin(identity, orgId)).willReturn(adminScope)
        given(orgs.find(adminScope)).willReturn(orgRow())

        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":" Demo College ","slug":"Demo-College","city":"Pune","interviewAllowance":50}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.id").value(orgId.toString()))

        verify(audit).record(adminScope, "org.created", "organisation", orgId)
    }

    @Test
    fun `a taken slug is a 409 and a bad one a 400`() {
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(orgs.create(admin, "demo-college", OrgFields("Demo College", null, null, null, null, null, 0, "active")))
            .willReturn(null)

        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"Demo College","slug":"demo-college"}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.error").value("slug_taken"))
        mockMvc
            .perform(
                post("/api/v1/admin/campus/orgs")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"Demo College","slug":"-x"}"""),
            ).andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_slug"))
    }

    @Test
    fun `reading one college is audited as a platform admin read`() {
        given(access.resolveAsPlatformAdmin(identity, orgId)).willReturn(adminScope)
        given(orgs.find(adminScope)).willReturn(orgRow())

        mockMvc
            .perform(get("/api/v1/admin/campus/orgs/$orgId").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.staffCount").value(2))

        verify(audit).record(adminScope, "org.viewed", "organisation", orgId)
    }

    @Test
    fun `a logo must really be an image`() {
        given(access.resolveAsPlatformAdmin(identity, orgId)).willReturn(adminScope)
        val svg = MockMultipartFile("file", "logo.png", "image/png", "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".toByteArray())

        mockMvc
            .perform(multipart(HttpMethod.PUT, "/api/v1/admin/campus/orgs/$orgId/logo").file(svg).with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("unsupported_logo_type"))

        val big = MockMultipartFile("file", "logo.png", "image/png", ByteArray(OrgLogos.MAX_BYTES + 1))
        mockMvc
            .perform(multipart(HttpMethod.PUT, "/api/v1/admin/campus/orgs/$orgId/logo").file(big).with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("logo_too_large"))

        verifyNoInteractions(storage)
    }

    @Test
    fun `a png logo is stored in the public logo bucket under the college's folder`() {
        given(access.resolveAsPlatformAdmin(identity, orgId)).willReturn(adminScope)
        given(orgs.find(adminScope)).willReturn(orgRow())
        given(transactionManager.getTransaction(org.mockito.ArgumentMatchers.any())).willReturn(SimpleTransactionStatus())

        mockMvc
            .perform(multipart(HttpMethod.PUT, "/api/v1/admin/campus/orgs/$orgId/logo").file(png()).with(signedIn()))
            .andExpect(status().isOk)

        // Inspected rather than matched: Mockito's matchers return null into Kotlin's non-null parameters.
        val upload = mockingDetails(storage).invocations.single { it.method.name == "upload" }.arguments
        assertEquals("org-logos", upload[0])
        val path = upload[1] as String
        assertTrue(path.startsWith("$orgId/logo-") && path.endsWith(".png"), path)
        assertEquals("image/png", upload[3])
        val replaced = mockingDetails(orgs).invocations.single { it.method.name == "replaceLogoPath" }.arguments
        assertEquals(listOf<Any>(adminScope, path), replaced.toList())
        verify(audit).record(adminScope, "org.logo_updated", "organisation", orgId)
    }

    private fun png() =
        MockMultipartFile(
            "file",
            "logo.png",
            "image/png",
            byteArrayOf(0x89.toByte(), 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A, 1, 2, 3),
        )

    private fun orgRow(logoPath: String? = null) =
        OrgRow(
            id = orgId,
            name = "Demo College",
            slug = "demo-college",
            city = "Pune",
            state = null,
            logoPath = logoPath,
            contactName = null,
            contactEmail = null,
            contactPhone = null,
            status = "active",
            interviewAllowance = 50,
            createdAt = Instant.parse("2026-11-13T10:00:00Z"),
            staffCount = 2,
            studentCount = 40,
        )

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
