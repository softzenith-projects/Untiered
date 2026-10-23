package com.interviewos.api.email

import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.mail.javamail.JavaMailSender
import org.springframework.mail.javamail.MimeMessageHelper
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId

data class DailyQuestionEmailContent(
    val prompt: String,
    val options: List<String>,
    val context: String? = null,
) {
    fun asText(url: String): String =
        buildString {
            appendLine("Today's Question of the Day")
            appendLine()
            if (!context.isNullOrBlank()) {
                appendLine(context)
                appendLine()
            }
            appendLine(prompt)
            options.forEachIndexed { index, option -> appendLine("${'A' + index}. $option") }
            appendLine()
            appendLine("Choose your answer in your account: $url")
        }
}

private data class PendingEmail(
    val id: Long,
    val address: String,
    val category: String,
    val dedupeKey: String,
    val subject: String,
    val body: String,
    val unsubscribeToken: String,
    val allowed: Boolean,
    val active: Boolean,
)

@Component
class LifecycleEmailJob(
    private val jdbcClient: JdbcClient,
    private val properties: EmailProperties,
    private val restClientBuilder: RestClient.Builder,
    private val senderProvider: ObjectProvider<JavaMailSender>,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val india = ZoneId.of("Asia/Kolkata")

    /** Retry content acquisition during the day; the unique key permits only one daily send. */
    @Scheduled(initialDelay = 60_000, fixedDelay = 900_000)
    fun queueScheduled() {
        if (!properties.enabled) return
        if (LocalTime.now(india).hour >= 9) {
            val date = LocalDate.now(india)
            runCatching { queueDaily(date) }
                .onFailure { log.warn("Could not queue daily question email for {}", date, it) }
            queueRetention()
        }
        queueCampaigns()
    }

    /** One claimed row at a time keeps SES's initial sending rate under control. */
    @Scheduled(initialDelay = 90_000, fixedDelay = 2_000)
    fun dispatch() {
        if (!properties.enabled) return
        jdbcClient
            .sql(
                """
                update public.email_deliveries set status = 'cancelled'
                 where status = 'pending'
                   and ((category = 'welcome' and created_at < now() - interval '2 days')
                     or (category = 'daily_question' and dedupe_key <> :today))
                """.trimIndent(),
            ).param("today", "daily-question-${LocalDate.now(india)}")
            .update()
        val id =
            jdbcClient
                .sql(
                    """
                    with next as (
                      select id from public.email_deliveries where status = 'pending'
                      order by id for update skip locked limit 1
                    )
                    update public.email_deliveries d set status = 'sending'
                    from next where d.id = next.id returning d.id
                    """.trimIndent(),
                ).query(Long::class.java)
                .optional()
                .orElse(null) ?: return
        val pending =
            jdbcClient
                .sql(
                    """
                    select d.id, u.email, d.category, d.dedupe_key, d.subject, d.body,
                           p.unsubscribe_token::text,
                           (d.category = 'welcome'
                             or (d.category = 'daily_question' and p.daily_question)
                             or (d.category in ('announcement', 'informative') and p.announcements)
                             or (d.category = 'reengagement' and p.reengagement)) as allowed,
                           (d.category <> 'reengagement'
                             or (d.dedupe_key = 'reengagement-7' and u.last_seen_at < now() - interval '7 days')
                             or (d.dedupe_key = 'reengagement-21' and u.last_seen_at < now() - interval '21 days')) as active
                      from public.email_deliveries d
                      join public.users u on u.id = d.user_id
                      join public.email_preferences p on p.user_id = d.user_id
                     where d.id = :id
                    """.trimIndent(),
                ).param("id", id)
                .query { rs, _ ->
                    PendingEmail(
                        rs.getLong("id"),
                        rs.getString("email"),
                        rs.getString("category"),
                        rs.getString("dedupe_key"),
                        rs.getString("subject"),
                        rs.getString("body"),
                        rs.getString("unsubscribe_token"),
                        rs.getBoolean("allowed"),
                        rs.getBoolean("active"),
                    )
                }.optional()
                .orElse(null) ?: return
        if (!pending.allowed || !pending.active) {
            jdbcClient
                .sql("update public.email_deliveries set status = 'cancelled' where id = :id")
                .param("id", id)
                .update()
            return
        }
        try {
            send(pending)
            jdbcClient
                .sql("update public.email_deliveries set status = 'sent', sent_at = now() where id = :id")
                .param("id", id)
                .update()
        } catch (cause: Exception) {
            // SMTP can fail after accepting a message. Never retry automatically and risk a duplicate.
            // Mail exceptions can contain the recipient address. Keep it out of logs and Sentry.
            log.error("Email delivery {} needs review ({})", id, cause.javaClass.simpleName)
            jdbcClient
                .sql("update public.email_deliveries set status = 'failed', error_code = 'smtp_error' where id = :id")
                .param("id", id)
                .update()
        }
    }

    private fun queueDaily(date: LocalDate) {
        if (properties.dailyQuestionUrl.isBlank() || properties.contentToken.isBlank()) return
        val content =
            restClientBuilder
                .build()
                .get()
                .uri("${properties.dailyQuestionUrl}?date=$date")
                .header("Authorization", "Bearer ${properties.contentToken}")
                .retrieve()
                .body(DailyQuestionEmailContent::class.java) ?: return
        require(content.prompt.isNotBlank() && content.options.size in 3..5)
        val url = "${properties.publicBaseUrl.trimEnd('/')}/daily-challenge"
        jdbcClient
            .sql(
                """
                insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                select p.user_id, :key, 'daily_question', 'Your question for today', :body
                  from public.email_preferences p where p.daily_question
                on conflict (user_id, dedupe_key) do nothing
                """.trimIndent(),
            ).param("key", "daily-question-$date")
            .param("body", content.asText(url))
            .update()
    }

    private fun queueRetention() {
        for (days in listOf(7, 21)) {
            jdbcClient
                .sql(
                    """
                    insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                    select p.user_id, :key, 'reengagement', 'Your next practice session is ready',
                           'It has been a while since your last visit. Pick up a course, try today''s question, or start a mock interview when you are ready.'
                      from public.email_preferences p
                      join public.users u on u.id = p.user_id
                     where p.reengagement and u.last_seen_at < now() - (:days * interval '1 day')
                       and (:days = 21 or u.last_seen_at >= now() - interval '21 days')
                    on conflict (user_id, dedupe_key) do nothing
                    """.trimIndent(),
                ).param("key", "reengagement-$days")
                .param("days", days)
                .update()
        }
    }

    private fun queueCampaigns() {
        val campaigns =
            jdbcClient
                .sql(
                    """
                    select id, category, subject, body from public.email_campaigns
                     where scheduled_at <= now() and queued_at is null order by scheduled_at limit 10
                    """.trimIndent(),
                ).query { rs, _ ->
                    listOf(rs.getString("id"), rs.getString("category"), rs.getString("subject"), rs.getString("body"))
                }.list()
        for ((id, category, subject, body) in campaigns) {
            jdbcClient
                .sql(
                    """
                    insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                    select p.user_id, :key, :category, :subject, :body
                      from public.email_preferences p where p.announcements
                    on conflict (user_id, dedupe_key) do nothing
                    """.trimIndent(),
                ).param("key", "campaign-$id")
                .param("category", category)
                .param("subject", subject)
                .param("body", body)
                .update()
            jdbcClient
                .sql("update public.email_campaigns set queued_at = now() where id = :id and queued_at is null")
                .param("id", java.util.UUID.fromString(id))
                .update()
        }
    }

    private fun send(delivery: PendingEmail) {
        require(properties.from.isNotBlank()) { "EMAIL_FROM is required when email sending is enabled" }
        val sender = senderProvider.getIfAvailable() ?: error("MAIL_HOST is required when email sending is enabled")
        val mime = sender.createMimeMessage()
        val helper = MimeMessageHelper(mime, true, "UTF-8")
        helper.setFrom(properties.from)
        helper.setTo(delivery.address)
        helper.setSubject(delivery.subject)
        val accountLink =
            "${properties.publicBaseUrl.trimEnd('/')}/${if (delivery.category == "daily_question") "daily-challenge" else "dashboard"}"
        val preferencesLink = "${properties.publicBaseUrl.trimEnd('/')}/profile#account"
        val unsubscribe = "${properties.apiBaseUrl.trimEnd('/')}/api/v1/email/unsubscribe/${delivery.unsubscribeToken}"
        val text =
            buildString {
                appendLine(delivery.body)
                appendLine()
                appendLine("Your account: $accountLink")
                if (delivery.category != "welcome") {
                    appendLine("Manage emails: $preferencesLink")
                    appendLine("Unsubscribe: ${properties.publicBaseUrl.trimEnd('/')}/unsubscribe?token=${delivery.unsubscribeToken}")
                }
            }
        val unsubscribePage = "${properties.publicBaseUrl.trimEnd('/')}/unsubscribe?token=${delivery.unsubscribeToken}"
        val footer =
            if (delivery.category == "welcome") {
                "Welcome aboard."
            } else {
                "<a href=\"${escapeHtml(preferencesLink)}\">Manage email preferences</a> · " +
                    "<a href=\"${escapeHtml(unsubscribePage)}\">Unsubscribe</a>"
            }
        val html =
            """
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;padding:32px;color:#17315a;line-height:1.6">
              <p style="font-size:14px;font-weight:800;letter-spacing:.12em;color:#1865db">UNTIERED</p>
              <h1 style="font-size:28px;line-height:1.2">${escapeHtml(delivery.subject)}</h1>
              <p style="font-size:16px;white-space:pre-wrap">${escapeHtml(delivery.body)}</p>
              <p><a href="${escapeHtml(
                accountLink,
            )}" style="display:inline-block;padding:12px 20px;border-radius:10px;background:#1865db;color:#fff;text-decoration:none;font-weight:700">Visit your account</a></p>
              <p style="margin-top:32px;border-top:1px solid #d8e3f2;padding-top:16px;font-size:13px;color:#5b6d89">$footer</p>
            </div>
            """.trimIndent()
        helper.setText(text, html)
        if (delivery.category != "welcome") {
            mime.setHeader("List-Unsubscribe", "<$unsubscribe>")
            mime.setHeader("List-Unsubscribe-Post", "List-Unsubscribe=One-Click")
        }
        sender.send(mime)
    }
}

private fun escapeHtml(value: String): String =
    value
        .replace("&", "&amp;")
        .replace("<", "&lt;")
        .replace(">", "&gt;")
        .replace("\"", "&quot;")
