package com.interviewos.api.campus

import com.interviewos.api.email.EmailProperties
import com.interviewos.api.email.SesEmailSender
import com.interviewos.api.pool.anyArg
import com.interviewos.api.pool.eqArg
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyBoolean
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willAnswer
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import software.amazon.awssdk.awscore.exception.AwsErrorDetails
import software.amazon.awssdk.services.sesv2.model.SesV2Exception
import java.security.MessageDigest
import java.time.Instant
import java.util.Base64
import java.util.UUID
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** The invite email job, with the repository and SES mocked at the boundary. */
class CampusInviteEmailJobTest {
    private val repository = mock(InviteRepository::class.java)
    private val sender = mock(SesEmailSender::class.java)
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val inviteId = UUID.fromString("0a000000-0000-0000-0000-0000000000e1")
    private val enabled = EmailProperties(enabled = true, publicBaseUrl = "https://untiered.tech/")

    private fun invite(attempts: Int = 1) =
        SendableInvite(
            id = inviteId,
            orgId = orgId,
            orgName = "Demo College",
            email = "rao@college.edu",
            fullName = "Asha Rao",
            role = CampusRole.STUDENT,
            expiresAt = Instant.parse("2026-11-27T10:00:00Z"),
            attempts = attempts,
        )

    @Test
    fun `nothing is sent, and invites stay pending, while SES is not configured`() {
        CampusInviteEmailJob(repository, EmailProperties(enabled = false), sender).dispatch()

        verifyNoInteractions(repository, sender)
    }

    @Test
    fun `the emailed link carries the token whose hash is stored, and nothing else is stored`() {
        given(repository.claimPendingSends(CampusInviteEmailJob.BATCH)).willReturn(listOf(orgId to inviteId))
        var stored: ByteArray? = null
        given(repository.rotateForSend(anyArg(), anyArg(), anyArg())).willAnswer { call ->
            stored = call.getArgument(2)
            invite()
        }
        val sent = mutableListOf<List<String>>()
        willAnswer { call -> sent += (0..4).map { call.getArgument<String>(it) } }
            .given(sender)
            .sendTransactional(anyString(), anyString(), anyString(), anyString(), anyString())

        CampusInviteEmailJob(repository, enabled, sender).dispatch()

        val (address, subject, body, label, link) = sent.single()
        assertEquals("rao@college.edu", address)
        assertEquals("Join Demo College on Untiered", subject)
        assertEquals("Join Demo College", label)
        assertTrue(link.startsWith("https://untiered.tech/campus/join?token="), link)
        val token = link.substringAfter("token=")
        assertEquals(43, token.length)
        assertEquals(32, Base64.getUrlDecoder().decode(token).size)
        val expected = MessageDigest.getInstance("SHA-256").digest(token.toByteArray(Charsets.US_ASCII))
        assertContentEquals(expected, stored)
        assertFalse(body.contains(token), "the token is only in the link")
        verify(repository).markSent(eqArg(orgId), eqArg(inviteId), anyArg())
    }

    @Test
    fun `a throttled send is retried later, an ambiguous one is not`() {
        given(repository.claimPendingSends(CampusInviteEmailJob.BATCH)).willReturn(listOf(orgId to inviteId))
        given(repository.rotateForSend(anyArg(), anyArg(), anyArg())).willReturn(invite(attempts = 1))
        val throttled =
            SesV2Exception
                .builder()
                .statusCode(429)
                .awsErrorDetails(AwsErrorDetails.builder().errorCode("TooManyRequestsException").build())
                .build()
        willThrow(throttled).given(sender).sendTransactional(anyString(), anyString(), anyString(), anyString(), anyString())

        CampusInviteEmailJob(repository, enabled, sender).dispatch()
        verify(repository).markSendFailed(anyArg(), anyArg(), anyArg(), eqArg(true), anyLong(), anyString())

        val repository2 = mock(InviteRepository::class.java)
        given(repository2.claimPendingSends(CampusInviteEmailJob.BATCH)).willReturn(listOf(orgId to inviteId))
        given(repository2.rotateForSend(anyArg(), anyArg(), anyArg())).willReturn(invite(attempts = 1))
        val sender2 = mock(SesEmailSender::class.java)
        willThrow(
            RuntimeException("timeout"),
        ).given(sender2).sendTransactional(anyString(), anyString(), anyString(), anyString(), anyString())

        CampusInviteEmailJob(repository2, enabled, sender2).dispatch()
        verify(repository2).markSendFailed(
            anyArg(),
            anyArg(),
            anyArg(),
            eqArg(false),
            eqArg(0L),
            eqArg("ses_permanent_or_ambiguous"),
        )
        verify(repository2, never()).markSent(anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `a claim lost to a resend or revoke sends nothing`() {
        given(repository.claimPendingSends(CampusInviteEmailJob.BATCH)).willReturn(listOf(orgId to inviteId))

        CampusInviteEmailJob(repository, enabled, sender).dispatch()

        verifyNoInteractions(sender)
        verify(repository, never()).markSendFailed(anyArg(), anyArg(), anyArg(), anyBoolean(), anyLong(), anyString())
    }

    @Test
    fun `the email names the college, says what Untiered is, the expiry, and that it can be ignored`() {
        val message = CampusInviteEmailJob.message(invite())

        assertEquals("Join Demo College on Untiered", message.subject)
        assertTrue(message.body.contains("Demo College has invited you to join them on Untiered as a student."))
        assertTrue(message.body.contains("Untiered is a place to practise job interviews"))
        assertTrue(message.body.contains("until 27 November 2026"))
        assertTrue(message.body.contains("you can ignore it"))
    }

    @Test
    fun `tokens are 32 random bytes in base64url, hashed with SHA-256`() {
        val a = InviteTokens.generate()
        val b = InviteTokens.generate()
        assertTrue(InviteTokens.isWellFormed(a) && InviteTokens.isWellFormed(b))
        assertTrue(a != b)
        assertEquals(32, InviteTokens.hash(a).size)
        assertFalse(InviteTokens.isWellFormed("short"))
        assertFalse(InviteTokens.isWellFormed("a".repeat(42) + "="))
    }

    @Test
    fun `the invited email is masked to its first letter and domain`() {
        assertEquals("r***@college.edu", CampusJoinService.maskEmail("rao@college.edu"))
        assertEquals("r***@college.edu", CampusJoinService.maskEmail("r@college.edu"))
    }
}
