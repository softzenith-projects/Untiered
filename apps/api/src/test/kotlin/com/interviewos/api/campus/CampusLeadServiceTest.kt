package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.common.TurnstileVerifier
import com.interviewos.api.email.EmailProperties
import com.interviewos.api.pool.anyArg
import com.interviewos.api.pool.eqArg
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.mockito.ArgumentMatchers.anyBoolean
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.http.HttpStatus
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/** The public lead form and the admin review, with the database and Turnstile mocked at the boundary. */
class CampusLeadServiceTest {
    private val access = mock(CampusAccess::class.java)
    private val leads = mock(LeadRepository::class.java)
    private val rateLimiter = mock(LeadRateLimiter::class.java)
    private val turnstile = mock(TurnstileVerifier::class.java)
    private val colleges = mock(CampusAdminService::class.java)
    private val onboarding = mock(CampusOnboardingService::class.java)
    private val audit = mock(CampusAudit::class.java)
    private val transactionManager = mock(PlatformTransactionManager::class.java)

    private val ip = "203.0.113.9"
    private val leadId = UUID.fromString("1e000000-0000-0000-0000-0000000000a1")
    private val adminId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(adminId, "op@untiered.tech", null)

    private fun service(
        emailEnabled: Boolean = true,
        notifyEmail: String = "leads@untiered.tech",
    ) = CampusLeadService(
        access,
        leads,
        rateLimiter,
        turnstile,
        colleges,
        onboarding,
        audit,
        EmailProperties(enabled = emailEnabled),
        CampusLeadProperties(leadNotifyEmail = notifyEmail),
        transactionManager,
    )

    private fun valid(
        email: String = "Asha.Rao@College.edu ",
        website: String? = null,
    ) = LeadRequest(
        collegeName = "  Demo   Institute of Technology ",
        city = "Pune",
        state = "Maharashtra",
        contactName = "Asha Rao",
        contactRole = "tpo",
        email = email,
        phone = "+91 98765 43210",
        approxStudents = 1200,
        message = "We would like to start with CSE 2027.",
        consentToContact = true,
        turnstileToken = "token",
        website = website,
    )

    @BeforeEach
    fun allowByDefault() {
        given(transactionManager.getTransaction(anyArg())).willReturn(SimpleTransactionStatus())
        given(rateLimiter.allowIp(anyString())).willReturn(true)
        given(rateLimiter.allowEmail(anyString())).willReturn(true)
        given(turnstile.verify(anyString(), anyString())).willReturn(true)
        given(leads.insert(anyArg(), anyBoolean())).willReturn(leadId)
    }

    @Test
    fun `a filled honeypot is accepted silently and leaves nothing behind, not even a count`() {
        service().submit(valid(website = "https://spam.example"), ip)

        verifyNoInteractions(leads, rateLimiter, turnstile)
    }

    @Test
    fun `a new lead is stored with its fields cleaned and queues one notification`() {
        service().submit(valid(), ip)

        val expected =
            LeadFields(
                collegeName = "Demo Institute of Technology",
                city = "Pune",
                state = "Maharashtra",
                contactName = "Asha Rao",
                contactRole = "tpo",
                email = "asha.rao@college.edu",
                phone = "+91 98765 43210",
                approxStudents = 1200,
                message = "We would like to start with CSE 2027.",
            )
        verify(leads).lockEmail("asha.rao@college.edu")
        verify(leads).insert(expected, true)
        verify(turnstile).verify("token", ip)
    }

    @Test
    fun `with no notify address or no SES, the lead is stored without a notification`() {
        service(notifyEmail = "").submit(valid(), ip)
        service(emailEnabled = false).submit(valid(), ip)

        verify(leads, org.mockito.Mockito.times(2)).insert(anyArg(), eqArg(false))
    }

    @Test
    fun `a repeat for the same college within 30 days merges into the open lead`() {
        val open = UUID.fromString("1e000000-0000-0000-0000-0000000000b2")
        given(leads.findOpenDuplicate("asha.rao@college.edu", "Demo Institute of Technology")).willReturn(open)

        service().submit(valid(), ip)

        verify(leads).merge(eqArg(open), anyArg())
        verify(leads, never()).insert(anyArg(), anyBoolean())
    }

    @Test
    fun `the IP limit is checked before anything else is read, and answers 429`() {
        given(rateLimiter.allowIp(ip)).willReturn(false)

        val error = assertThrows<ApiException> { service().submit(valid().copy(collegeName = null), ip) }

        assertEquals(HttpStatus.TOO_MANY_REQUESTS, error.status)
        assertEquals("rate_limited", error.code)
        verifyNoInteractions(leads, turnstile)
    }

    @Test
    fun `an unreadable address is still limited, as one shared bucket`() {
        given(turnstile.verify("token", null)).willReturn(true)

        service().submit(valid(), null)

        verify(rateLimiter).allowIp("unknown")
    }

    @Test
    fun `the email limit comes after the captcha and answers 429`() {
        given(rateLimiter.allowEmail("asha.rao@college.edu")).willReturn(false)

        val error = assertThrows<ApiException> { service().submit(valid(), ip) }

        assertEquals("rate_limited", error.code)
        verify(turnstile).verify("token", ip)
        verify(leads, never()).insert(anyArg(), anyBoolean())
    }

