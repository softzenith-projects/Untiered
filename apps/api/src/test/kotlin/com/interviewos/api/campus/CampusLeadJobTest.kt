package com.interviewos.api.campus

import com.interviewos.api.email.EmailProperties
import com.interviewos.api.email.SesEmailSender
import com.interviewos.api.pool.anyArg
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import java.util.UUID
import kotlin.test.assertContains
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The lead notification and purge job, plus the small helpers the public form relies on. */
class CampusLeadJobTest {
    private val leads = mock(LeadRepository::class.java)
    private val rateLimiter = mock(LeadRateLimiter::class.java)
    private val sender = mock(SesEmailSender::class.java)
    private val leadId = UUID.fromString("1e000000-0000-0000-0000-0000000000a1")
    private val notice = LeadNotice(leadId, "Demo Institute of Technology", "Pune", "Asha Rao", "tpo")

    private fun job(
        enabled: Boolean = true,
        notify: String = "leads@untiered.tech",
    ) = CampusLeadJob(
        leads,
        rateLimiter,
        EmailProperties(enabled = enabled, publicBaseUrl = "https://untiered.tech/"),
        CampusLeadProperties(leadNotifyEmail = notify),
        sender,
    )

    @Test
    fun `the notification names the college, city and contact, links to the lead, and carries no phone or message`() {
        given(leads.claimNotices(CampusLeadJob.BATCH)).willReturn(listOf(notice))

        job().notifyNewLeads()

        val message = CampusLeadJob.message(notice)
        verify(sender).sendTransactional(
            "leads@untiered.tech",
            "New college lead: Demo Institute of Technology",
            message.body,
            "Open the lead",
            "https://untiered.tech/admin/campus/leads/$leadId",
        )
        assertContains(message.body, "College: Demo Institute of Technology")
        assertContains(message.body, "City: Pune")
        assertContains(message.body, "Contact: Asha Rao, placement officer (TPO)")
        // LeadNotice has no phone or message to carry: the claim query does not read them.
        assertEquals(
            listOf("id", "collegeName", "city", "contactName", "contactRole"),
            LeadNotice::class.java.declaredFields
                .map { it.name }
                .filter { it != "Companion" },
        )
        assertFalse(message.body.contains("+91"))
    }

    @Test
    fun `nothing is claimed or sent without SES or a notify address`() {
        job(enabled = false).notifyNewLeads()
        job(notify = " ").notifyNewLeads()

        verifyNoInteractions(leads, sender)
    }

    @Test
    fun `a failed send is marked failed and not retried`() {
        given(leads.claimNotices(CampusLeadJob.BATCH)).willReturn(listOf(notice))
        willThrow(RuntimeException("boom"))
            .given(sender)
            .sendTransactional(anyString(), anyString(), anyString(), anyString(), anyString())

        job().notifyNewLeads()

        verify(leads).markNoticeFailed(leadId)
    }

    @Test
    fun `the purge deletes old not-a-fit leads and stale buckets`() {
        job(enabled = false).purge()

        verify(leads).purgeNotAFit()
        verify(rateLimiter).purgeStale()
        verify(sender, never()).sendTransactional(anyArg(), anyArg(), anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `the client address is the proxy's last forwarded hop, and only behind a private peer`() {
        // Behind Caddy: the peer is private, the last hop is the client. Earlier hops are the client's own words.
        assertEquals("203.0.113.9", ClientIp.resolve("172.18.0.3", "10.0.0.1, 198.51.100.7, 203.0.113.9"))
        assertEquals("203.0.113.9", ClientIp.resolve("127.0.0.1", " 203.0.113.9 "))
        // Exposed directly: a forwarded header is ignored.
        assertEquals("198.51.100.7", ClientIp.resolve("198.51.100.7", "203.0.113.9"))
        // A header that is not an address falls back to the peer, and never triggers a lookup.
        assertEquals("172.18.0.3", ClientIp.resolve("172.18.0.3", "evil.example.com"))
        assertEquals("172.18.0.3", ClientIp.resolve("172.18.0.3", "999.1.1.1"))
        assertEquals("172.18.0.3", ClientIp.resolve("172.18.0.3", ".:1"))
        // IPv6 is bucketed per /64.
        assertEquals("20010db8000000aa::/64", ClientIp.resolve("2001:db8:0:aa::1", null))
        assertEquals(ClientIp.resolve("2001:db8:0:aa::1", null), ClientIp.resolve("2001:db8:0:aa:ffff::2", null))
        assertNull(ClientIp.resolve(null, "203.0.113.9"))
    }

    @Test
    fun `rate-limit keys are salted hashes, distinct per kind and salt, and never the value itself`() {
        val jdbc = mock(org.springframework.jdbc.core.simple.JdbcClient::class.java)
        val one = LeadRateLimiter(jdbc, CampusLeadProperties(leadHashSalt = "salt-one"))
        val two = LeadRateLimiter(jdbc, CampusLeadProperties(leadHashSalt = "salt-two"))

        val hash = one.hash(LeadRateLimiter.KIND_IP, "203.0.113.9")
        assertEquals(32, hash.size)
        assertFalse(String(hash, Charsets.ISO_8859_1).contains("203.0.113.9"))
        assertFalse(hash.contentEquals(two.hash(LeadRateLimiter.KIND_IP, "203.0.113.9")))
        assertFalse(hash.contentEquals(one.hash(LeadRateLimiter.KIND_EMAIL, "203.0.113.9")))
        assertTrue(hash.contentEquals(one.hash(LeadRateLimiter.KIND_IP, "203.0.113.9")))
    }
}
