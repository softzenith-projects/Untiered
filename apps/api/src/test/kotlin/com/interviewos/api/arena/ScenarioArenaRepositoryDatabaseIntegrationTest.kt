package com.interviewos.api.arena

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import tools.jackson.databind.ObjectMapper
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

/** Exercises the authored campaign seed and system-map mapping against migrated PostgreSQL. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class ScenarioArenaRepositoryDatabaseIntegrationTest {
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val repository = ScenarioArenaRepository(jdbc, ObjectMapper())

    @Test
    fun `campaign seed stores ordered steps and a system map`() {
        val candidates = repository.scenarios("system-design")
        assertTrue(candidates.any { it.id == "system-design:fest-night" && it.status == "live" })
        assertTrue(candidates.any { it.id == "system-design:result-day" && it.status == "draft" })

        val first = assertNotNull(repository.firstStep("system-design:fest-night"))
        assertEquals(1, first.position)
        assertEquals(listOf("students", "web", "db"), first.systemState?.nodes)
        assertEquals(listOf("students", "web"), first.systemState?.links?.first())
        assertEquals(2, repository.nextStep(first)?.position)
    }

    @Test
    fun `weak concept names exclude draft-only campaigns`() {
        val names = repository.conceptNames("system-design").map { it.second }
        assertTrue("Database indexes" in names)
        assertFalse("Data residency" in names)
    }

    @Test
    fun `answering the last step completes the scenario`() {
        val userId = UUID.randomUUID()
        val email = "arena-test-$userId@example.invalid"
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", userId)
            .param("email", email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", userId)
            .param("email", email)
            .update()
        try {
            val first = assertNotNull(repository.firstStep("system-design:fest-night"))
            repository.start(userId, "system-design:fest-night", "system-design", first.id)
            repository.advance(userId, "system-design:fest-night", repository.nextStep(first)?.id)
            assertNotNull(repository.active(userId, "system-design"))

            repository.advance(userId, "system-design:fest-night", null)
            assertEquals(null, repository.active(userId, "system-design"))
            assertEquals(setOf("system-design:fest-night"), repository.completedIds(userId, "system-design"))
        } finally {
            jdbc.sql("delete from auth.users where id = :id").param("id", userId).update()
        }
    }
}
