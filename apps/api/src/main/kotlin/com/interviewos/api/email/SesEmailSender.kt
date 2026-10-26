package com.interviewos.api.email

import jakarta.mail.Session
import jakarta.mail.internet.MimeMessage
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.stereotype.Component
import software.amazon.awssdk.auth.credentials.DefaultCredentialsProvider
import software.amazon.awssdk.core.SdkBytes
import software.amazon.awssdk.regions.Region
import software.amazon.awssdk.services.sesv2.SesV2Client
import software.amazon.awssdk.services.sesv2.model.Destination
import software.amazon.awssdk.services.sesv2.model.EmailContent
import software.amazon.awssdk.services.sesv2.model.RawMessage
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest
import java.io.ByteArrayOutputStream
import java.time.Duration
import java.util.Properties

@Configuration
class SesClientConfig {
    @Bean(destroyMethod = "close")
    fun sesV2Client(properties: EmailProperties): SesV2Client {
        if (properties.enabled) {
            require(properties.awsRegion == "ap-southeast-2") { "SES must use ap-southeast-2" }
            require(properties.from == "noreply@untiered.tech") { "SES_FROM_EMAIL must be noreply@untiered.tech" }
        }
        return SesV2Client
            .builder()
            .region(Region.of(properties.awsRegion))
            .credentialsProvider(DefaultCredentialsProvider.builder().build())
            // A timeout after SES accepts a message is ambiguous. Only the outbox retries
            // explicit transient service responses; the SDK must not retry on its own.
            .overrideConfiguration {
                it.retryStrategy { retry -> retry.maxAttempts(1) }
                it.apiCallTimeout(Duration.ofSeconds(20))
                it.apiCallAttemptTimeout(Duration.ofSeconds(15))
            }.build()
    }
}

/** Transport for account-owned mail. The scheduled outbox calls this off the HTTP path. */
@Component
class SesEmailSender(
    private val client: SesV2Client,
    private val properties: EmailProperties,
) {
    fun send(
        address: String,
        category: String,
        subject: String,
        body: String,
        unsubscribeToken: String,
    ) {
        val mime = MimeMessage(Session.getInstance(Properties()))
        val helper = MimeMessageHelper(mime, true, "UTF-8")
        helper.setFrom(properties.from)
        helper.setReplyTo(properties.replyTo)
        helper.setTo(address)
        helper.setSubject(subject)
        val accountLink =
            "${properties.publicBaseUrl.trimEnd('/')}/${if (category == "daily_question") "daily-challenge" else "dashboard"}"
        val safeAccountLink = escapeHtml(accountLink)
        val preferencesLink = "${properties.publicBaseUrl.trimEnd('/')}/profile#account"
        val unsubscribePage = "${properties.publicBaseUrl.trimEnd('/')}/unsubscribe?token=$unsubscribeToken"
        val text =
            buildString {
                appendLine(body)
                appendLine()
                appendLine("Your account: $accountLink")
                if (category != "welcome") {
                    appendLine("Manage emails: $preferencesLink")
                    appendLine("Unsubscribe: $unsubscribePage")
                }
            }
        val footer =
            if (category == "welcome") {
                "Welcome aboard."
            } else {
                "<a href=\"${escapeHtml(preferencesLink)}\">Manage email preferences</a> · " +
                    "<a href=\"${escapeHtml(unsubscribePage)}\">Unsubscribe</a>"
            }
        val html =
            """
            <!doctype html>
            <html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="margin:0;background:#f3f7ff;padding:20px 8px">
              <main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#fff;border:1px solid #d8e3f2;border-radius:16px;color:#17315a;line-height:1.6">
                <p style="font-size:14px;font-weight:800;letter-spacing:.12em;color:#1865db">UNTIERED</p>
                <h1 style="font-size:28px;line-height:1.2">${escapeHtml(subject)}</h1>
                <p style="font-size:16px;white-space:pre-wrap">${escapeHtml(body)}</p>
                <p><a href="$safeAccountLink" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1865db;color:#fff;text-decoration:none;font-weight:700">Visit your account</a></p>
                <p style="margin-top:32px;border-top:1px solid #d8e3f2;padding-top:16px;font-size:13px;color:#5b6d89">$footer</p>
              </main>
            </body></html>
            """.trimIndent()
        helper.setText(text, html)
        if (category != "welcome") {
            mime.setHeader("List-Unsubscribe", "<${properties.apiBaseUrl.trimEnd('/')}/api/v1/email/unsubscribe/$unsubscribeToken>")
            mime.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
        }
        mime.saveChanges()
        val bytes = ByteArrayOutputStream().also(mime::writeTo).toByteArray()
        client.sendEmail(
            SendEmailRequest
                .builder()
                .fromEmailAddress(properties.from)
                .destination(Destination.builder().toAddresses(address).build())
                .content(EmailContent.builder().raw(RawMessage.builder().data(SdkBytes.fromByteArray(bytes)).build()).build())
                .build(),
        )
    }
}

private fun escapeHtml(value: String): String =
    value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
