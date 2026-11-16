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
        val isWelcome = category == "welcome"
        val accountLink = "${properties.publicBaseUrl.trimEnd('/')}/${accountPath(category)}"
        // A new-assignment email is an instruction from the student's college, not a
        // subscription: it has no unsubscribe, only a link to the preferences that govern the rest.
        val transactional = isWelcome || category == "campus_assignment"
        val safeAccountLink = escapeHtml(accountLink)
        val safeLogoUrl = escapeHtml("${properties.publicBaseUrl.trimEnd('/')}/brand/wordmark-light.png")
        val preferencesLink = "${properties.publicBaseUrl.trimEnd('/')}/profile#account"
        val unsubscribePage = "${properties.publicBaseUrl.trimEnd('/')}/unsubscribe?token=$unsubscribeToken"
        val text =
            buildString {
                appendLine(body)
                appendLine()
                appendLine("${if (isWelcome) "Start practising" else "Your account"}: $accountLink")
                if (!isWelcome) appendLine("Manage emails: $preferencesLink")
                if (!transactional) appendLine("Unsubscribe: $unsubscribePage")
            }
        val footer =
            if (isWelcome) {
                "Talent has no tiers. No tiers attached."
            } else if (category == "campus_assignment") {
                "<a href=\"${escapeHtml(preferencesLink)}\">Manage email preferences</a>"
            } else {
                "<a href=\"${escapeHtml(preferencesLink)}\">Manage email preferences</a> · " +
                    "<a href=\"${escapeHtml(unsubscribePage)}\">Unsubscribe</a>"
            }
        val header =
            if (isWelcome) {
                """
                <div style="text-align:center;padding-bottom:24px;border-bottom:1px solid #e5e7ef;margin-bottom:28px">
                  <img src="$safeLogoUrl" alt="Untiered" width="230" style="display:block;width:230px;max-width:80%;height:auto;margin:auto">
                </div>
                <p style="display:inline-block;margin:0 0 14px;padding:6px 12px;border-radius:999px;background:#f0ebff;color:#6948e8;font-size:11px;font-weight:800;letter-spacing:.12em">TALENT HAS NO TIERS</p>
                """.trimIndent()
            } else {
                "<p style=\"font-size:14px;font-weight:800;letter-spacing:.12em;color:#1865db\">UNTIERED</p>"
            }
        val buttonLabel = if (isWelcome) "Start practising →" else escapeHtml(accountLabel(category))
        val buttonColor = if (isWelcome) "#6948e8" else "#1865db"
        val footerAlignment = if (isWelcome) "center" else "left"
        val html =
            """
            <!doctype html>
            <html lang="en"><head><meta name="viewport" content="width=device-width, initial-scale=1"></head>
            <body style="margin:0;background:#f3f7ff;padding:20px 8px">
              <main style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px 24px;background:#fff;border:1px solid #e5e7ef;border-radius:16px;color:#25304a;line-height:1.7">
                $header
                <h1 style="font-size:28px;line-height:1.2">${escapeHtml(subject)}</h1>
                <p style="font-size:16px;white-space:pre-line">${escapeHtml(body)}</p>
                <p style="text-align:center;margin:28px 0"><a href="$safeAccountLink" style="display:inline-block;padding:13px 22px;border-radius:10px;background:$buttonColor;color:#fff;text-decoration:none;font-weight:700">$buttonLabel</a></p>
                <p style="margin-top:32px;border-top:1px solid #e5e7ef;padding-top:16px;text-align:$footerAlignment;font-size:13px;color:#68738a">$footer</p>
              </main>
            </body></html>
            """.trimIndent()
        helper.setText(text, html)
        if (!transactional) {
            mime.setHeader("List-Unsubscribe", "<${properties.apiBaseUrl.trimEnd('/')}/api/v1/email/unsubscribe/$unsubscribeToken>")
            mime.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
        }
        deliver(mime, address)
    }

    /**
     * A one-off transactional email to someone who may have no account yet � a college
     * invite. No account link and no unsubscribe footer: there is no account or preference to
     * point at, and the message is the invitation itself. [body] is plain text; [actionUrl] is
     * the single button.
     */
    fun sendTransactional(
        address: String,
        subject: String,
        body: String,
        actionLabel: String,
        actionUrl: String,
    ) {
        val mime = MimeMessage(Session.getInstance(Properties()))
        val helper = MimeMessageHelper(mime, true, "UTF-8")
        helper.setFrom(properties.from)
        helper.setReplyTo(properties.replyTo)
        helper.setTo(address)
        helper.setSubject(subject)
        val text =
            buildString {
                appendLine(body)
                appendLine()
                appendLine("$actionLabel: $actionUrl")
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
                <p><a href="${escapeHtml(
                actionUrl,
            )}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1865db;color:#fff;text-decoration:none;font-weight:700">${escapeHtml(
                actionLabel,
            )}</a></p>
                <p style="font-size:13px;color:#5b6d89;word-break:break-all">${escapeHtml(actionUrl)}</p>
              </main>
            </body></html>
            """.trimIndent()
        helper.setText(text, html)
        deliver(mime, address)
    }

    private fun accountPath(category: String): String =
        when (category) {
            "daily_question" -> "daily-challenge"
            "campus_weekly" -> "campus"
            else -> "dashboard"
        }

    private fun accountLabel(category: String): String = if (category == "campus_weekly") "Open Untiered Campus" else "Visit your account"

    private fun deliver(
        mime: MimeMessage,
        address: String,
    ) {
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
