package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.sources.AdminProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.dao.DataAccessException
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Module 4b against real Postgres with every migration applied: College A and College B side by
 * side, with a bank course of their own so the test never depends on the seeded content.
 * Isolation of attempts, the attempt limit, the one-open-attempt rule, a double submit that
 * grades once, and the derived completion, score and readiness evidence. A failure here is a
 * merge blocker, as for [CampusIsolationDatabaseIntegrationTest].
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusMcqDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)
    private val transactions = TransactionTemplate(DataSourceTransactionManager(dataSource))
    private val mapper = JsonMapper.builder().build()

    private val adminA = person()
    private val adminB = person()
    private val studentA = person()
    private val studentB = person()
    private val everyone = listOf(adminA, adminB, studentA, studentB)

    private val adminProperties = AdminProperties(emails = emptyList(), userIds = emptyList())
    private val features = ProductFeatureProperties(campus = true)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), UserRepository(jdbc))
    private val assignmentRepository = AssignmentRepository(jdbc)
    private val mcqRepository = McqRepository(jdbc)
    private val audit = CampusAudit(jdbc, mapper)
    private val notifications = CampusNotifications(CampusNotificationRepository(jdbc), features)
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features, notifications)
    private val tests = CampusMcqService(access, assignmentRepository, mcqRepository, audit, features, mapper)

    private val course = "zz-mcq-test-${UUID.randomUUID().toString().take(8)}"
    private val questionIds = (1..8).map { "$course-q$it" }

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var batchA: UUID
    private lateinit var batchB: UUID
    private lateinit var memberA: UUID
    private lateinit var memberB: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        orgA = insertOrg("College A")
        orgB = insertOrg("College B")
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        batchA = insertBatch(orgA)
        batchB = insertBatch(orgB)
        memberA = seedMember(orgA, studentA, CampusRole.STUDENT, batchA, "A-001")
        memberB = seedMember(orgB, studentB, CampusRole.STUDENT, batchB, "B-001")
        for (id in questionIds) {
            jdbc
                .sql(
                    """
                    insert into public.mcq_questions (id, course_slug, course_title, chapter_slug, topic, prompt, options,
                                                      correct_option_id, explanation)
                    values (:id, :course, 'Test course', 'chapter', 'dsa', :prompt,
                            '[{"id":"a","text":"Right"},{"id":"b","text":"Wrong"}]'::jsonb, 'a', 'Because a.')
                    """.trimIndent(),
                ).param("id", id)
                .param("course", course)
                .param("prompt", "Question $id")
                .update()
        }
    }

    @AfterEach
    fun cleanUp() {
        for (org in listOfNotNull(if (::orgA.isInitialized) orgA else null, if (::orgB.isInitialized) orgB else null)) {
            jdbc.sql("delete from public.organisations where id = :id").param("id", org).update()
        }
        for (person in everyone) {
            jdbc.sql("delete from auth.users where id = :id").param("id", person.id).update()
        }
        jdbc.sql("delete from public.mcq_questions where course_slug = :course").param("course", course).update()
    }

    @Test
    fun `the bank offers the course, and a test is created, published and started from it`() {
        assertTrue(assignments.mcqBank(adminA, orgA).any { it.courseSlug == course && it.questions == 8 && it.topic == "dsa" })

        val id = publishedTest(adminA, orgA, batchA)
        val view = tests.start(studentA, id)

        assertEquals(5, view.questions.size)
        assertTrue(view.questions.all { it.id in questionIds })
        assertNull(view.result)
        assertNotNull(view.deadlineAt)
        val stored =
            jdbc
                .sql(
                    "select seed from public.mcq_attempts where id = :id",
                ).param("id", view.attemptId)
                .query(Long::class.java)
                .single()
        val pool = mcqRepository.liveQuestionIds(listOf(course))
        assertEquals(McqDraw.draw(pool, 5, stored), view.questions.map { it.id }, "the stored seed reproduces the draw")
    }

    @Test
    fun `College A cannot read College B's attempts, start its tests, or assign to its students`() {
        val inB = publishedTest(adminB, orgB, batchB)
        val attemptB = tests.start(studentB, inB).attemptId

        assertNotFound { tests.get(studentA, attemptB) }
        assertNotFound { transactions.execute { tests.submit(studentA, attemptB, McqSubmitRequest(emptyList())) } }
        assertNotFound { tests.start(studentA, inB) }
        assertNotFound { tests.staffView(adminA, orgA, memberB, attemptB) }
        assertNotFound { tests.staffView(adminA, orgB, memberB, attemptB) }
        assertNotFound { assignments.create(adminA, orgA, testRequest(batchIds = listOf(batchB))) }
        assertNotFound { assignments.create(adminA, orgA, testRequest(memberIds = listOf(memberB))) }

        // B's staff still see it, and the view is audited in B.
        assertEquals(attemptB, tests.staffView(adminB, orgB, memberB, attemptB).attemptId)
        assertEquals(1L, count("select count(*) from public.org_audit_log where org_id = :o and action = 'mcq.viewed'", orgB))
        assertEquals(0L, count("select count(*) from public.org_audit_log where org_id = :o and action = 'mcq.viewed'", orgA))

        // The composite keys refuse an attempt that points across colleges even if a bug tried.
        assertThrows<DataAccessException> {
            jdbc
                .sql(
                    """
                    insert into public.mcq_attempts (org_id, assignment_id, member_id, seed, question_ids)
                    values (:org, :assignment, :member, 1, array['x'])
                    """.trimIndent(),
                ).param("org", orgA)
                .param("assignment", inB)
                .param("member", memberA)
                .update()
        }
    }

    @Test
    fun `a double submit grades once`() {
        val id = publishedTest(adminA, orgA, batchA)
        val attempt = tests.start(studentA, id)
        val answers = McqSubmitRequest(attempt.questions.map { McqAnswer(it.id, "a") })

        val ready = CountDownLatch(2)
        val go = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val outcomes =
                (1..2)
                    .map {
                        pool.submit(
                            Callable {
                                ready.countDown()
                                go.await(10, TimeUnit.SECONDS)
                                runCatching { transactions.execute { tests.submit(studentA, attempt.attemptId, answers) } }
                            },
                        )
                    }.also {
                        ready.await(10, TimeUnit.SECONDS)
                        go.countDown()
                    }.map { it.get(30, TimeUnit.SECONDS) }

            assertEquals(1, outcomes.count { it.isSuccess }, outcomes.toString())
            val refusal = outcomes.single { it.isFailure }.exceptionOrNull()
            assertTrue(refusal is ApiException, refusal.toString())
            assertEquals("mcq_attempt_submitted", refusal.code)
            val result = outcomes.single { it.isSuccess }.getOrThrow()!!.result!!
            assertEquals(5, result.correct)
            assertEquals(100, result.score)
        } finally {
            pool.shutdownNow()
        }
    }

    @Test
    fun `the attempt limit and the one open attempt are enforced, and completion and readiness follow the submission`() {
        val id = publishedTest(adminA, orgA, batchA, attemptLimit = 2)

        val first = tests.start(studentA, id)
        assertEquals("mcq_attempt_open", assertThrows<ApiException> { tests.start(studentA, id) }.code)
        val progressOpen = assignments.progress(adminA, orgA, id, null, null).single()
        assertEquals("in_progress", progressOpen.status)

        // Two right of five: 40.
        val answers = first.questions.take(2).map { McqAnswer(it.id, "a") } + first.questions.drop(2).map { McqAnswer(it.id, "b") }
        val graded = transactions.execute { tests.submit(studentA, first.attemptId, McqSubmitRequest(answers)) }!!
        assertEquals(40, graded.result!!.score)
        assertEquals(
            "a",
            graded.result.review
                .first()
                .correctOptionId,
        )

        val second = tests.start(studentA, id)
        transactions.execute { tests.submit(studentA, second.attemptId, McqSubmitRequest(emptyList())) }
        assertEquals("assignment_attempt_limit", assertThrows<ApiException> { tests.start(studentA, id) }.code)

        val progress = assignments.progress(adminA, orgA, id, null, null).single()
        assertEquals("completed", progress.status)
        assertEquals(2, progress.attemptsUsed)
        assertEquals(40, progress.mcqScore, "the best submitted score")
        val mine = assignments.mine(studentA).single { it.id == id }
        assertEquals(40, mine.mcqScore)
        assertNull(mine.mcqOpenAttemptId)
        assertEquals(second.attemptId, mine.mcqLatestAttemptId)
        assertEquals(false, mine.canStart)

        // Each submitted attempt is one evidence item, scored with its result.
        val readiness =
            CampusReadinessService(
                access,
                ReadinessRepository(jdbc),
                assignmentRepository,
                audit,
                org.mockito.Mockito.mock(com.interviewos.api.interview.ReportService::class.java),
                mapper,
            )
        val evidence = readiness.student(adminA, orgA, memberA).evidence.filter { it.kind == "mcq_test" }
        assertEquals(listOf(0, 40), evidence.map { it.score }, "newest first")
        assertEquals(setOf(first.attemptId, second.attemptId), evidence.mapNotNull { it.mcqAttemptId }.toSet())
        // The test course is not the DSA course, so the default component is core CS.
        assertEquals("core_cs", evidence.first().component)
    }

    // -- fixtures --------------------------------------------------------------------------

    private fun publishedTest(
        admin: SupabaseIdentity,
        org: UUID,
        batch: UUID,
        attemptLimit: Int = 1,
    ): UUID {
        val id = assignments.create(admin, org, testRequest(batchIds = listOf(batch), attemptLimit = attemptLimit)).id
        assignments.publish(admin, org, id)
        return id
    }

    private fun testRequest(
        batchIds: List<UUID> = emptyList(),
        memberIds: List<UUID> = emptyList(),
        attemptLimit: Int = 1,
    ) = AssignmentRequest(
        kind = "mcq_test",
        title = "DSA check",
        mcq = AssignmentMcq(courseSlugs = listOf(course), questionCount = 5, timeLimitMinutes = 15),
        dueAt = Instant.now().plus(7, ChronoUnit.DAYS).toString(),
        allowLate = false,
        attemptLimit = attemptLimit,
        targets = AssignmentTargets(batchIds = batchIds, memberIds = memberIds),
    )

    private fun count(
        sql: String,
        org: UUID,
    ): Long =
        jdbc
            .sql(sql)
            .param("o", org)
            .query(Long::class.java)
            .single()

    private fun assertNotFound(block: () -> Unit) {
        val error = assertThrows<ApiException> { block() }
        assertEquals(HttpStatus.NOT_FOUND, error.status, error.message)
    }

    private fun insertOrg(name: String): UUID =
        jdbc
            .sql("insert into public.organisations (name, slug) values (:name, :slug) returning id")
            .param("name", name)
            .param("slug", "mcq-${UUID.randomUUID().toString().take(12)}")
            .query(UUID::class.java)
            .single()

    private fun insertBatch(org: UUID): UUID {
        val department =
            jdbc
                .sql("insert into public.org_departments (org_id, code, name) values (:org, 'CSE', 'Computer Science') returning id")
                .param("org", org)
                .query(UUID::class.java)
                .single()
        return jdbc
            .sql(
                """
                insert into public.org_batches (org_id, department_id, graduation_year, name)
                values (:org, :department, 2027, 'CSE 2027') returning id
                """.trimIndent(),
            ).param("org", org)
            .param("department", department)
            .query(UUID::class.java)
            .single()
    }

    private fun seedMember(
        org: UUID,
        who: SupabaseIdentity,
        role: CampusRole,
        batchId: UUID? = null,
        rollNumber: String? = null,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.org_members (org_id, user_id, role, batch_id, roll_number, consent_version, consented_at)
                values (:org, :user, :role, :batch, :roll, :consent, case when :student then now() end)
                returning id
                """.trimIndent(),
            ).param("org", org)
            .param("user", who.id)
            .param("role", role.dbValue)
            .param("batch", batchId)
            .param("roll", rollNumber)
            .param("consent", if (role == CampusRole.STUDENT) "test-v1" else null)
            .param("student", role == CampusRole.STUDENT)
            .query(UUID::class.java)
            .single()

    private fun createUser(who: SupabaseIdentity) {
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", who.id)
            .param("email", who.email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", who.id)
            .param("email", who.email)
            .update()
    }

    private companion object {
        fun person(): SupabaseIdentity {
            val id = UUID.randomUUID()
            return SupabaseIdentity(id, "campus-mcq-test-$id@example.invalid", null)
        }
    }
}
