package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.interview.SessionRepository
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
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Module 5 against real Postgres with every migration applied. College A's staff can never read
 * College B's signals; a personal round never gets a row, whatever the browser sends; an
 * assigned round's counters add up atomically and stop at their caps; the timing signals are
 * read from `answer_timing`; and the student reads exactly what their college reads.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusIntegrityDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)

    private val operator = person()
    private val adminA = person()
    private val facultyA = person()
    private val adminB = person()
    private val studentA = person()
    private val studentB = person()
    private val everyone = listOf(operator, adminA, facultyA, adminB, studentA, studentB)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val features = ProductFeatureProperties(campus = true)
    private val users = UserRepository(jdbc)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), users)
    private val mapper = JsonMapper.builder().build()
    private val audit = CampusAudit(jdbc, mapper)
    private val logos = OrgLogos(StorageProperties())
    private val college =
        CampusOrgService(access, OrganisationRepository(jdbc), StructureRepository(jdbc), MemberRepository(jdbc), audit, logos)
    private val platform =
        CampusAdminService(access, OrganisationRepository(jdbc), audit, logos, NoStorage, DataSourceTransactionManager(dataSource))
    private val assignments =
        CampusAssignmentService(
            access,
            AssignmentRepository(jdbc),
            audit,
            features,
            CampusNotifications(CampusNotificationRepository(jdbc), features),
        )
    private val integrityRepository = IntegrityRepository(jdbc)
    private val integrity =
        IntegrityService(
            SessionRepository(jdbc, StorageProperties()),
            integrityRepository,
            ReadinessRepository(jdbc),
            access,
            audit,
            features,
            mapper,
        )

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var memberA: UUID
    private lateinit var memberB: UUID
    private lateinit var interviewA: UUID
    private lateinit var interviewB: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "int-a-$suffix", interviewAllowance = 50)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "int-b-$suffix", interviewAllowance = 50)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        val facultyMember = seedMember(orgA, facultyA, CampusRole.FACULTY)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val cse = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val ece = college.createDepartment(adminA, orgA, CreateDepartmentRequest("ECE", "Electronics"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        val cseBatch = college.createBatch(adminA, orgA, CreateBatchRequest(cse.id, 2027, "CSE 2027"))
        val eceBatch = college.createBatch(adminA, orgA, CreateBatchRequest(ece.id, 2027, "ECE 2027"))
        val batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        // The faculty member teaches ECE only; the student is in CSE.
        jdbc
            .sql("insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (:org, :m, :b)")
            .param("org", orgA)
            .param("m", facultyMember)
            .param("b", eceBatch.id)
            .update()
        memberA = seedMember(orgA, studentA, CampusRole.STUDENT, cseBatch.id)
        memberB = seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id)
        interviewA = publishedInterview(adminA, orgA, cseBatch.id)
        interviewB = publishedInterview(adminB, orgB, batchB.id)
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
    fun `College A's staff can never read College B's signals`() {
        val sessionB = session(studentB)
        attempt(orgB, interviewB, memberB, sessionB)
        integrity.record(studentB.id, sessionB, batch("tab_hidden", "tab_hidden"))

        assertNotFound { integrity.staff(adminA, orgA, memberB, sessionB) }
        assertNotFound { integrity.staff(adminA, orgB, memberB, sessionB) }
        assertEquals(0L, auditCount(orgA, "integrity.viewed"))

        val inB = integrity.staff(adminB, orgB, memberB, sessionB)
        assertEquals(2, inB.tabHidden)
        assertEquals(1L, auditCount(orgB, "integrity.viewed"))
    }

    @Test
    fun `a personal round never gets a row, and its college cannot open it`() {
        val personal = session(studentA)

        integrity.record(studentA.id, personal, batch("tab_hidden", "window_blur", "paste"))
        // Straight at the repository too: the insert itself refuses a session with no attempt.
        assertFalse(integrityRepository.increment(personal, studentA.id, IntegrityIncrements(5, 5, 5, 500)))

        assertEquals(0L, rows(personal))
        assertEquals(IntegritySummary.NOT_RECORDED, integrity.mine(studentA.id, personal))
        assertNotFound { integrity.staff(adminA, orgA, memberA, personal) }
    }

    @Test
    fun `someone else's session is a 404 and writes nothing`() {
        val sessionA = session(studentA)
        attempt(orgA, interviewA, memberA, sessionA)

        assertNotFound { integrity.record(studentB.id, sessionA, batch("tab_hidden")) }
        assertFalse(integrityRepository.increment(sessionA, studentB.id, IntegrityIncrements(1, 0, 0, 0)))
        assertNotFound { integrity.mine(studentB.id, sessionA) }
        assertEquals(0L, rows(sessionA))
    }

    @Test
    fun `an assigned round's counters add up under concurrent batches and the student reads what the college reads`() {
        val sessionA = session(studentA)
        attempt(orgA, interviewA, memberA, sessionA)
        turn(
            sessionA,
            0,
            """{"recordedMs":60000,"firstSoundMs":300,"speakingMs":45000,"pauseCount":0,"longestPauseMs":0,"totalPauseMs":0}""",
        )
        turn(
            sessionA,
            1,
            """{"recordedMs":60000,"firstSoundMs":3000,"speakingMs":50000,"pauseCount":1,"longestPauseMs":21000,"totalPauseMs":21000}""",
        )
        turn(sessionA, 2, null)

        val pool = Executors.newFixedThreadPool(8)
        repeat(40) { pool.submit { integrity.record(studentA.id, sessionA, batch("tab_hidden", "paste")) } }
        pool.shutdown()
        assertTrue(pool.awaitTermination(60, TimeUnit.SECONDS))

        val mine = integrity.mine(studentA.id, sessionA)
        assertTrue(mine.recorded)
        assertEquals(40, mine.tabHidden)
        assertEquals(40, mine.pastes)
        assertEquals(400, mine.pastedChars)
        assertEquals(1, mine.fastAnswers)
        assertEquals(1, mine.longPauses)
        assertEquals(mine, integrity.staff(adminA, orgA, memberA, sessionA))
        assertEquals(1L, rows(sessionA))
    }

    @Test
    fun `the caps hold in the database`() {
        val sessionA = session(studentA)
        attempt(orgA, interviewA, memberA, sessionA)
        integrityRepository.increment(sessionA, studentA.id, IntegrityIncrements(9_999, 0, 0, 99_990))
        integrityRepository.increment(sessionA, studentA.id, IntegrityIncrements(50, 0, 1, 100_000))

        val summary = integrity.mine(studentA.id, sessionA)
        assertEquals(IntegrityRules.COUNTER_CAP, summary.tabHidden)
        assertEquals(IntegrityRules.PASTED_CHARS_CAP, summary.pastedChars)
    }

    @Test
    fun `a faculty member outside the student's batch gets 404, and deleting the round deletes its row`() {
        val sessionA = session(studentA)
        attempt(orgA, interviewA, memberA, sessionA)
        integrity.record(studentA.id, sessionA, batch("window_blur"))

        assertNotFound { integrity.staff(facultyA, orgA, memberA, sessionA) }
        assertEquals(1L, rows(sessionA))

        jdbc.sql("delete from public.sessions where id = :id").param("id", sessionA).update()
        assertEquals(0L, rows(sessionA))
    }

    // -- helpers -------------------------------------------------------------------------

    private fun batch(vararg types: String) =
        IntegrityEventBatch(
            types.map {
                IntegrityEventInput(
                    type = it,
                    at = Instant.now().toString(),
                    chars =
                        if (it ==
                            "paste"
                        ) {
                            10
                        } else {
                            null
                        },
                )
            },
        )

    private fun session(who: SupabaseIdentity): UUID =
        jdbc
            .sql(
                """
                insert into public.sessions (user_id, company_name, company_archetype, role_title, round_type, language,
                                             status, started_at)
                values (:u, 'General practice', 'service_based_it', 'Software Engineer', 'technical_fundamentals', 'english',
                        'in_progress', now())
                returning id
                """.trimIndent(),
            ).param("u", who.id)
            .query(UUID::class.java)
            .single()

    private fun turn(
        sessionId: UUID,
        index: Int,
        timing: String?,
    ) {
        jdbc
            .sql(
                """
                insert into public.session_turns (session_id, user_id, turn_index, question_text, answer_transcript, answered_at, answer_timing)
                select :s, user_id, :i, 'Tell me about indexes.', 'An index is a sorted copy.', now(), cast(:t as jsonb)
                  from public.sessions where id = :s
                """.trimIndent(),
            ).param("s", sessionId)
            .param("i", index)
            .param("t", timing)
            .update()
    }

    private fun attempt(
        org: UUID,
        assignment: UUID,
        memberId: UUID,
        sessionId: UUID,
    ) {
        jdbc
            .sql(
                """
                insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded)
                values (:org, :a, :m, :s, true)
                """.trimIndent(),
            ).param("org", org)
            .param("a", assignment)
            .param("m", memberId)
            .param("s", sessionId)
            .update()
    }

    private fun rows(sessionId: UUID): Long =
        jdbc
            .sql("select count(*) from public.session_integrity where session_id = :s")
            .param("s", sessionId)
            .query(Long::class.java)
            .single()

    private fun publishedInterview(
        admin: SupabaseIdentity,
        org: UUID,
        batchId: UUID,
    ): UUID {
        val id =
            assignments
                .create(
                    admin,
                    org,
                    AssignmentRequest(
                        kind = "interview",
                        title = "Technical round",
                        roundType = "technical_fundamentals",
                        durationMinutes = 30,
                        dueAt = Instant.now().plus(7, ChronoUnit.DAYS).toString(),
                        allowLate = false,
                        attemptLimit = 5,
                        targets = AssignmentTargets(batchIds = listOf(batchId), memberIds = emptyList()),
                    ),
                ).id
        assignments.publish(admin, org, id)
        return id
    }

    private fun auditCount(
        org: UUID,
        action: String,
    ): Long =
        jdbc
            .sql("select count(*) from public.org_audit_log where org_id = :o and action = :a")
            .param("o", org)
            .param("a", action)
            .query(Long::class.java)
            .single()

    private fun assertNotFound(block: () -> Unit) {
        val error = assertThrows<ApiException> { block() }
        assertEquals(HttpStatus.NOT_FOUND, error.status, error.message)
    }

    private fun seedMember(
        org: UUID,
        who: SupabaseIdentity,
        role: CampusRole,
        batchId: UUID? = null,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.org_members (org_id, user_id, role, batch_id, consent_version, consented_at)
                values (:org, :user, :role, :batch, :consent, case when :student then now() end)
                returning id
                """.trimIndent(),
            ).param("org", org)
            .param("user", who.id)
            .param("role", role.dbValue)
            .param("batch", batchId)
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
            return SupabaseIdentity(id, "campus-int-test-$id@example.invalid", null)
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
