package com.interviewos.api.pro

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.mockito.Mockito.mock
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Stores requests against migrated PostgreSQL, caps them per day, and deletes them with the account. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class ProFeatureRequestDatabaseIntegrationTest {
    private val userId = UUID.randomUUID()
    private val identity = SupabaseIdentity(userId, "pro-request-$userId@example.invalid", null)
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val service = ProFeatureRequestService(jdbc, mock(UserRepository::class.java))

    @BeforeEach
    fun createUser() {
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", userId)
            .param("email", identity.email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", userId)
            .param("email", identity.email)
            .update()
    }

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from auth.users where id = :id").param("id", userId).update()
    }

    @Test
    fun `stores the chosen keys and trimmed note, and account deletion removes them`() {
        service.submit(identity, ProFeatureRequest(listOf("progress", "more_practice", "progress"), "  Longer rounds  "))

        val stored =
            jdbc
                .sql("select array_to_string(features, ',') as features, note from public.pro_feature_requests where user_id = :id")
                .param("id", userId)
                .query { rs, _ -> rs.getString("features") to rs.getString("note") }
                .single()
        assertEquals("progress,more_practice" to "Longer rounds", stored)

        jdbc.sql("delete from auth.users where id = :id").param("id", userId).update()
        assertEquals(0L, count())
    }

    @Test
    fun `refuses unknown keys, empty requests and a sixth request in a day`() {
        assertFailsWith<ApiException> { service.submit(identity, ProFeatureRequest(listOf("free_money"))) }
        assertFailsWith<ApiException> { service.submit(identity, ProFeatureRequest(emptyList(), "   ")) }

        repeat(5) { service.submit(identity, ProFeatureRequest(listOf("progress"))) }
        val sixth = assertFailsWith<ApiException> { service.submit(identity, ProFeatureRequest(listOf("progress"))) }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, sixth.status)
        assertEquals(5L, count())
    }

    private fun count(): Long =
        jdbc
            .sql("select count(*) from public.pro_feature_requests where user_id = :id")
            .param("id", userId)
            .query(Long::class.java)
            .single()
}
