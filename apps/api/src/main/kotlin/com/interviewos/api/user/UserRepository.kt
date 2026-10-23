package com.interviewos.api.user

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.util.UUID

@Repository
class UserRepository(
    private val jdbcClient: JdbcClient,
) {
    /**
     * Creates the user and profile rows on first sign-in, and refreshes the details
     * Supabase owns on every subsequent one. A display name the candidate has since
     * edited is kept — the identity provider does not get to overwrite it.
     */
    fun provision(identity: SupabaseIdentity) {
        // Insert-if-missing, then update only what actually changed. The previous
        // single upsert put `email` in its SET list, and because `users.email` is unique
        // that made Postgres lock the row FOR UPDATE on every call — including every page
        // load, since GET /me provisions too. A FOR UPDATE lock blocks the FOR KEY SHARE
        // that any foreign key to this user needs, so an ordinary profile read could stall
        // an unrelated write. An UPDATE whose WHERE matches nothing locks nothing.
        val created =
            jdbcClient
                .sql(
                    """
                    insert into public.users (id, email, display_name)
                    values (:id, :email, :displayName)
                    on conflict (id) do nothing
                    """.trimIndent(),
                ).param("id", identity.id)
                .param("email", identity.email)
                .param("displayName", identity.displayName)
                .update() == 1

        jdbcClient
            .sql(
                """
                insert into public.email_preferences
                  (user_id, daily_question, announcements, reengagement, consented_at)
                values (:id, :optIn, :optIn, :optIn, case when :optIn then now() else null end)
                on conflict (user_id) do nothing
                """.trimIndent(),
            ).param("id", identity.id)
            .param("optIn", created && identity.emailMarketingOptIn)
            .update()

        if (created) {
            jdbcClient
                .sql(
                    """
                    insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                    values (:id, 'welcome', 'welcome', 'Welcome to Untiered',
                      'Your account is ready. Choose a company and role, then practise a spoken interview or explore the courses and Arena. Visit your account to get started.')
                    on conflict (user_id, dedupe_key) do nothing
                    """.trimIndent(),
                ).param("id", identity.id)
                .update()
        }

        jdbcClient
            .sql("update public.users set email = :email where id = :id and email is distinct from :email")
            .param("id", identity.id)
            .param("email", identity.email)
            .update()

        jdbcClient
            .sql("update public.users set last_seen_at = now() where id = :id and last_seen_at < now() - interval '1 day'")
            .param("id", identity.id)
            .update()

        if (!identity.displayName.isNullOrBlank()) {
            jdbcClient
                .sql("update public.users set display_name = :displayName where id = :id and display_name is null")
                .param("id", identity.id)
                .param("displayName", identity.displayName)
                .update()
        }

        jdbcClient
            .sql(
                """
                insert into public.profiles (user_id)
                values (:id)
                on conflict (user_id) do nothing
                """.trimIndent(),
            ).param("id", identity.id)
            .update()
    }

    fun findMe(userId: UUID): MeResponse? =
        jdbcClient
            .sql(
                """
                select u.id,
                       u.email,
                       u.display_name,
                       u.preferred_language::text as preferred_language,
                       u.created_at,
                       p.function,
                       p.current_level,
                       p.target_level,
                       p.total_experience_months,
                       p.people_management_scope,
                       p.location,
                       p.relocation_intent::text as relocation_intent,
                       p.work_authorisation_status,
                       p.notice_period_days,
                       p.compensation_expectation_min,
                       p.compensation_expectation_max,
                       p.compensation_currency
                  from public.users u
                  left join public.profiles p on p.user_id = u.id
                 where u.id = :id
                """.trimIndent(),
            ).param("id", userId)
            .query { rs, _ -> mapMe(rs) }
            .optional()
            .orElse(null)

    private fun mapMe(rs: ResultSet): MeResponse {
        val min = rs.getBigDecimal("compensation_expectation_min")
        val max = rs.getBigDecimal("compensation_expectation_max")
        val currency = rs.getString("compensation_currency")?.trim()?.takeIf { it.isNotEmpty() }
        return MeResponse(
            id = rs.getObject("id", UUID::class.java),
            email = rs.getString("email"),
            displayName = rs.getString("display_name"),
            preferredLanguage = rs.getString("preferred_language"),
            createdAt = rs.getTimestamp("created_at").toInstant(),
            profile =
                ProfileResponse(
                    function = rs.getString("function"),
                    currentLevel = rs.getString("current_level"),
                    targetLevel = rs.getString("target_level"),
                    totalExperienceMonths = rs.getIntOrNull("total_experience_months"),
                    peopleManagementScope = rs.getString("people_management_scope"),
                    location = rs.getString("location"),
                    relocationIntent = rs.getString("relocation_intent"),
                    workAuthorisationStatus = rs.getString("work_authorisation_status"),
                    noticePeriodDays = rs.getIntOrNull("notice_period_days"),
                    compensationExpectation =
                        if (min == null && max == null && currency == null) {
                            null
                        } else {
                            CompensationBand(min, max, currency)
                        },
                ),
        )
    }

    /** `getInt` reports 0 for SQL NULL, which is a meaningful value for these columns. */
    private fun ResultSet.getIntOrNull(column: String): Int? = getInt(column).takeUnless { wasNull() }
}
