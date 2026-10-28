package com.interviewos.api.resume

import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull

/** Runs the deletion-outbox SQL against the migrated local Supabase database in CI. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class ResumeCleanupDatabaseIntegrationTest {
    private val userId = UUID.randomUUID()
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val repository = ResumeRepository(jdbc)

    @BeforeEach
    fun createUser() {
        val email = "resume-cleanup-$userId@example.invalid"
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
    }

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from public.storage_deletion_jobs where user_id = :u").param("u", userId).update()
        jdbc.sql("delete from auth.users where id = :u").param("u", userId).update()
    }

    @Test
    fun `only hidden terminal resumes are removed with deletion jobs`() {
        val old = insert("old", "parsed", "2026-10-01T00:00:00Z")
        val currentParsed = insert("current", "parsed", "2026-10-02T00:00:00Z")
        val visibleFailure = insert("failed", "failed", "2026-10-03T00:00:00Z")
        val foreignPath = insert("forged", "failed", "2026-09-30T00:00:00Z", "other-user/forged.pdf")

        assertEquals(listOf(userId), repository.supersededOwnersAfter(null, 100, "resumes"))
        assertEquals(1, repository.enqueueAndDeleteSuperseded(userId, "resumes"))
        assertEquals(emptyList(), repository.supersededOwnersAfter(null, 100, "resumes"))

        assertEquals(null, repository.findById(userId, old))
        assertNotNull(repository.findById(userId, currentParsed))
        assertNotNull(repository.findById(userId, visibleFailure))
        assertNotNull(repository.findById(userId, foreignPath))
        val jobs =
            jdbc
                .sql("select object_prefix from public.storage_deletion_jobs where user_id = :u")
                .param("u", userId)
                .query(String::class.java)
                .list()
        assertEquals(listOf("$userId/old.pdf"), jobs)
    }

    @Test
    fun `replacing an avatar queues the prior object and updates the profile`() {
        jdbc
            .sql("insert into public.profiles (user_id, avatar_path) values (:u, :path)")
            .param("u", userId)
            .param("path", "$userId/avatar-old")
            .update()

        repository.replaceAvatarPath(userId, "$userId/avatar-new", "resumes")

        assertEquals("$userId/avatar-new", repository.avatarPath(userId))
        val queued =
            jdbc
                .sql("select object_prefix from public.storage_deletion_jobs where user_id = :u")
                .param("u", userId)
                .query(String::class.java)
                .single()
        assertEquals("$userId/avatar-old", queued)
    }

    private fun insert(
        name: String,
        status: String,
        at: String,
        path: String = "$userId/$name.pdf",
    ): UUID {
        val id = UUID.randomUUID()
        jdbc
            .sql(
                """
                insert into public.resumes
                       (id, user_id, storage_bucket, storage_path, original_filename, parse_status, uploaded_at, parsed_at)
                values (:id, :u, 'resumes', :path, :filename, cast(:status as public.resume_parse_status), :at,
                        case when :status = 'parsed' then :at else null end)
                """.trimIndent(),
            ).param("id", id)
            .param("u", userId)
            .param("path", path)
            .param("filename", "$name.pdf")
            .param("status", status)
            .param("at", java.sql.Timestamp.from(Instant.parse(at)))
            .update()
        return id
    }
}
