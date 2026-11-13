package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.sources.AdminProperties
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
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
import kotlin.test.assertTrue

/**
 * Module 4 against real Postgres with every migration applied: College A and College B side
 * by side. Isolation of assignments (service, foreign keys, the student's own list and the
 * admission path), college funding that never touches the student's own ledgers, and the
 * organisation lock that stops two racing starts from spending the last interview of an
 * allowance twice. A failure here is a merge blocker, as for
 * [CampusIsolationDatabaseIntegrationTest].
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusAssignmentDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)
    private val transactions = TransactionTemplate(DataSourceTransactionManager(dataSource))

    private val operator = person()
    private val adminA = person()
    private val adminB = person()
    private val studentA = person()
    private val studentA2 = person()
    private val studentB = person()
    private val everyone = listOf(operator, adminA, adminB, studentA, studentA2, studentB)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val features = ProductFeatureProperties(campus = true)
    private val users = UserRepository(jdbc)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), users)
    private val orgs = OrganisationRepository(jdbc)
    private val structure = StructureRepository(jdbc)
    private val members = MemberRepository(jdbc)
    private val assignmentRepository = AssignmentRepository(jdbc)
    private val audit = CampusAudit(jdbc, JsonMapper.builder().build())
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, structure, members, audit, logos)
    private val platform = CampusAdminService(access, orgs, audit, logos, NoStorage, DataSourceTransactionManager(dataSource))
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features)
    private val admission = AssignedRoundAdmission(access, assignmentRepository, features)

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var batchA: BatchView
    private lateinit var batchB: BatchView
    private lateinit var memberA: UUID
    private lateinit var memberB: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "asg-a-$suffix", interviewAllowance = 10)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "asg-b-$suffix", interviewAllowance = 10)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val departmentA = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        batchA = college.createBatch(adminA, orgA, CreateBatchRequest(departmentA.id, 2027, "CSE 2027"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        memberA = seedMember(orgA, studentA, CampusRole.STUDENT, batchA.id, "A-001")
        seedMember(orgA, studentA2, CampusRole.STUDENT, batchA.id, "A-002")
        memberB = seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "B-001")
    }

    @AfterEach
    fun cleanUp() {
        for (person in everyone) {
            jdbc.sql("delete from public.sessions where user_id = :id").param("id", person.id).update()
        }
        for (org in listOfNotNull(if (::orgA.isInitialized) orgA else null, if (::orgB.isInitialized) orgB else null)) {
            jdbc.sql("delete from public.organisations where id = :id").param("id", org).update()
        }
        for (person in everyone) {
            jdbc.sql("delete from auth.users where id = :id").param("id", person.id).update()
        }
    }

    @Test
    fun `College A cannot read, change, publish or track College B's assignments`() {
        val inB = publishedInterview(adminB, orgB, batchB.id)

        assertNotFound { assignments.get(adminA, orgA, inB) }
        assertNotFound { assignments.get(adminA, orgB, inB) }
        assertNotFound { assignments.update(adminA, orgA, inB, AssignmentRequest(instructions = "Taken over")) }
        assertNotFound { assignments.publish(adminA, orgA, inB) }
        assertNotFound { assignments.archive(adminA, orgA, inB) }
        assertNotFound { assignments.progress(adminA, orgA, inB, null, null) }
        assertTrue(assignments.list(adminA, orgA, null).none { it.id == inB })

        // B's own staff still see it, unchanged.
        assertEquals("published", assignments.get(adminB, orgB, inB).status)
        assertEquals(null, assignments.get(adminB, orgB, inB).instructions)
    }

    @Test
    fun `College A cannot target College B's batch or student, through the service or the database`() {
        val refusedBatch = assertThrows<ApiException> { assignments.create(adminA, orgA, interviewRequest(batchIds = listOf(batchB.id))) }
        assertTrue(refusedBatch.status.is4xxClientError, refusedBatch.message)
        val refusedStudent =
            assertThrows<ApiException> { assignments.create(adminA, orgA, interviewRequest(memberIds = listOf(memberB))) }
        assertTrue(refusedStudent.status.is4xxClientError, refusedStudent.message)

        // The composite foreign keys refuse the same links even if a service bug tried to write them.
        val inA = assignments.create(adminA, orgA, interviewRequest(batchIds = listOf(batchA.id))).id
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.assignment_targets (org_id, assignment_id, batch_id) values (:org, :a, :b)")
                .param("org", orgA)
                .param("a", inA)
                .param("b", batchB.id)
                .update()
        }
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.assignment_targets (org_id, assignment_id, member_id) values (:org, :a, :m)")
                .param("org", orgA)
                .param("a", inA)
                .param("m", memberB)
                .update()
        }
    }

    @Test
    fun `a student sees and can start only their own college's assignments`() {
        val inA = publishedInterview(adminA, orgA, batchA.id)
        val inB = publishedInterview(adminB, orgB, batchB.id)

        assertEquals(listOf(inA), assignments.mine(studentA).map { it.id })
        assertEquals(listOf(inB), assignments.mine(studentB).map { it.id })

        assertNotFound { admission.roundFor(studentA, inB) }
        assertNotFound { transactions.execute { admission.admit(studentA, inB) { insertSession(studentA) } } }
        assertEquals(0L, count("select count(*) from public.assignment_attempts where member_id = :m", mapOf("m" to memberA)))
    }

    @Test
    fun `an assigned round is paid by the college and counts against the attempt limit`() {
        val inA = publishedInterview(adminA, orgA, batchA.id, attemptLimit = 1)

        val sessionId = transactions.execute { admission.admit(studentA, inA) { insertSession(studentA) } }!!

        assertEquals(
            1L,
            count(
                "select count(*) from public.assignment_attempts where session_id = :s and org_funded and member_id = :m",
                mapOf("s" to sessionId, "m" to memberA),
            ),
        )
        // Nothing on the student's own ledgers: no free round used, no credit spent.
        assertEquals(0L, count("select count(*) from public.practice_usage where user_id = :u", mapOf("u" to studentA.id)))
        assertEquals(0L, count("select count(*) from public.interview_credits where user_id = :u", mapOf("u" to studentA.id)))

        val again = assertThrows<ApiException> { transactions.execute { admission.admit(studentA, inA) { insertSession(studentA) } } }
        assertEquals("assignment_attempt_limit", again.code)
    }

    @Test
    fun `two starts racing for the last interview of the allowance admit exactly one`() {
        jdbc.sql("update public.organisations set interview_allowance = 1 where id = :id").param("id", orgA).update()
        val inA = publishedInterview(adminA, orgA, batchA.id)

        val ready = CountDownLatch(2)
        val go = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(2)
        try {
            val outcomes =
                listOf(studentA, studentA2)
                    .map { student ->
                        pool.submit(
                            Callable {
                                ready.countDown()
                                go.await(10, TimeUnit.SECONDS)
                                runCatching { transactions.execute { admission.admit(student, inA) { insertSession(student) } } }
                            },
                        )
                    }.also {
                        ready.await(10, TimeUnit.SECONDS)
                        go.countDown()
                    }.map { it.get(30, TimeUnit.SECONDS) }

            assertEquals(1, outcomes.count { it.isSuccess }, outcomes.toString())
            val refusal = outcomes.single { it.isFailure }.exceptionOrNull()
            assertTrue(refusal is ApiException, refusal.toString())
            assertEquals("college_allowance_exhausted", refusal.code)
            assertEquals(
                1L,
                count("select count(*) from public.assignment_attempts where org_id = :o and org_funded", mapOf("o" to orgA)),
            )
        } finally {
            pool.shutdownNow()
        }
    }

    private fun publishedInterview(
        admin: SupabaseIdentity,
        org: UUID,
        batchId: UUID,
        attemptLimit: Int = 2,
    ): UUID {
        val id = assignments.create(admin, org, interviewRequest(batchIds = listOf(batchId), attemptLimit = attemptLimit)).id
        assignments.publish(admin, org, id)
        return id
    }

    private fun interviewRequest(
        batchIds: List<UUID> = emptyList(),
        memberIds: List<UUID> = emptyList(),
        attemptLimit: Int = 2,
    ) = AssignmentRequest(
        kind = "interview",
        title = "Technical round",
        roundType = "technical_fundamentals",
        durationMinutes = 30,
        dueAt = Instant.now().plus(7, ChronoUnit.DAYS).toString(),
        allowLate = false,
        attemptLimit = attemptLimit,
        targets = AssignmentTargets(batchIds = batchIds, memberIds = memberIds),
    )

    /** The smallest session row the attempt's foreign key can point at. */
    private fun insertSession(who: SupabaseIdentity): UUID =
        jdbc
            .sql(
                """
                insert into public.sessions (user_id, company_name, company_archetype, role_title, round_type, language)
                values (:u, 'General practice', 'service_based_it', 'Software Engineer', 'technical_fundamentals', 'english')
                returning id
                """.trimIndent(),
            ).param("u", who.id)
            .query(UUID::class.java)
            .single()

    private fun count(
        sql: String,
        params: Map<String, Any>,
    ): Long {
        var statement = jdbc.sql(sql)
        params.forEach { (name, value) -> statement = statement.param(name, value) }
        return statement.query(Long::class.java).single()
    }

    private fun assertNotFound(block: () -> Unit) {
        val error = assertThrows<ApiException> { block() }
        assertEquals(HttpStatus.NOT_FOUND, error.status, error.message)
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
            return SupabaseIdentity(id, "campus-asg-test-$id@example.invalid", null)
        }
    }

    private object NoStorage : ObjectStorage {
        override fun upload(
            bucket: String,
            path: String,
            bytes: ByteArray,
            contentType: String,
        ) = error("not used")

        override fun download(
            bucket: String,
            path: String,
        ): ByteArray = error("not used")

        override fun createSignedUrl(
            bucket: String,
            path: String,
            expiresInSeconds: Int,
        ): String = error("not used")

        override fun deleteByPrefix(
            bucket: String,
            prefix: String,
        ) = error("not used")
    }
}
