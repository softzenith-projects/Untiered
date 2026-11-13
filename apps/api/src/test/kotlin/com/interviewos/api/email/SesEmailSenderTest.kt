package com.interviewos.api.email

import jakarta.mail.Multipart
import jakarta.mail.Part
import jakarta.mail.Session
import jakarta.mail.internet.MimeMessage
import org.junit.jupiter.api.Test
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import software.amazon.awssdk.awscore.exception.AwsErrorDetails
import software.amazon.awssdk.services.sesv2.SesV2Client
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest
import software.amazon.awssdk.services.sesv2.model.SesV2Exception
import java.io.ByteArrayInputStream
import java.util.Properties
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class SesEmailSenderTest {
    @Test
    fun `a transactional email has its one button and no account or unsubscribe links`() {
        val client = mock(SesV2Client::class.java)
        val properties = EmailProperties(publicBaseUrl = "https://untiered.tech", apiBaseUrl = "https://api.untiered.tech")
        SesEmailSender(client, properties).sendTransactional(
            "student@college.edu",
            "Join Demo <College> on Untiered",
            "Demo College has invited you.",
            "Join Demo College",
            "https://untiered.tech/campus/join?token=abc&x=1",
        )

        val request = ArgumentCaptor.forClass(SendEmailRequest::class.java)
        verify(client).sendEmail(request.capture())
        assertEquals(listOf("student@college.edu"), request.value.destination().toAddresses())
        val mime =
            MimeMessage(
                Session.getInstance(Properties()),
                ByteArrayInputStream(
                    request.value
                        .content()
                        .raw()
                        .data()
                        .asByteArray(),
                ),
            )
        assertEquals("Join Demo <College> on Untiered", mime.subject)
        assertEquals(null, mime.getHeader("List-Unsubscribe"))
        val parts = mutableMapOf<String, String>()
        collectParts(mime, parts)
        assertTrue(parts.getValue("text/plain").contains("Join Demo College: https://untiered.tech/campus/join?token=abc&x=1"))
        assertTrue(parts.getValue("text/html").contains("href=\"https://untiered.tech/campus/join?token=abc&amp;x=1\""))
        assertFalse(parts.getValue("text/html").contains("unsubscribe"))
        assertFalse(parts.getValue("text/plain").contains("Your account"))
    }

    @Test
    fun `sends branded multipart email through SES with backend sender and reply to`() {
        val client = mock(SesV2Client::class.java)
        val properties = EmailProperties(publicBaseUrl = "https://untiered.tech", apiBaseUrl = "https://api.untiered.tech")
        SesEmailSender(client, properties).send(
            "candidate@example.invalid",
            "announcement",
            "New <course>",
            "Practise <today>",
            "76fef956-645d-4d0d-98a7-2c921689374d",
        )

        val request = ArgumentCaptor.forClass(SendEmailRequest::class.java)
        verify(client).sendEmail(request.capture())
        assertEquals("noreply@untiered.tech", request.value.fromEmailAddress())
        assertEquals(listOf("candidate@example.invalid"), request.value.destination().toAddresses())
        val mime =
            MimeMessage(
                Session.getInstance(Properties()),
                ByteArrayInputStream(
                    request.value
                        .content()
                        .raw()
                        .data()
                        .asByteArray(),
                ),
            )
        assertEquals("help@untiered.tech", mime.replyTo.single().toString())
        assertEquals("New <course>", mime.subject)
        assertTrue(mime.getHeader("List-Unsubscribe", null).contains("api.untiered.tech"))
        val parts = mutableMapOf<String, String>()
        collectParts(mime, parts)
        assertTrue(parts.getValue("text/plain").contains("Practise <today>"))
        assertTrue(parts.getValue("text/html").contains("Practise &lt;today&gt;"))
        assertTrue(parts.getValue("text/html").contains("name=\"viewport\""))
    }

    @Test
    fun `welcome has no marketing unsubscribe header`() {
        val client = mock(SesV2Client::class.java)
        SesEmailSender(client, EmailProperties()).send("candidate@example.invalid", "welcome", "Welcome", "Ready", "ignored")
        val request = ArgumentCaptor.forClass(SendEmailRequest::class.java)
        verify(client).sendEmail(request.capture())
        val mime =
            MimeMessage(
                Session.getInstance(Properties()),
                ByteArrayInputStream(
                    request.value
                        .content()
                        .raw()
                        .data()
                        .asByteArray(),
                ),
            )
        assertEquals(null, mime.getHeader("List-Unsubscribe", null))
    }

    @Test
    fun `production sender configuration rejects wrong region and identity`() {
        assertFailsWith<IllegalArgumentException> {
            SesClientConfig().sesV2Client(EmailProperties(enabled = true, awsRegion = "us-east-1"))
        }
        assertFailsWith<IllegalArgumentException> {
            SesClientConfig().sesV2Client(EmailProperties(enabled = true, from = "someone@example.invalid"))
        }
    }

    @Test
    fun `only explicit transient SES responses are retryable with increasing bounded delay`() {
        assertTrue(isTransientSesStatus(429))
        assertTrue(isTransientSesStatus(503))
        assertFalse(isTransientSesStatus(400))
        assertFalse(isTransientSesStatus(403))
        assertFalse(isTransientSesStatus(404))
        assertTrue(
            isTransientSesFailure(
                SesV2Exception
                    .builder()
                    .statusCode(400)
                    .awsErrorDetails(AwsErrorDetails.builder().errorCode("ThrottlingException").build())
                    .build(),
            ),
        )
        val first = retryDelaySeconds(1, kotlin.random.Random(1))
        val second = retryDelaySeconds(2, kotlin.random.Random(1))
        val third = retryDelaySeconds(3, kotlin.random.Random(1))
        assertTrue(first in 30..60)
        assertTrue(second in 60..120)
        assertTrue(third in 120..240)
    }

    private fun collectParts(
        part: Part,
        parts: MutableMap<String, String>,
    ) {
        when (val content = part.content) {
            is Multipart -> {
                repeat(content.count) { collectParts(content.getBodyPart(it), parts) }
            }

            is String -> {
                if (part.isMimeType("text/plain")) parts["text/plain"] = content
                if (part.isMimeType("text/html")) parts["text/html"] = content
            }
        }
    }
}
