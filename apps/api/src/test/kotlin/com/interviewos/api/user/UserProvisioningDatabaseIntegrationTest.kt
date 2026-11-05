package com.interviewos.api.user

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/** Provisioning against migrated PostgreSQL, where `public.users.id` references `auth.users`. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class UserProvisioningDatabaseIntegrationTest {
    private val userId = UUID.randomUUID()
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val repository = UserRepository(jdbc)
    private val identity = SupabaseIdentity(id = userId, email = "provision-$userId@example.invalid", displayName = "Test")

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from auth.users where id = :id").param("id", userId).update()
    }

    @Test
    fun `a token for an account Supabase has deleted is a 401, and leaves nothing behind`() {
        val ex = assertFailsWith<ApiException> { repository.provision(identity) }

        assertEquals(HttpStatus.UNAUTHORIZED, ex.status)
        assertEquals("unauthorized", ex.code)
        assertEquals(0L, count())
    }

    @Test
    fun `an account Supabase still has is provisioned as before`() {
        jdbc
            .sql(
                """
                insert into auth.users
                  (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                   raw_user_meta_data, created_at, updated_at)
                values
                  (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
                   :email, '', now(), '{}'::jsonb, now(), now())
                """.trimIndent(),
            ).param("id", userId)
            .param("email", identity.email)
            .update()

        repository.provision(identity)

        assertEquals(1L, count())
    }

    private fun count(): Long =
        jdbc
            .sql("select count(*) from public.users where id = :id")
            .param("id", userId)
            .query(Long::class.java)
            .single()
}
