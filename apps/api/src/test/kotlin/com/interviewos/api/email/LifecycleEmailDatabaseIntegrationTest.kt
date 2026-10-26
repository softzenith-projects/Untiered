package com.interviewos.api.email

import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.mockito.ArgumentMatchers.any
import org.mockito.Mockito.mock
import org.mockito.Mockito.`when`
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.web.client.RestClient
import software.amazon.awssdk.services.sesv2.SesV2Client
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest
import software.amazon.awssdk.services.sesv2.model.SendEmailResponse
import software.amazon.awssdk.services.sesv2.model.SesV2Exception
import java.util.UUID
import kotlin.test.assertEquals

/** Exercises the signup trigger, consent default, and account-deletion cascade on migrated PostgreSQL. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class LifecycleEmailDatabaseIntegrationTest {
    private val userId = UUID.randomUUID()
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from auth.users where id = :id").param("id", userId).update()
    }

    @Test
    fun `confirmed signup queues welcome and records explicit consent before first login`() {
        createAuthUser(confirmed = true, optedIn = true)

        val row =
            jdbc
                .sql(
                    """
                    select p.daily_question, p.announcements, p.reengagement, p.consented_at is not null as consented,
                           count(d.id) as welcome_count
                      from public.email_preferences p
                      left join public.email_deliveries d on d.user_id = p.user_id and d.dedupe_key = 'welcome'
                     where p.user_id = :id
                     group by p.user_id
                    """.trimIndent(),
                ).param("id", userId)
                .query { rs, _ ->
                    listOf(
                        rs.getBoolean("daily_question"),
                        rs.getBoolean("announcements"),
                        rs.getBoolean("reengagement"),
                        rs.getBoolean("consented"),
                        rs.getLong("welcome_count") == 1L,
                    )
                }.single()
        assertEquals(listOf(true, true, true, true, true), row)

        jdbc.sql("delete from auth.users where id = :id").param("id", userId).update()
        assertEquals(0L, count("select count(*) from public.email_preferences where user_id = :id"))
        assertEquals(0L, count("select count(*) from public.email_deliveries where user_id = :id"))
    }

    @Test
    fun `unconfirmed signup stays out of the mail queue and defaults to off after confirmation`() {
        createAuthUser(confirmed = false, optedIn = false)
        assertEquals(0L, count("select count(*) from public.email_deliveries where user_id = :id"))

        jdbc
            .sql("update auth.users set email_confirmed_at = now() where id = :id")
            .param("id", userId)
            .update()
        assertEquals(1L, count("select count(*) from public.email_deliveries where user_id = :id and dedupe_key = 'welcome'"))
        assertEquals(0L, count("select count(*) from public.email_preferences where user_id = :id and daily_question"))
    }

    @Test
    fun `unsubscribe turns every marketing choice off and cancels pending mail`() {
        createAuthUser(confirmed = true, optedIn = true)
        jdbc
            .sql(
                """
                insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                values (:id, 'daily-question-test', 'daily_question', 'Test', 'Question')
                """.trimIndent(),
            ).param("id", userId)
            .update()
        val token =
            jdbc
                .sql("select unsubscribe_token from public.email_preferences where user_id = :id")
                .param("id", userId)
                .query(UUID::class.java)
                .single()

        EmailService(jdbc, UserRepository(jdbc)).unsubscribe(token)

        assertEquals(
            0L,
            count(
                """
                select count(*) from public.email_preferences
                 where user_id = :id and (daily_question or announcements or reengagement)
                """.trimIndent(),
            ),
        )
        assertEquals(
            1L,
            count(
                """
                select count(*) from public.email_deliveries
                 where user_id = :id and dedupe_key = 'daily-question-test' and status = 'cancelled'
                """.trimIndent(),
            ),
        )
    }

    @Test
    fun `transient SES response retries from durable outbox then records acceptance`() {
        createAuthUser(confirmed = true, optedIn = false)
        val client = mock(SesV2Client::class.java)
        `when`(client.sendEmail(any(SendEmailRequest::class.java)))
            .thenThrow(SesV2Exception.builder().statusCode(503).build())
            .thenReturn(SendEmailResponse.builder().messageId("simulated").build())
        val job =
            LifecycleEmailJob(
                jdbc,
                EmailProperties(enabled = true),
                RestClient.builder(),
                SesEmailSender(client, EmailProperties()),
            )

        job.dispatch()
        assertEquals(
            1L,
            count(
                """
                select count(*) from public.email_deliveries
                 where user_id = :id and status = 'pending'
                   and attempt_count = 1 and error_code = 'ses_transient'
                """.trimIndent(),
            ),
        )

        jdbc
            .sql("update public.email_deliveries set next_attempt_at = now() where user_id = :id")
            .param("id", userId)
            .update()
        job.dispatch()
        assertEquals(
            1L,
            count(
                "select count(*) from public.email_deliveries where user_id = :id and status = 'sent' and attempt_count = 2",
            ),
        )
    }

    private fun createAuthUser(
        confirmed: Boolean,
        optedIn: Boolean,
    ) {
        jdbc
            .sql(
                """
                insert into auth.users
                  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                   raw_user_meta_data, created_at, updated_at)
                values
                  (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                   :email, '', case when :confirmed then now() else null end,
                   cast(:metadata as jsonb), now(), now())
                """.trimIndent(),
            ).param("id", userId)
            .param("email", "lifecycle-$userId@example.invalid")
            .param("confirmed", confirmed)
            .param("metadata", "{\"email_marketing_opt_in\":$optedIn}")
            .update()
    }

    private fun count(sql: String): Long =
        jdbc
            .sql(sql)
            .param("id", userId)
            .query(Long::class.java)
            .single()
}
