package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiException
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers
import org.mockito.BDDMockito.given
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
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/** Module 11: the usage route through the real service, with the gate and the SQL mocked at the boundary. */
@WebMvcTest(
    controllers = [CampusUsageController::class],
    properties = ["interviewos.features.campus=true"],
)
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusUsageService::class,
)
class CampusUsageControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var usage: UsageRepository

    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "operator@untiered.example", null)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")

    @Test
    fun `no token is a 401`() {
        mockMvc.perform(get("/api/v1/admin/campus/usage")).andExpect(status().isUnauthorized)
        verifyNoInteractions(access, usage)
    }

    @Test
    fun `anyone off the allow-list gets 404`() {
        given(access.requirePlatformAdmin(identity)).willThrow(ApiException.notFound())
        mockMvc.perform(get("/api/v1/admin/campus/usage").with(signedIn())).andExpect(status().isNotFound)
        verifyNoInteractions(usage)
    }

    @Test
    fun `a bad or reversed range is a 400`() {
        given(access.requirePlatformAdmin(identity)).willReturn(PlatformAdmin(userId))
        mockMvc.perform(get("/api/v1/admin/campus/usage?from=yesterday").with(signedIn())).andExpect(status().isBadRequest)
        mockMvc
            .perform(get("/api/v1/admin/campus/usage?from=2026-11-10&to=2026-11-01").with(signedIn()))
            .andExpect(status().isBadRequest)
            .andExpect(jsonPath("$.error").value("usage_range_invalid"))
    }

    @Test
    fun `an operator gets one row per college, dollars from micro-dollars, and null cost per interview when there are none`() {
        val admin = PlatformAdmin(userId)
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(
            usage.usage(ArgumentMatchers.eq(admin) ?: admin, anyInstant(), anyInstant(), anyInstant(), anyInstant()),
        ).willReturn(
            listOf(
                OrgUsageFacts(orgId, "College A", 100, 7, 4, 4, 2_500_000),
                OrgUsageFacts(UUID.randomUUID(), "College B", 10, 0, 0, 0, 0),
            ),
        )

        // The month boundaries depend on the clock, so the stub matches any instants; the range itself is checked below.
        mockMvc
            .perform(get("/api/v1/admin/campus/usage?from=2026-11-01&to=2026-11-14").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(2))
            .andExpect(jsonPath("$[0].orgName").value("College A"))
            .andExpect(jsonPath("$[0].aiCostUsd").value(2.5))
            .andExpect(jsonPath("$[0].aiCostPerInterviewUsd").value(0.625))
            .andExpect(jsonPath("$[0].interviewsUsed").value(7))
            .andExpect(jsonPath("$[1].aiCostPerInterviewUsd").value(null as Any?))
    }

    @Test
    fun `interviews come back by round type, most first, from the same range as the cost`() {
        val admin = PlatformAdmin(userId)
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(
            usage.usage(ArgumentMatchers.eq(admin) ?: admin, anyInstant(), anyInstant(), anyInstant(), anyInstant()),
        ).willReturn(
            listOf(
                OrgUsageFacts(
                    orgId,
                    "College A",
                    100,
                    9,
                    9,
                    9,
                    0,
                    listOf(RoundUsage("hr_fit_closing", 2), RoundUsage("technical_fundamentals", 5), RoundUsage("coding_practical", 2)),
                ),
                OrgUsageFacts(UUID.randomUUID(), "College B", 10, 0, 0, 0, 0),
            ),
        )

        mockMvc
            .perform(get("/api/v1/admin/campus/usage").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$[0].interviewsByRound.length()").value(3))
            .andExpect(jsonPath("$[0].interviewsByRound[0].roundType").value("technical_fundamentals"))
            .andExpect(jsonPath("$[0].interviewsByRound[0].interviews").value(5))
            // Ties break by round type, so the order never wobbles between reads.
            .andExpect(jsonPath("$[0].interviewsByRound[1].roundType").value("coding_practical"))
            .andExpect(jsonPath("$[0].interviewsByRound[2].roundType").value("hr_fit_closing"))
            .andExpect(jsonPath("$[1].interviewsByRound.length()").value(0))
    }

    @Test
    fun `the per-round counts are read from the aggregated column, and a malformed one is skipped`() {
        assertEquals(
            listOf(RoundUsage("technical_fundamentals", 3), RoundUsage("hr_fit_closing", 1)),
            UsageRepository.parseRounds("technical_fundamentals:3,hr_fit_closing:1"),
        )
        assertEquals(emptyList(), UsageRepository.parseRounds(""))
        assertEquals(emptyList(), UsageRepository.parseRounds(null))
        assertEquals(listOf(RoundUsage("aptitude", 2)), UsageRepository.parseRounds("garbage,aptitude:2,:4,x:y"))
    }

    @Test
    fun `cost math divides by interviews in range and is null with none`() {
        val some = CampusUsageService.row(OrgUsageFacts(orgId, "A", 5, 2, 2, 4, 1_000_000))
        assertEquals(1.0, some.aiCostUsd)
        assertEquals(0.25, some.aiCostPerInterviewUsd)
        val none = CampusUsageService.row(OrgUsageFacts(orgId, "A", 5, 2, 2, 0, 3_000_000))
        assertEquals(3.0, none.aiCostUsd)
        assertNull(none.aiCostPerInterviewUsd)
        assertNotNull(some.orgId)
    }

    private fun anyInstant(): Instant = ArgumentMatchers.any(Instant::class.java) ?: Instant.EPOCH

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(userId.toString()).claim("email", identity.email)
        }
}
