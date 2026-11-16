package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.common.TurnstileVerifier
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.email.EmailProperties
import com.interviewos.api.pool.anyArg
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyBoolean
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
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
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.content
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.time.Instant
import java.util.UUID

const val LEAD_BODY =
    """{"collegeName":"Demo Institute","city":"Pune","state":"Maharashtra","contactName":"Asha Rao","contactRole":"tpo",
       "email":"asha@college.edu","consentToContact":true,"turnstileToken":"token","website":""}"""

/**
 * `POST /campus/leads` is the one campus route without a token; the admin routes are the
 * allow-list's only. With the campus switch off (the default here), leads stay open: they
 * have their own switch.
 */
@WebMvcTest(controllers = [CampusLeadController::class, CampusLeadAdminController::class])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusLeadService::class,
)
@EnableConfigurationProperties(EmailProperties::class, CampusLeadProperties::class)
class CampusLeadControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var leads: LeadRepository

    @MockitoBean private lateinit var rateLimiter: LeadRateLimiter

    @MockitoBean private lateinit var turnstile: TurnstileVerifier

    @MockitoBean private lateinit var colleges: CampusAdminService

    @MockitoBean private lateinit var onboarding: CampusOnboardingService

    @MockitoBean private lateinit var audit: CampusAudit

    @MockitoBean private lateinit var transactionManager: PlatformTransactionManager

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "someone@example.com", null)
    private val leadId = UUID.fromString("1e000000-0000-0000-0000-0000000000a1")

    @BeforeEach
    fun allow() {
        given(transactionManager.getTransaction(anyArg())).willReturn(SimpleTransactionStatus())
        given(rateLimiter.allowIp(anyString())).willReturn(true)
        given(rateLimiter.allowEmail(anyString())).willReturn(true)
        given(turnstile.verify(anyString(), anyString())).willReturn(true)
        given(leads.insert(anyArg(), anyBoolean())).willReturn(leadId)
    }

    @Test
    fun `the public form needs no token and answers 202, keyed on the proxy's forwarded address`() {
        mockMvc
            .perform(
                post("/api/v1/campus/leads")
                    .header("X-Forwarded-For", "10.1.1.1, 203.0.113.9")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(LEAD_BODY),
            ).andExpect(status().isAccepted)
            .andExpect(content().json("""{"received":true}""", true))

        verify(rateLimiter).allowIp("203.0.113.9")
        verify(leads).insert(anyArg(), anyBoolean())
    }

    @Test
    fun `a bot, a repeat and a new lead get the same answer`() {
        val bot = LEAD_BODY.replace(""""website":""""", """"website":"https://spam.example"""")
        val bodies =
            listOf(bot, LEAD_BODY).map {
                mockMvc
                    .perform(post("/api/v1/campus/leads").contentType(MediaType.APPLICATION_JSON).content(it))
                    .andExpect(status().isAccepted)
                    .andReturn()
                    .response.contentAsString
            }
        given(leads.findOpenDuplicate("asha@college.edu", "Demo Institute")).willReturn(leadId)
        val repeat =
            mockMvc
                .perform(post("/api/v1/campus/leads").contentType(MediaType.APPLICATION_JSON).content(LEAD_BODY))
                .andExpect(status().isAccepted)
                .andReturn()
                .response.contentAsString

        kotlin.test.assertEquals(setOf("""{"received":true}"""), (bodies + repeat).toSet())
    }

    @Test
    fun `an unreadable, empty or oversized body is 400 lead_invalid`() {
        for (body in listOf("{not json", "", """{"approxStudents":"lots"}""", """{"message":"${"x".repeat(40_000)}"}""")) {
            mockMvc
                .perform(post("/api/v1/campus/leads").contentType(MediaType.APPLICATION_JSON).content(body))
                .andExpect(status().isBadRequest)
                .andExpect(jsonPath("$.error").value("lead_invalid"))
        }
        verifyNoInteractions(leads)
    }

    @Test
    fun `too many submissions is 429 rate_limited`() {
        given(rateLimiter.allowIp(anyString())).willReturn(false)

        mockMvc
            .perform(post("/api/v1/campus/leads").contentType(MediaType.APPLICATION_JSON).content(LEAD_BODY))
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error").value("rate_limited"))
    }

    @Test
    fun `only POST on exactly that path is open`() {
        mockMvc.perform(get("/api/v1/campus/leads")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/v1/campus/leads/$leadId")).andExpect(status().isUnauthorized)
        mockMvc.perform(get("/api/v1/admin/campus/leads")).andExpect(status().isUnauthorized)
        mockMvc.perform(post("/api/v1/admin/campus/leads/$leadId/convert")).andExpect(status().isUnauthorized)
        verifyNoInteractions(access, leads)
    }

    @Test
    fun `a signed-in non-admin gets 404 on every admin route`() {
        given(access.requirePlatformAdmin(identity)).willThrow(ApiException.notFound())

        mockMvc.perform(get("/api/v1/admin/campus/leads").with(signedIn())).andExpect(status().isNotFound)
        mockMvc.perform(get("/api/v1/admin/campus/leads/$leadId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(
                patch("/api/v1/admin/campus/leads/$leadId")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"status":"contacted"}"""),
            ).andExpect(status().isNotFound)
        mockMvc.perform(delete("/api/v1/admin/campus/leads/$leadId").with(signedIn())).andExpect(status().isNotFound)
        mockMvc
            .perform(
                post("/api/v1/admin/campus/leads/$leadId/convert")
                    .with(signedIn())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"name":"Demo","slug":"demo"}"""),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(leads, colleges, onboarding)
    }

    @Test
    fun `an admin lists leads newest first and deletes one`() {
        val admin = PlatformAdmin(userId)
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(leads.list(admin, "new", "demo", null, CampusCursor.PAGE_SIZE + 1)).willReturn(listOf(row()))
        given(leads.delete(admin, leadId)).willReturn(true)

        mockMvc
            .perform(get("/api/v1/admin/campus/leads?status=new&q=demo").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.items[0].id").value(leadId.toString()))
            .andExpect(jsonPath("$.items[0].phone").value("+91 98765 43210"))
            .andExpect(jsonPath("$.nextCursor").doesNotExist())
        mockMvc.perform(delete("/api/v1/admin/campus/leads/$leadId").with(signedIn())).andExpect(status().isNoContent)
        mockMvc
            .perform(get("/api/v1/admin/campus/leads?status=spam").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("invalid_status"))
    }

    private fun row() =
        LeadRow(
            id = leadId,
            status = "new",
            collegeName = "Demo Institute",
            city = "Pune",
            state = "Maharashtra",
            contactName = "Asha Rao",
            contactRole = "tpo",
            email = "asha@college.edu",
            phone = "+91 98765 43210",
            approxStudents = 900,
            message = null,
            notes = null,
            orgId = null,
            createdAt = Instant.parse("2026-11-14T10:00:00Z"),
            updatedAt = Instant.parse("2026-11-14T10:00:00Z"),
            statusChangedBy = null,
        )

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}

/** With `campus-leads` off, the public form and the admin routes are closed. */
@WebMvcTest(
    controllers = [CampusLeadController::class, CampusLeadAdminController::class],
    properties = ["interviewos.features.campus-leads=false", "interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
)
class CampusLeadSwitchOffTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var service: CampusLeadService

    @Test
    fun `every lead route answers 404 and nothing runs`() {
        mockMvc
            .perform(post("/api/v1/campus/leads").contentType(MediaType.APPLICATION_JSON).content(LEAD_BODY))
            .andExpect(status().isNotFound)
        mockMvc
            .perform(
                get("/api/v1/admin/campus/leads").with(
                    jwt().jwt { builder: Jwt.Builder -> builder.subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11") },
                ),
            ).andExpect(status().isNotFound)

        verifyNoInteractions(service)
    }
}