    @Test
    fun `a failed captcha is 400 turnstile_failed and spends no email allowance`() {
        given(turnstile.verify("token", ip)).willReturn(false)

        val error = assertThrows<ApiException> { service().submit(valid(), ip) }

        assertEquals("turnstile_failed", error.code)
        verify(rateLimiter, never()).allowEmail(anyString())
        verifyNoInteractions(leads)
    }

    @Test
    fun `a bad field is 400 lead_invalid naming the field, before the captcha is spent`() {
        val cases =
            listOf(
                "collegeName" to valid().copy(collegeName = "A"),
                "city" to valid().copy(city = " "),
                "state" to valid().copy(state = "x".repeat(121)),
                "contactName" to valid().copy(contactName = null),
                "contactRole" to valid().copy(contactRole = "principal"),
                "email" to valid(email = "not-an-email"),
                "phone" to valid().copy(phone = "call me maybe"),
                "phone" to valid().copy(phone = "1".repeat(21)),
                "approxStudents" to valid().copy(approxStudents = 0),
                "message" to valid().copy(message = "x".repeat(2001)),
                "consentToContact" to valid().copy(consentToContact = false),
            )
        for ((field, request) in cases) {
            val error = assertThrows<ApiException> { service().submit(request, ip) }
            assertEquals("lead_invalid", error.code, field)
            assertTrue(error.message.startsWith("$field:"), "${error.message} should name $field")
        }
        verifyNoInteractions(turnstile, leads)
    }

    @Test
    fun `optional fields may be left out`() {
        service().submit(valid().copy(phone = " ", approxStudents = null, message = null), ip)

        verify(leads).insert(
            LeadFields("Demo Institute of Technology", "Pune", "Maharashtra", "Asha Rao", "tpo", "asha.rao@college.edu", null, null, null),
            true,
        )
    }

    @Test
    fun `someone off the allow-list gets 404 from every admin action, and nothing is read`() {
        given(access.requirePlatformAdmin(identity)).willThrow(ApiException.notFound())

        for (action in listOf<() -> Unit>(
            { service().list(identity, null, null, null) },
            { service().get(identity, leadId) },
            { service().update(identity, leadId, UpdateLeadRequest(status = "contacted")) },
            { service().delete(identity, leadId) },
            { service().convert(identity, leadId, ConvertLeadRequest(slug = "demo")) },
        )) {
            assertEquals(HttpStatus.NOT_FOUND, assertThrows<ApiException> { action() }.status)
        }
        verifyNoInteractions(leads, colleges, onboarding)
    }

    @Test
    fun `converted is set only by convert, and a converted lead keeps its status`() {
        val admin = PlatformAdmin(adminId)
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(leads.find(admin, leadId, true)).willReturn(row(status = "new"))
        assertEquals(
            "invalid_status",
            assertThrows<ApiException> { service().update(identity, leadId, UpdateLeadRequest(status = "converted")) }.code,
        )

        given(leads.find(admin, leadId, true)).willReturn(row(status = "converted"))
        assertEquals(
            "lead_already_converted",
            assertThrows<ApiException> { service().update(identity, leadId, UpdateLeadRequest(status = "new")) }.code,
        )
        assertEquals(
            "lead_already_converted",
            assertThrows<ApiException> { service().convert(identity, leadId, ConvertLeadRequest(slug = "demo")) }.code,
        )
        verify(leads, never()).update(anyArg(), anyArg(), anyString(), anyBoolean(), anyArg())
        verifyNoInteractions(colleges, onboarding)
    }

    @Test
    fun `a status change records who made it, a notes edit does not`() {
        val admin = PlatformAdmin(adminId)
        given(access.requirePlatformAdmin(identity)).willReturn(admin)
        given(leads.find(admin, leadId, true)).willReturn(row(status = "new"))
        given(leads.find(admin, leadId, false)).willReturn(row(status = "contacted"))

        service().update(identity, leadId, UpdateLeadRequest(status = "contacted", notes = " Called on Monday "))
        verify(leads).update(admin, leadId, "contacted", true, "Called on Monday")

        service().update(identity, leadId, UpdateLeadRequest(notes = ""))
        verify(leads).update(admin, leadId, "new", false, null)

        assertEquals(
            "invalid_status",
            assertThrows<ApiException> { service().update(identity, leadId, UpdateLeadRequest(status = "spam")) }.code,
        )
    }

    private fun row(status: String) =
        LeadRow(
            id = leadId,
            status = status,
            collegeName = "Demo Institute of Technology",
            city = "Pune",
            state = "Maharashtra",
            contactName = "Asha Rao",
            contactRole = "tpo",
            email = "asha.rao@college.edu",
            phone = null,
            approxStudents = null,
            message = null,
            notes = "old",
            orgId = null,
            createdAt = Instant.parse("2026-11-14T10:00:00Z"),
            updatedAt = Instant.parse("2026-11-14T10:00:00Z"),
            statusChangedBy = null,
        )
}
