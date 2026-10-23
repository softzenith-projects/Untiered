package com.interviewos.api.email

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

@ConfigurationProperties(prefix = "interviewos.email")
data class EmailProperties(
    val enabled: Boolean = false,
    val from: String = "",
    val publicBaseUrl: String = "http://localhost:3000",
    val apiBaseUrl: String = "http://localhost:8080",
    val dailyQuestionUrl: String = "",
    val contentToken: String = "",
)

@Service
class EmailService(
    private val jdbcClient: JdbcClient,
    private val userRepository: UserRepository,
) {
    @Transactional
    fun preferences(identity: SupabaseIdentity): EmailPreferencesView {
        userRepository.provision(identity)
        return readPreferences(identity.id)
    }

    @Transactional
    fun updatePreferences(
        identity: SupabaseIdentity,
        request: UpdateEmailPreferences,
    ): EmailPreferencesView {
        userRepository.provision(identity)
        jdbcClient
            .sql(
                """
                update public.email_preferences
                   set daily_question = :daily,
                       announcements = :announcements,
                       reengagement = :reengagement,
                       consented_at = case when :anyOptIn then now() else null end,
                       updated_at = now()
                 where user_id = :id
                """.trimIndent(),
            ).param("id", identity.id)
            .param("daily", request.dailyQuestion)
            .param("announcements", request.announcements)
            .param("reengagement", request.reengagement)
            .param("anyOptIn", request.dailyQuestion || request.announcements || request.reengagement)
            .update()
        cancelUnsubscribed(identity.id)
        return readPreferences(identity.id)
    }

    @Transactional
    fun unsubscribe(token: UUID) {
        val id =
            jdbcClient
                .sql(
                    """
                    update public.email_preferences
                       set daily_question = false, announcements = false, reengagement = false,
                           updated_at = now(), unsubscribe_token = gen_random_uuid()
                     where unsubscribe_token = :token
                    returning user_id
                    """.trimIndent(),
                ).param("token", token)
                .query(UUID::class.java)
                .optional()
                .orElse(null) ?: return
        cancelUnsubscribed(id)
    }

    @Transactional
    fun scheduleCampaign(
        admin: SupabaseIdentity,
        request: ScheduleEmailCampaign,
    ): UUID {
        if (request.category !in setOf("announcement", "informative")) {
            throw ApiException.badRequest("Category must be announcement or informative.")
        }
        val subject = request.subject.trim()
        val body = request.body.trim()
        if (subject.length !in 1..140 || body.length !in 1..10000 || request.scheduledAt.isBefore(Instant.now())) {
            throw ApiException.badRequest("Provide a subject, body and future schedule within the allowed lengths.")
        }
        userRepository.provision(admin)
        return jdbcClient
            .sql(
                """
                insert into public.email_campaigns (owner_user_id, category, subject, body, scheduled_at)
                values (:owner, :category, :subject, :body, :scheduled)
                returning id
                """.trimIndent(),
            ).param("owner", admin.id)
            .param("category", request.category)
            .param("subject", subject)
            .param("body", body)
            .param("scheduled", request.scheduledAt)
            .query(UUID::class.java)
            .single()
    }

    private fun readPreferences(id: UUID): EmailPreferencesView =
        jdbcClient
            .sql(
                """
                select daily_question, announcements, reengagement, consented_at
                  from public.email_preferences where user_id = :id
                """.trimIndent(),
            ).param("id", id)
            .query { rs, _ ->
                EmailPreferencesView(
                    rs.getBoolean("daily_question"),
                    rs.getBoolean("announcements"),
                    rs.getBoolean("reengagement"),
                    rs.getTimestamp("consented_at")?.toInstant(),
                )
            }.single()

    private fun cancelUnsubscribed(id: UUID) {
        jdbcClient
            .sql(
                """
                update public.email_deliveries d set status = 'cancelled'
                 where d.user_id = :id and d.status = 'pending' and d.category <> 'welcome'
                   and not exists (
                     select 1 from public.email_preferences p where p.user_id = d.user_id
                       and ((d.category = 'daily_question' and p.daily_question)
                         or (d.category in ('announcement', 'informative') and p.announcements)
                         or (d.category = 'reengagement' and p.reengagement))
                   )
                """.trimIndent(),
            ).param("id", id)
            .update()
    }
}
