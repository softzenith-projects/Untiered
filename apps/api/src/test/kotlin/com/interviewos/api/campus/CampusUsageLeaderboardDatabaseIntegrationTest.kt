package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.interview.ReportService
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
import org.mockito.ArgumentMatchers
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Modules 11 and 12 against real Postgres with every migration applied: College A and College B
 * side by side. A's usage never includes B's sessions and a student's personal round costs the
 * college nothing; the leaderboard only ever ranks a student's own college, shows a name only
 * after opt-in, and is a 404 to anybody who is not a joined student.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusUsageLeaderboardDatabaseIntegrationTest {
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
    private val cse1 = person()
    private val cse2 = person()
    private val cse3 = person()
    private val ece1 = person()
    private val studentB = person()
    private val everyone = listOf(operator, adminA, facultyA, adminB, cse1, cse2, cse3, ece1, studentB)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val features = ProductFeatureProperties(campus = true)
    private val users = UserRepository(jdbc)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), users)
    private val orgs = OrganisationRepository(jdbc)
    private val structure = StructureRepository(jdbc)
    private val members = MemberRepository(jdbc)
    private val assignmentRepository = AssignmentRepository(jdbc)
    private val mapper = JsonMapper.builder().build()
    private val audit = CampusAudit(jdbc, mapper)
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, structure, members, audit, logos)
    private val platform = CampusAdminService(access, orgs, audit, logos, NoStorage, DataSourceTransactionManager(dataSource))
    private val notifications = CampusNotifications(CampusNotificationRepository(jdbc), features)
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features, notifications)
    private val reports: ReportService = mock(ReportService::class.java)
    private val readiness = CampusReadinessService(access, ReadinessRepository(jdbc), assignmentRepository, audit, reports, mapper)
    private val usage = CampusUsageService(access, UsageRepository(jdbc))
    private val board =
        CampusLeaderboardService(access, readiness, ReadinessRepository(jdbc), assignmentRepository, LeaderboardRepository(jdbc))

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var cseBatch: BatchView
    private lateinit var eceBatch: BatchView
    private lateinit var batchB: BatchView
    private lateinit var cseDepartment: DepartmentView
    private lateinit var cse1Member: UUID
    private lateinit var ece1Member: UUID
    private lateinit var memberB: UUID
    private lateinit var interviewA: UUID
    private lateinit var interviewB: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        jdbc.sql("update public.users set display_name = 'Student One' where id = :id").param("id", cse1.id).update()
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "rdy-a-$suffix", interviewAllowance = 50)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "rdy-b-$suffix", interviewAllowance = 50)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        val facultyMember = seedMember(orgA, facultyA, CampusRole.FACULTY)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        cseDepartment = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val ece = college.createDepartment(adminA, orgA, CreateDepartmentRequest("ECE", "Electronics"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        cseBatch = college.createBatch(adminA, orgA, CreateBatchRequest(cseDepartment.id, 2027, "CSE 2027"))
        eceBatch = college.createBatch(adminA, orgA, CreateBatchRequest(ece.id, 2027, "ECE 2027"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        jdbc
            .sql("insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (:org, :m, :b)")
            .param("org", orgA)
            .param("m", facultyMember)
            .param("b", cseBatch.id)
            .update()
        cse1Member = seedMember(orgA, cse1, CampusRole.STUDENT, cseBatch.id, "A-001")
        seedMember(orgA, cse2, CampusRole.STUDENT, cseBatch.id, "A-002")
        seedMember(orgA, cse3, CampusRole.STUDENT, cseBatch.id, "A-003")
        ece1Member = seedMember(orgA, ece1, CampusRole.STUDENT, eceBatch.id, "A-101")
        memberB = seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "B-001")

        interviewA = publishedInterview(adminA, orgA, listOf(cseBatch.id, eceBatch.id))
        interviewB = publishedInterview(adminB, orgB, listOf(batchB.id))
    }

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from public.ai_calls where call = 'usage-test'").update()
        for (person in everyone) {
            jdbc.sql("delete from public.user_step_answers where user_id = :id").param("id", person.id).update()
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
    fun `usage sums only this college's attempt sessions in range and never another college's or a personal round`() {
        val a1 = completedAttempt(orgA, interviewA, cse1Member, cse1, score = 4)
        val a2 = completedAttempt(orgA, interviewA, cse2Member(), cse2, score = 4)
        val b1 = completedAttempt(orgB, interviewB, memberB, studentB, score = 4)
        val personal = completedSession(cse1, score = 5)
        aiCall(a1, 1_500_000, daysAgo = 5)
        aiCall(a1, 500_000, daysAgo = 5)
        aiCall(a2, 4_000_000, daysAgo = 60) // before the range
        aiCall(b1, 9_000_000, daysAgo = 5)
        aiCall(personal, 7_000_000, daysAgo = 5)

        val today = java.time.LocalDate.now(java.time.ZoneOffset.UTC)
        val rows = usage.usage(operator, today.minusDays(30).toString(), today.toString()).associateBy { it.orgId }
        val a = rows.getValue(orgA)
        assertEquals(2.0, a.aiCostUsd)
        assertEquals(2, a.interviewsUsed)
        assertEquals(1.0, a.aiCostPerInterviewUsd)
        assertEquals(50, a.interviewAllowance)
        assertEquals(9.0, rows.getValue(orgB).aiCostUsd)
        assertEquals(9.0, rows.getValue(orgB).aiCostPerInterviewUsd)
        // By round type, from this college's own attempts only: B's attempt and A's personal round never show up in A's counts.
        assertEquals(listOf(RoundUsage("technical_fundamentals", 2)), a.interviewsByRound)
        assertEquals(listOf(RoundUsage("technical_fundamentals", 1)), rows.getValue(orgB).interviewsByRound)

        // A range with no attempts started in it has no cost per interview, and an operator-only route.
        val empty = usage.usage(operator, today.plusDays(1).toString(), today.plusDays(2).toString()).associateBy { it.orgId }
        assertEquals(0.0, empty.getValue(orgA).aiCostUsd)
        assertNull(empty.getValue(orgA).aiCostPerInterviewUsd)
        assertEquals(emptyList(), empty.getValue(orgA).interviewsByRound)
        assertNotFound { usage.usage(adminA, null, null) }
    }

    @Test
    fun `an operator can read usage inside a read-only transaction, as the real route runs it`() {
        // The service is @Transactional(readOnly = true) in the running app. The admin gate used
        // to provision the operator's user row there, and Postgres refuses any INSERT in a
        // read-only transaction, so the usage page answered 500 to every operator.
        val readOnly = TransactionTemplate(DataSourceTransactionManager(dataSource)).apply { isReadOnly = true }
        val rows = readOnly.execute { usage.usage(operator, null, null) }
        assertNotNull(rows)
        assertTrue(rows.any { it.orgId == orgA })
        assertTrue(rows.any { it.orgId == orgB })
    }

    @Test
    fun `the leaderboard ranks only the callers own college, anonymous until they opt in`() {
        // cse1 scores 100, cse2 60, cse3 has no evidence; ece1 (other batch) 80. B's student scores 100 in College B.
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 5)
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 5)
        completedAttempt(orgA, interviewA, cse2Member(), cse2, score = 3)
        completedAttempt(orgA, interviewA, cse2Member(), cse2, score = 3)
        completedAttempt(orgA, interviewA, ece1Member, ece1, score = 4)
        completedAttempt(orgA, interviewA, ece1Member, ece1, score = 4)
        completedAttempt(orgB, interviewB, memberB, studentB, score = 5)
        completedAttempt(orgB, interviewB, memberB, studentB, score = 5)

        val batch = board.view(cse2, "batch")
        assertEquals(listOf(100, 60), batch.rows.map { it.overall })
        assertEquals(listOf(1, 2), batch.rows.map { it.rank })
        assertEquals(2, batch.myRank)
        assertEquals(listOf(false, true), batch.rows.map { it.isMe })
        assertEquals(listOf("Anonymous student", "Anonymous student"), batch.rows.map { it.displayName })
        assertEquals(false, batch.optedIn)

        val college = board.view(cse2, "college")
        assertEquals(listOf(100, 80, 60), college.rows.map { it.overall })
        assertEquals(3, college.myRank)

        // Opting in shows the name, and only that student's.
        assertEquals(true, board.setPreference(cse1, true).optIn)
        val after = board.view(cse2, "college")
        assertEquals(listOf("Student One", "Anonymous student", "Anonymous student"), after.rows.map { it.displayName })
        assertEquals(false, after.optedIn)
        assertEquals(true, board.view(cse1, null).optedIn)
        assertEquals(false, board.setPreference(cse1, false).optIn)
        assertEquals(
            "Anonymous student",
            board
                .view(cse2, "college")
                .rows
                .first()
                .displayName,
        )

        // Nothing identifying leaves the server, and College B's board is its own.
        val json = mapper.writeValueAsString(after)
        assertTrue(!json.contains("A-001") && !json.contains(cse1Member.toString()), json)
        val b = board.view(studentB, "college")
        assertEquals(listOf(100), b.rows.map { it.overall })
        assertEquals(1, b.myRank)

        // Staff and strangers get a 404.
        assertNotFound { board.view(adminA, "batch") }
        assertNotFound { board.setPreference(adminA, true) }
        assertNotFound { board.view(operator, "batch") }
    }

    private fun cse2Member(): UUID = member(cse2)

    private fun aiCall(
        sessionId: UUID,
        microUsd: Long,
        daysAgo: Int,
    ) {
        jdbc
            .sql(
                """
                insert into public.ai_calls (occurred_at, call, provider, model, micro_usd, session_id)
                values (now() - make_interval(days => :d), 'usage-test', 'test', 'test', :micro, :s)
                """.trimIndent(),
            ).param("d", daysAgo)
            .param("micro", microUsd)
            .param("s", sessionId)
            .update()
    }

    // -- fixtures ------------------------------------------------------------------------

    private fun publishedInterview(
        admin: SupabaseIdentity,
        org: UUID,
        batchIds: List<UUID>,
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
                        targets = AssignmentTargets(batchIds = batchIds, memberIds = emptyList()),
                        topic = "dbms",
                    ),
                ).id
        assignments.publish(admin, org, id)
        return id
    }

    /** A completed session with a report scoring [score] out of 5 on one competency. */
    private fun completedSession(
        who: SupabaseIdentity,
        score: Int,
        assessableTurns: Int = 3,
    ): UUID {
        val sessionId =
            jdbc
                .sql(
                    """
                    insert into public.sessions (user_id, company_name, company_archetype, role_title, round_type, language,
                                                 status, started_at, ended_at)
                    values (:u, 'General practice', 'service_based_it', 'Software Engineer', 'technical_fundamentals', 'english',
                            'completed', now() - interval '1 hour', now())
                    returning id
                    """.trimIndent(),
                ).param("u", who.id)
                .query(UUID::class.java)
                .single()
        val payload =
            mapper.writeValueAsString(
                mapOf(
                    "answeredTurns" to assessableTurns + 1,
                    "assessableTurns" to assessableTurns,
                    "competencies" to listOf(mapOf("competency" to "Databases", "score" to score, "maxScore" to 5)),
                ),
            )
        jdbc
            .sql("insert into public.session_reports (session_id, user_id, payload) values (:s, :u, cast(:p as jsonb))")
            .param("s", sessionId)
            .param("u", who.id)
            .param("p", payload)
            .update()
        return sessionId
    }

    private var attemptClock = Instant.now().minus(10, ChronoUnit.DAYS)

    /** A completed attempt at [assignment] by [memberId], whose session has a report. Each is a minute later than the last. */
    private fun completedAttempt(
        org: UUID,
        assignment: UUID,
        memberId: UUID,
        who: SupabaseIdentity,
        score: Int,
        assessableTurns: Int = 3,
    ): UUID {
        val sessionId = completedSession(who, score, assessableTurns)
        attemptClock = attemptClock.plus(1, ChronoUnit.MINUTES)
        jdbc
            .sql(
                """
                insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded, status, started_at, ended_at)
                values (:org, :a, :m, :s, true, 'completed', cast(:at as timestamptz) - interval '30 minutes', cast(:at as timestamptz))
                """.trimIndent(),
            ).param("org", org)
            .param("a", assignment)
            .param("m", memberId)
            .param("s", sessionId)
            .param("at", attemptClock.toString())
            .update()
        return sessionId
    }

    private fun member(who: SupabaseIdentity): UUID =
        jdbc
            .sql("select id from public.org_members where user_id = :u and status = 'joined'")
            .param("u", who.id)
            .query(UUID::class.java)
            .single()

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

    private fun <T> eqArg(value: T): T = ArgumentMatchers.eq(value) ?: value

    private fun anyUuid(): UUID = ArgumentMatchers.any(UUID::class.java) ?: UUID.randomUUID()

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
            return SupabaseIdentity(id, "campus-rdy-test-$id@example.invalid", null)
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
