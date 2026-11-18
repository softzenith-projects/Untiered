package com.interviewos.api.email

import com.interviewos.api.config.ProductFeatureProperties
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import software.amazon.awssdk.awscore.exception.AwsServiceException
import software.amazon.awssdk.services.sesv2.model.SesV2Exception
import java.time.LocalDate
import java.time.LocalTime
import java.time.ZoneId
import kotlin.random.Random

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
    val attemptCount: Int,
    val allowed: Boolean,
    val active: Boolean,
)

@Component
class LifecycleEmailJob(
    private val jdbcClient: JdbcClient,
    private val properties: EmailProperties,
    private val restClientBuilder: RestClient.Builder,
    private val sender: SesEmailSender,
    private val features: ProductFeatureProperties = ProductFeatureProperties(),
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
                .onFailure { log.warn("Could not queue daily question email for {} ({})", date, it.javaClass.simpleName) }
            queueRetention()
        }
        queueCampaigns()
    }

    /** One row every two seconds per API instance. Keep deployment replicas within the SES quota. */
    @Scheduled(initialDelay = 90_000, fixedDelay = 2_000)
    fun dispatch() {
        if (!properties.enabled) return
        jdbcClient
            .sql(
                "update public.email_deliveries set status = 'failed', error_code = 'interrupted' where status = 'sending' and claimed_at < now() - interval '5 minutes'",
            ).update()
        jdbcClient
            .sql(
                """
                update public.email_deliveries set status = 'cancelled'
                 where status = 'pending'
                   and ((category = 'welcome' and created_at < now() - interval '2 days')
                     or (category = 'daily_question' and dedupe_key <> :today)
                     or (category like 'campus\_%' and not :campus))
                """.trimIndent(),
            ).param("today", "daily-question-${LocalDate.now(india)}")
            .param("campus", features.campus)
            .update()
        val id =
            jdbcClient
                .sql(
                    """
                    with next as (
                      select id from public.email_deliveries
                       where status = 'pending' and next_attempt_at <= now()
                      order by next_attempt_at, id for update skip locked limit 1
                    )
                    update public.email_deliveries d
                       set status = 'sending', attempt_count = attempt_count + 1, claimed_at = now()
                    from next where d.id = next.id returning d.id
                    """.trimIndent(),
                ).query(Long::class.java)
                .optional()
                .orElse(null) ?: return
        val pending =
            jdbcClient
                .sql(
                    """
                    select d.id, u.email, d.category, d.dedupe_key, d.subject, d.body, d.attempt_count,
                           p.unsubscribe_token::text,
                           (d.category = 'welcome'
                             or (d.category = 'daily_question' and p.daily_question)
                             or (d.category in ('announcement', 'informative') and p.announcements)
                             or d.category in ('campus_assignment', 'campus_billing')
                             or (d.category in ('campus_reminder', 'campus_report_ready', 'campus_weekly') and p.campus_reminders)
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
                        rs.getInt("attempt_count"),
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
            sender.send(pending.address, pending.category, pending.subject, pending.body, pending.unsubscribeToken)
            jdbcClient
                .sql("update public.email_deliveries set status = 'sent', sent_at = now() where id = :id")
                .param("id", id)
                .update()
        } catch (cause: Exception) {
            // SDK client timeouts may occur after acceptance: never retry ambiguous results.
            // Exception messages can contain addresses or content, so log only a safe class and row ID.
            val retry = cause is SesV2Exception && isTransientSesFailure(cause)
            log.error("Email delivery {} failed ({}); retryable={}", id, cause.javaClass.simpleName, retry)
            val delaySeconds = if (retry) retryDelaySeconds(pending.attemptCount) else 0L
            jdbcClient
                .sql(
                    """
                    update public.email_deliveries
                       set status = case when :retry and attempt_count < 3 then 'pending' else 'failed' end,
                           next_attempt_at = now() + (:delay * interval '1 second'),
                           error_code = :code
                     where id = :id
                    """.trimIndent(),
                ).param("id", id)
                .param("retry", retry)
                .param("delay", delaySeconds)
                .param("code", if (retry) "ses_transient" else "ses_permanent_or_ambiguous")
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
}

internal fun isTransientSesStatus(status: Int): Boolean = status == 429 || status in 500..504

internal fun isTransientSesFailure(cause: AwsServiceException): Boolean =
    isTransientSesStatus(cause.statusCode()) ||
        cause.awsErrorDetails()?.errorCode() in setOf("ThrottlingException", "TooManyRequestsException")

internal fun retryDelaySeconds(
    attemptCount: Int,
    random: Random = Random.Default,
): Long {
    require(attemptCount in 1..3)
    val base = 30L shl (attemptCount - 1)
    return base + random.nextLong(base + 1)
}
