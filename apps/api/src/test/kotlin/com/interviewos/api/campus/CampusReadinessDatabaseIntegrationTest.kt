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
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Modules 6 and 7 against real Postgres with every migration applied: College A and College B
 * side by side. College A's staff never see College B's students in readiness, the dashboard,
 * the table, the export or a report; a student's personal round can never be opened by their
 * college and never moves their readiness; and a faculty member's dashboard and table are
 * narrowed to their batches. A failure here is a merge blocker, as for
 * [CampusIsolationDatabaseIntegrationTest]. The report path is mocked: no model is called.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusReadinessDatabaseIntegrationTest {
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
    fun `College A's staff never see College B's students in readiness, the dashboard, the table, the export or a report`() {
        val sessionB = completedAttempt(orgB, interviewB, memberB, studentB, score = 5)
        completedAttempt(orgB, interviewB, memberB, studentB, score = 4)
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 3)

        assertNotFound { readiness.student(adminA, orgA, memberB) }
        assertNotFound { readiness.student(adminA, orgB, memberB) }
        assertNotFound { readiness.report(adminA, orgA, memberB, sessionB) }
        assertNotFound { readiness.report(adminA, orgB, memberB, sessionB) }
        assertNotFound { readiness.dashboard(adminA, orgA, batchB.id, null) }
        assertNotFound { readiness.table(adminA, orgA, StudentTableQuery(batchId = batchB.id), null) }
        assertNotFound { readiness.exportCsv(adminA, orgA, StudentTableQuery(departmentId = batchB.departmentId)) }

        val dashboard = readiness.dashboard(adminA, orgA, null, null)
        assertEquals(4, dashboard.joined)
        assertEquals(4, dashboard.bands.values.sum())
        val table = readiness.table(adminA, orgA, StudentTableQuery(), null)
        assertEquals(setOf("A-001", "A-002", "A-003", "A-101"), table.items.map { it.rollNumber }.toSet())
        val csv = String(readiness.exportCsv(adminA, orgA, StudentTableQuery()), Charsets.UTF_8)
        assertTrue(!csv.contains("B-001") && !csv.contains(studentB.email), csv)

        // B's own staff see B's student, with B's evidence only.
        val inB = readiness.student(adminB, orgB, memberB)
        assertEquals(listOf(80, 100), inB.evidence.map { it.score }, "newest first")
        assertEquals(90, inB.overall)
        assertEquals("strong", inB.band)
        verifyNoInteractions(reports)
    }

    @Test
    fun `a student's personal round is a 404 to their college, and an assigned one goes through the report path`() {
        val personal = completedSession(cse1, score = 5)
        val assigned = completedAttempt(orgA, interviewA, cse1Member, cse1, score = 4)

        assertNotFound { readiness.report(adminA, orgA, cse1Member, personal) }
        assertNotFound { readiness.report(facultyA, orgA, cse1Member, personal) }
        // Someone else's attempt is not this member's either.
        assertNotFound { readiness.report(adminA, orgA, ece1Member, assigned) }
        verifyNoInteractions(reports)
        assertEquals(0L, auditCount(orgA, "report.viewed"))

        readiness.report(adminA, orgA, cse1Member, assigned)
        verify(reports).report(eqArg(cse1.id), eqArg(assigned), anyUuid())
        assertEquals(1L, auditCount(orgA, "report.viewed"))
    }

    @Test
    fun `personal practice never changes readiness`() {
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 2)
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 3)
        val before = readiness.student(adminA, orgA, cse1Member)
        val mineBefore = readiness.mine(cse1)

        // A strong personal round, with a report, and a completed personal attempt-less session.
        completedSession(cse1, score = 5)
        completedSession(cse1, score = 5)

        val after = readiness.student(adminA, orgA, cse1Member)
        assertEquals(before, after)
        assertEquals(50, after.overall)
        assertEquals(listOf(60, 40), after.evidence.map { it.score })
        assertEquals(mineBefore, readiness.mine(cse1))
        assertEquals(after.evidence, readiness.mine(cse1).evidence)
    }

    @Test
    fun `a report below the evidence threshold is not evidence, and a missing component is null, not 0`() {
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 5, assessableTurns = 1)

        val view = readiness.student(adminA, orgA, cse1Member)

        assertEquals(emptyList(), view.evidence)
        assertNull(view.components.technicalInterview)
        assertNull(view.overall)
        assertEquals("not_enough_evidence", view.band)
    }

    @Test
    fun `a faculty member's dashboard and table are narrowed to their batches`() {
        completedAttempt(orgA, interviewA, ece1Member, ece1, score = 5)

        val dashboard = readiness.dashboard(facultyA, orgA, null, null)
        assertEquals(3, dashboard.joined)
        assertEquals(listOf("CSE"), dashboard.heatmap.rows.map { it.departmentCode })
        assertEquals(emptyList(), dashboard.heatmap.columns, "the ECE student's evidence is not in this faculty member's view")

        val table = readiness.table(facultyA, orgA, StudentTableQuery(), null)
        assertEquals(setOf("A-001", "A-002", "A-003"), table.items.map { it.rollNumber }.toSet())
        assertNotFound { readiness.student(facultyA, orgA, ece1Member) }
        assertNotFound { readiness.dashboard(facultyA, orgA, eceBatch.id, null) }
        assertNotFound { readiness.table(facultyA, orgA, StudentTableQuery(batchId = eceBatch.id), null) }

        val csv = String(readiness.exportCsv(facultyA, orgA, StudentTableQuery()), Charsets.UTF_8)
        assertTrue(!csv.contains("A-101"), csv)
        // The TPO's view of the whole college includes ECE.
        assertEquals(4, readiness.dashboard(adminA, orgA, null, null).joined)
    }

    @Test
    fun `a heatmap cell shows an average only from three students, and the dashboard counts what it says`() {
        completedAttempt(orgA, interviewA, cse1Member, cse1, score = 5)
        completedAttempt(orgA, interviewA, member(cse2), cse2, score = 4)
        completedAttempt(orgA, interviewA, ece1Member, ece1, score = 2)
        jdbc
            .sql(
                """
                insert into public.campus_invites (org_id, role, batch_id, email, full_name, expires_at)
                values (:org, 'student', :batch, :email, 'Pending Student', now() + interval '7 days')
                """.trimIndent(),
            ).param("org", orgA)
            .param("batch", cseBatch.id)
            .param("email", "pending-${UUID.randomUUID()}@example.invalid")
            .update()

        val twoStudents = readiness.dashboard(adminA, orgA, null, null)
        val cseCell =
            twoStudents.heatmap.rows
                .single { it.departmentCode == "CSE" }
                .cells
                .single()
        assertEquals("dbms", cseCell.topic)
        assertEquals(2, cseCell.students)
        assertNull(cseCell.average)

        completedAttempt(orgA, interviewA, member(cse3), cse3, score = 3)
        val dashboard = readiness.dashboard(adminA, orgA, null, null)
        val cse =
            dashboard.heatmap.rows
                .single { it.departmentCode == "CSE" }
                .cells
                .single()
        assertEquals(3, cse.students)
        assertEquals(80, cse.average, "(100 + 80 + 60) / 3")
        val ece =
            dashboard.heatmap.rows
                .single { it.departmentCode == "ECE" }
                .cells
                .single()
        assertEquals(1, ece.students)
        assertNull(ece.average)

        assertEquals(5, dashboard.enrolled, "4 joined students and 1 open invite")
        assertEquals(4, dashboard.joined)
        // Every student completed the one published assignment; nothing is due yet beyond that.
        assertEquals(1.0, dashboard.completionRate)
        // One item each: no band for anyone yet.
        assertEquals(4, dashboard.bands["not_enough_evidence"])
    }

    @Test
    fun `a completed scenario set is evidence scored correct over answered, and readiness views are audited`() {
        val scenario =
            jdbc
                .sql(
                    """
                    select s.id from public.arena_scenarios s
                     where s.status = 'live' and exists (select 1 from public.arena_scenario_steps st where st.scenario_id = s.id)
                     order by s.id limit 1
                    """.trimIndent(),
                ).query(String::class.java)
                .single()
        val steps =
            jdbc
                .sql("select id from public.arena_scenario_steps where scenario_id = :s order by id")
                .param("s", scenario)
                .query(String::class.java)
                .list()
        val set =
            assignments
                .create(
                    adminA,
                    orgA,
                    AssignmentRequest(
                        kind = "arena_scenarios",
                        title = "Scenario set",
                        scenarioIds = listOf(scenario),
                        dueAt = Instant.now().plus(7, ChronoUnit.DAYS).toString(),
                        allowLate = false,
                        attemptLimit = 1,
                        targets = AssignmentTargets(batchIds = listOf(cseBatch.id), memberIds = emptyList()),
                        component = "core_cs",
                        topic = "os",
                    ),
                ).id
        assignments.publish(adminA, orgA, set)
        steps.forEachIndexed { index, step ->
            jdbc
                .sql(
                    "insert into public.user_step_answers (user_id, step_id, chosen_option_id, is_correct) values (:u, :s, 'x', :ok)",
                ).param("u", cse1.id)
                .param("s", step)
                .param("ok", index > 0) // the first answer wrong
                .update()
        }

        val view = readiness.student(adminA, orgA, cse1Member)

        val item = view.evidence.single()
        assertEquals("arena_scenarios", item.kind)
        assertEquals(ReadinessCalculator.itemScore((steps.size - 1) * 100.0 / steps.size), item.score)
        assertEquals("os", item.topic)
        assertNull(item.sessionId)
        assertNotNull(view.components.coreCs)
        assertEquals(1L, auditCount(orgA, "readiness.viewed"))

        readiness.exportCsv(adminA, orgA, StudentTableQuery(band = "not_enough_evidence"))
        val detail =
            jdbc
                .sql("select detail::text from public.org_audit_log where org_id = :o and action = 'students.exported'")
                .param("o", orgA)
                .query(String::class.java)
                .single()
        assertTrue(detail.contains("\"band\": \"not_enough_evidence\""), detail)
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
