package com.interviewos.api.interview

import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Exercises the repository's real SQL against a local Supabase instance with every migration applied. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class SessionRepositoryDatabaseIntegrationTest {
    private val userId = UUID.randomUUID()
    private val otherUserId = UUID.randomUUID()
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val repository = SessionRepository(jdbc, StorageProperties())

    @BeforeEach
    fun createUsers() {
        createUser(userId)
        createUser(otherUserId)
    }

    @AfterEach
    fun deleteUsers() {
        for (id in listOf(userId, otherUserId)) {
            jdbc.sql("delete from public.storage_deletion_jobs where user_id = :u").param("u", id).update()
            jdbc.sql("delete from auth.users where id = :u").param("u", id).update()
        }
    }

    @Test
    fun `answer lease renews, fences stale writes and replays completed answer`() {
        val sessionId = openSession()
        assertTrue(repository.insertTurn(sessionId, userId, 0, "Tell me about your work", TurnPhase.MAIN, SpeechStatus.READY, null))
        val requestId = UUID.randomUUID()
        val otherRequest = UUID.randomUUID()

        assertEquals(TurnRequestClaimStatus.ACQUIRED, repository.claimAnswerRequest(sessionId, userId, 0, requestId, 60).status)
        assertEquals(TurnRequestClaimStatus.IN_PROGRESS, repository.claimAnswerRequest(sessionId, userId, 0, otherRequest, 60).status)
        assertEquals(1, repository.renewAnswerRequests(listOf(requestId), 60))
        assertEquals(0, repository.renewAnswerRequests(listOf(otherRequest), 60))
        assertFalse(
            repository.recordAnswer(
                sessionId,
                userId,
                0,
                "stale",
                null,
                "{}",
                "move_on",
                "none",
                null,
                null,
                otherRequest,
            ),
        )
        assertTrue(
            repository.recordAnswer(
                sessionId,
                userId,
                0,
                "real answer",
                null,
                "{}",
                "move_on",
                "none",
                null,
                null,
                requestId,
            ),
        )
        assertTrue(repository.completeAnswerRequest(sessionId, userId, 0, requestId, "{}"))
        assertEquals(TurnRequestClaimStatus.COMPLETED, repository.claimAnswerRequest(sessionId, userId, 0, otherRequest, 60).status)
        assertEquals(0, repository.renewAnswerRequests(listOf(requestId), 60))
    }

    @Test
    fun `hint lease is scoped to the current request and stops renewing after completion`() {
        val sessionId = openSession()
        assertTrue(repository.insertTurn(sessionId, userId, 0, "What would you do?", TurnPhase.MAIN, SpeechStatus.READY, null))
        val requestId = UUID.randomUUID()

        assertEquals(TurnRequestClaimStatus.ACQUIRED, repository.claimHintRequest(sessionId, userId, 0, requestId, 60).status)
        assertEquals(1, repository.renewHintRequests(listOf(requestId), 60))
        assertTrue(repository.recordHint(sessionId, userId, 0, "Consider the input size", "hinted", requestId, "{}"))
        assertEquals(0, repository.renewHintRequests(listOf(requestId), 60))
    }

    @Test
    fun `report lease renews and only its owner may save the report`() {
        val sessionId = openSession()
        jdbc
            .sql("update public.sessions set status = 'completed', ended_at = now() where id = :s")
            .param("s", sessionId)
            .update()
        val leaseId = UUID.randomUUID()
        val staleLease = UUID.randomUUID()

        assertEquals(ReportGenerationClaimStatus.ACQUIRED, repository.claimReportGeneration(sessionId, userId, leaseId, 60).status)
        assertEquals(ReportGenerationClaimStatus.IN_PROGRESS, repository.claimReportGeneration(sessionId, userId, staleLease, 60).status)
        assertEquals(1, repository.renewReportGenerations(listOf(leaseId), 60))
        assertEquals(0, repository.renewReportGenerations(listOf(staleLease), 60))
        assertFalse(repository.saveReport(sessionId, userId, staleLease, "{}", "test", 1, 1))
        assertTrue(repository.saveReport(sessionId, userId, leaseId, "{}", "test", 1, 1))
        assertEquals(ReportGenerationClaimStatus.COMPLETED, repository.claimReportGeneration(sessionId, userId, staleLease, 60).status)
        assertEquals(0, repository.renewReportGenerations(listOf(leaseId), 60))
    }

    @Test
    fun `deletion queues storage work and cascades transcript without touching another owner`() {
        val sessionId = openSession()
        assertTrue(repository.insertTurn(sessionId, userId, 0, "Question", TurnPhase.MAIN, SpeechStatus.READY, null))
        val prefix = "$userId/$sessionId"

        assertFalse(repository.enqueueAndDeleteSession(sessionId, otherUserId, "interview-media", prefix))
        assertEquals(1, count("public.sessions", "id", sessionId))
        assertTrue(repository.enqueueAndDeleteSession(sessionId, userId, "interview-media", prefix))
        assertEquals(0, count("public.sessions", "id", sessionId))
        assertEquals(0, count("public.session_turns", "session_id", sessionId))
        assertEquals(1, count("public.storage_deletion_jobs", "session_id", sessionId))
    }

    @Test
    fun `ending a round clears media paths and queues one owned storage purge`() {
        val sessionId = openSession()
        assertTrue(repository.insertTurn(sessionId, userId, 0, "Question", TurnPhase.MAIN, SpeechStatus.READY, null))
        jdbc
            .sql(
                """
                update public.session_turns
                   set question_audio_path = :question, answer_audio_path = :answer
                 where session_id = :s and user_id = :u
                """.trimIndent(),
            ).param("question", "$userId/$sessionId/turn-0-question.wav")
            .param("answer", "$userId/$sessionId/turn-0-answer.webm")
            .param("s", sessionId)
            .param("u", userId)
            .update()

        assertFalse(repository.markSessionStatus(sessionId, otherUserId, "completed"))
        assertTrue(repository.markSessionStatus(sessionId, userId, "completed"))
        assertFalse(repository.markSessionStatus(sessionId, userId, "completed"))

        assertEquals(
            1,
            jdbc
                .sql(
                    """
                    select count(*) from public.session_turns
                     where session_id = :s and user_id = :u
                       and question_audio_path is null and answer_audio_path is null
                       and question_audio_status = 'unavailable'
                    """.trimIndent(),
                ).param("s", sessionId)
                .param("u", userId)
                .query(Int::class.java)
                .single(),
        )
        assertEquals(
            1,
            jdbc
                .sql(
                    """
                    select count(*) from public.storage_deletion_jobs
                     where session_id = :s and user_id = :u and bucket = 'interview-media'
                       and object_prefix = :prefix and reason = 'round_finished'
                    """.trimIndent(),
                ).param("s", sessionId)
                .param("u", userId)
                .param("prefix", "$userId/$sessionId")
                .query(Int::class.java)
                .single(),
        )
    }

    @Test
    fun `one open round index rejects a second open session for the same candidate`() {
        val first = openSession()
        assertFailsWith<DataAccessException> { openSession() }
        jdbc
            .sql("update public.sessions set status = 'completed', ended_at = now() where id = :s")
            .param("s", first)
            .update()
        openSession()
    }

    @Test
    fun `server failure refunds daily practice only when the session transitions to failed`() {
        val failedSession = openSession()
        repository.recordPracticeUsage(userId, failedSession, 30)
        assertEquals(
            1 to 30,
            repository.practiceUsageSince(
                userId,
                java.time.Instant
                    .now()
                    .minusSeconds(60),
            ),
        )

        assertFalse(repository.failSessionAndRefundUsage(failedSession, otherUserId))
        assertEquals(
            1 to 30,
            repository.practiceUsageSince(
                userId,
                java.time.Instant
                    .now()
                    .minusSeconds(60),
            ),
        )
        assertTrue(repository.failSessionAndRefundUsage(failedSession, userId))
        assertFalse(repository.failSessionAndRefundUsage(failedSession, userId))
        assertEquals(
            0 to 0,
            repository.practiceUsageSince(
                userId,
                java.time.Instant
                    .now()
                    .minusSeconds(60),
            ),
        )
        assertEquals(1, count("public.sessions", "id", failedSession))

        val completedSession = openSession()
        repository.recordPracticeUsage(userId, completedSession, 30)
        assertTrue(repository.markSessionStatus(completedSession, userId, "completed"))
        assertFalse(repository.failSessionAndRefundUsage(completedSession, userId))
        assertEquals(
            1 to 30,
            repository.practiceUsageSince(
                userId,
                java.time.Instant
                    .now()
                    .minusSeconds(60),
            ),
        )
    }

    private fun openSession(): UUID =
        repository.insertSession(
            userId = userId,
            companyName = "Example Company",
            archetype = Archetype.GLOBAL_PRODUCT,
            confidence = Confidence.INFERRED,
            roleTitle = "Engineer",
            roundType = "technical_fundamentals",
            language = "english",
            consentAudio = true,
            consentVideo = false,
            durationMinutes = 30,
        )

    private fun createUser(id: UUID) {
        val email = "db-test-$id@example.invalid"
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", id)
            .param("email", email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", id)
            .param("email", email)
            .update()
    }

    private fun count(
        table: String,
        column: String,
        id: UUID,
    ): Int =
        jdbc
            .sql("select count(*) from $table where $column = :id")
            .param("id", id)
            .query(Int::class.java)
            .single()
}
