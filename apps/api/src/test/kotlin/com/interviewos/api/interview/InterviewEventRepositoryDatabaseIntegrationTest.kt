package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.time.Instant
import kotlin.test.assertEquals

/** Runs the retention purge against migrated PostgreSQL, where the driver binds the cutoff. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class InterviewEventRepositoryDatabaseIntegrationTest {
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )

    @Test
    fun `purge binds its cutoff as a timestamp`() {
        // No event can predate the ledger, so this exercises the bind without deleting anything.
        assertEquals(0, InterviewEventRepository(jdbc).purgeBefore(Instant.parse("2000-01-01T00:00:00Z"), 10))
    }
}
