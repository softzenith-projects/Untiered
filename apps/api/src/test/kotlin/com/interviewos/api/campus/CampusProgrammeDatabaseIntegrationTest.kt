package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.sources.AdminProperties
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
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Module 10 against real Postgres with every migration applied: College A and College B side by
 * side. Cloning creates exactly one published, weekly-dated assignment per module in one
 * transaction (a failure part-way leaves nothing behind); College A can neither read B's
 * programmes nor clone into B's batches; a faculty member sees only programmes for their
 * batches; and the certificate is a 404 until every module is completed. No model is called.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusProgrammeDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)
    private val transactionManager = DataSourceTransactionManager(dataSource)

    private val operator = person()
    private val adminA = person()
    private val tpoA = person()
    private val facultyA = person()
    private val adminB = person()
    private val cse1 = person()
    private val ece1 = person()
    private val studentB = person()
    private val everyone = listOf(operator, adminA, tpoA, facultyA, adminB, cse1, ece1, studentB)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val features = ProductFeatureProperties(campus = true)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), UserRepository(jdbc))
    private val orgs = OrganisationRepository(jdbc)
    private val assignmentRepository = AssignmentRepository(jdbc)
    private val mapper = JsonMapper.builder().build()
    private val audit = CampusAudit(jdbc, mapper)
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, StructureRepository(jdbc), MemberRepository(jdbc), audit, logos)
    private val platform = CampusAdminService(access, orgs, audit, logos, NoObjectStorage, transactionManager)
    private val notifications = CampusNotifications(CampusNotificationRepository(jdbc), features)
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features, notifications)
    private val service =
        CampusProgrammeService(
            access,
            ProgrammeRepository(jdbc),
            assignmentRepository,
            assignments,
            audit,
            features,
            logos,
            mapper,
            transactionManager,
        )

    private val today = ProgrammeSchedule.today(Instant.now())
    private val templateIds = mutableListOf<UUID>()

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var cseBatch: BatchView
    private lateinit var eceBatch: BatchView
    private lateinit var batchB: BatchView
    private lateinit var cse1Member: UUID
    private lateinit var template: ProgrammeTemplateView

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "prg-a-$suffix", interviewAllowance = 50)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "prg-b-$suffix", interviewAllowance = 50)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgA, tpoA, CampusRole.TPO)
        val facultyMember = seedMember(orgA, facultyA, CampusRole.FACULTY)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val cse = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val ece = college.createDepartment(adminA, orgA, CreateDepartmentRequest("ECE", "Electronics"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        cseBatch = college.createBatch(adminA, orgA, CreateBatchRequest(cse.id, 2027, "CSE 2027"))
        eceBatch = college.createBatch(adminA, orgA, CreateBatchRequest(ece.id, 2027, "ECE 2027"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        jdbc
            .sql("insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (:org, :m, :b)")
            .param("org", orgA)
            .param("m", facultyMember)
            .param("b", cseBatch.id)
            .update()
        cse1Member = seedMember(orgA, cse1, CampusRole.STUDENT, cseBatch.id, "A-001")
        seedMember(orgA, ece1, CampusRole.STUDENT, eceBatch.id, "A-101")
        seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "B-001")

        template =
            service.createTemplate(
                operator,
                ProgrammeTemplateRequest(
                    title = "Placement Accelerator $suffix",
                    description = "Three weeks of rounds.",
                    weeks = 3,
                    modules =
                        listOf(
                            module(1, "Week 1: DBMS round", "technical_fundamentals"),
                            module(2, "Week 2: HR round", "hr_fit_closing"),
                            module(3, "Week 3: Aptitude", "aptitude"),
                        ),
                ),
            )
        templateIds += template.id
    }

    @AfterEach
    fun cleanUp() {
        for (person in everyone) {
            jdbc.sql("delete from public.sessions where user_id = :id").param("id", person.id).update()
        }
        for (org in listOfNotNull(if (::orgA.isInitialized) orgA else null, if (::orgB.isInitialized) orgB else null)) {
            jdbc.sql("delete from public.organisations where id = :id").param("id", org).update()
        }
        for (id in templateIds) jdbc.sql("delete from public.programme_templates where id = :id").param("id", id).update()
        for (person in everyone) {
            jdbc.sql("delete from auth.users where id = :id").param("id", person.id).update()
        }
    }

    @Test
    fun `cloning creates exactly one published assignment per module, dated weekly at 09 00 IST, for the chosen batches`() {
        val startsOn = today.plusDays(3)
        val view = service.start(tpoA, orgA, StartProgrammeRequest(template.id, null, startsOn.toString(), listOf(cseBatch.id)))

        assertEquals(template.title, view.title)
        assertEquals(startsOn.toString(), view.startsOn)
        assertEquals(3, view.weeks)
        assertEquals("active", view.status)
        assertEquals(listOf(cseBatch.id), view.targetBatches.map { it.id })
        assertEquals(3, view.assignmentIds.size)

        val rows =
            jdbc
                .sql(
                    """
                    select x.id, x.status, x.programme_week, x.opens_at, x.due_at, x.title
                      from public.assignments x where x.org_id = :o and x.programme_id = :p order by x.programme_week
                    """.trimIndent(),
                ).param("o", orgA)
                .param("p", view.id)
                .query { rs, _ ->
                    listOf(
                        rs.getString("status"),
                        rs.getInt("programme_week"),
                        rs.getTimestamp("opens_at").toInstant(),
                        rs.getTimestamp("due_at").toInstant(),
                    )
                }.list()
        assertEquals(3, rows.size)
        for ((index, row) in rows.withIndex()) {
            val week = index + 1
            assertEquals(listOf("published", week, ProgrammeSchedule.opensAt(startsOn, week), ProgrammeSchedule.dueAt(startsOn, week)), row)
        }
        assertEquals(
            3L,
            jdbc
                .sql("select count(*) from public.assignment_targets where org_id = :o and batch_id = :b and assignment_id in (:ids)")
                .param("o", orgA)
                .param("b", cseBatch.id)
                .param("ids", view.assignmentIds)
                .query(Long::class.java)
                .single(),
        )
        // Module 9: no module has opened yet (the programme starts in 3 days), so nobody is
        // emailed now; each week is announced when it unlocks (CampusNotifications.queueOpenedAssignments).
        assertEquals(
            0L,
            jdbc
                .sql("select count(*) from public.email_deliveries where user_id = :u and category = 'campus_assignment'")
                .param("u", cse1.id)
                .query(Long::class.java)
                .single(),
        )
        assertEquals(1L, auditCount("programme.created"))
        assertEquals(3L, auditCount("assignment.published"))
    }

    @Test
    fun `a failure part-way through cloning leaves no programme and no assignment behind`() {
        // Break week 2 after the template was saved: a topic round with no topic fails the assignment rules.
        jdbc
            .sql(
                """
                update public.programme_templates
                   set modules = jsonb_set(modules, '{1,assignment}',
                         (modules #> '{1,assignment}') || '{"roundType":"custom_topic","focusTopic":null,"durationMinutes":30}')
                 where id = :id
                """.trimIndent(),
            ).param("id", template.id)
            .update()

        val error =
            assertThrows<ApiException> {
                service.start(tpoA, orgA, StartProgrammeRequest(template.id, null, today.toString(), listOf(cseBatch.id)))
            }
        assertEquals(HttpStatus.BAD_REQUEST, error.status)
        assertEquals("assignment_invalid", error.code)
        assertTrue(error.message.startsWith("Week 2:"), error.message)

        assertEquals(0L, count("select count(*) from public.programmes where org_id = :o"))
        assertEquals(0L, count("select count(*) from public.assignments where org_id = :o"))
        assertEquals(0L, auditCount("assignment.created"))
        assertEquals(
            0L,
            jdbc
                .sql("select count(*) from public.email_deliveries where user_id = :u and category = 'campus_assignment'")
                .param("u", cse1.id)
                .query(Long::class.java)
                .single(),
        )
    }

    @Test
    fun `College A can neither read College B's programmes nor clone into B's batches`() {
        val programmeB = service.start(adminB, orgB, StartProgrammeRequest(template.id, "B's run", today.toString(), listOf(batchB.id)))

        assertNotFound { service.start(tpoA, orgA, StartProgrammeRequest(template.id, null, today.toString(), listOf(batchB.id))) }
        assertNotFound { service.start(tpoA, orgB, StartProgrammeRequest(template.id, null, today.toString(), listOf(batchB.id))) }
        assertNotFound { service.get(adminA, orgA, programmeB.id) }
        assertNotFound { service.get(adminA, orgB, programmeB.id) }
        assertNotFound { service.progress(adminA, orgA, programmeB.id) }
        assertNotFound { service.weeks(adminA, orgA, programmeB.id) }
        assertNotFound { service.weeks(adminA, orgB, programmeB.id) }
        assertNotFound { service.archive(adminA, orgA, programmeB.id) }
        assertEquals(emptyList(), service.list(adminA, orgA))
        assertEquals(0L, count("select count(*) from public.programmes where org_id = :o"))
        // A's students do not see B's programme either.
        assertEquals(emptyList(), service.mine(cse1))
        assertEquals(listOf(programmeB.id), service.list(adminB, orgB).map { it.id })
    }

    @Test
    fun `a faculty member sees only programmes for their batches, and cannot start one`() {
        val forCse = service.start(tpoA, orgA, StartProgrammeRequest(template.id, "CSE run", today.toString(), listOf(cseBatch.id)))
        val forEce = service.start(tpoA, orgA, StartProgrammeRequest(template.id, "ECE run", today.toString(), listOf(eceBatch.id)))

        assertEquals(listOf(forCse.id), service.list(facultyA, orgA).map { it.id })
        assertNotFound { service.get(facultyA, orgA, forEce.id) }
        assertEquals(setOf(forCse.id, forEce.id), service.list(adminA, orgA).map { it.id }.toSet())
        val error =
            assertThrows<ApiException> {
                service.start(facultyA, orgA, StartProgrammeRequest(template.id, null, today.toString(), listOf(cseBatch.id)))
            }
        assertEquals(HttpStatus.FORBIDDEN, error.status)
        assertEquals(listOf(cse1Member), service.progress(facultyA, orgA, forCse.id).map { it.memberId })
        // The week-by-week view counts the same students and no others, and a programme outside the scope is a 404.
        assertEquals(setOf(1), service.weeks(facultyA, orgA, forCse.id).map { it.students }.toSet())
        assertNotFound { service.weeks(facultyA, orgA, forEce.id) }
    }

    @Test
    fun `the certificate is a 404 until every module is completed`() {
        val view = service.start(tpoA, orgA, StartProgrammeRequest(template.id, "Accelerator", today.toString(), listOf(cseBatch.id)))
        val (week1, week2, week3) = view.assignmentIds

        assertNotFound { service.certificate(cse1, view.id) }
        val mine = service.mine(cse1).single()
        assertEquals(0, mine.completedModules)
        assertEquals(3, mine.totalModules)
        assertNull(mine.certificateId)
        assertEquals(listOf(cseBatch.id), mine.targetBatches.map { it.id })

        completedAttempt(week1, Instant.parse("2026-12-01T10:00:00Z"))
        completedAttempt(week2, Instant.parse("2026-12-08T10:00:00Z"))
        assertNotFound { service.certificate(cse1, view.id) }
        assertEquals(2, service.mine(cse1).single().completedModules)

        completedAttempt(week3, Instant.parse("2026-12-15T10:00:00Z"))
        val certificate = service.certificate(cse1, view.id)
        assertEquals("Accelerator", certificate.programmeTitle)
        assertEquals("College A", certificate.orgName)
        assertEquals("Person ${cse1.id.toString().take(4)}", certificate.studentName)
        assertEquals("2026-12-15T10:00:00Z", certificate.completedAt)
        assertEquals(ProgrammeSchedule.certificateId(view.id, cse1Member), certificate.certificateId)
        assertEquals(certificate.certificateId, service.mine(cse1).single().certificateId)
        // Staff progress agrees, and nobody else gets this student's certificate.
        val progress = service.progress(adminA, orgA, view.id).single()
        assertEquals(3, progress.completedModules)
        assertTrue(progress.certificateIssued)
        assertNotFound { service.certificate(ece1, view.id) }
        assertNotFound { service.certificate(studentB, view.id) }
    }

    @Test
    fun `archiving a programme archives its assignments that have not opened yet`() {
        val view = service.start(tpoA, orgA, StartProgrammeRequest(template.id, null, today.toString(), listOf(cseBatch.id)))
        // Open week 1 now, as the clock would have.
        jdbc
            .sql(
                """
                update public.assignments set opens_at = now() - interval '1 hour'
                 where org_id = :o and programme_id = :p and programme_week = 1
                """.trimIndent(),
            ).param("o", orgA)
            .param("p", view.id)
            .update()

        val archived = service.archive(adminA, orgA, view.id)
        assertEquals("archived", archived.status)
        val statuses =
            jdbc
                .sql(
                    """
                    select programme_week, status from public.assignments
                     where org_id = :o and programme_id = :p order by programme_week
                    """.trimIndent(),
                ).param("o", orgA)
                .param("p", view.id)
                .query { rs, _ -> rs.getInt(1) to rs.getString(2) }
                .list()
        assertEquals(listOf(1 to "published", 2 to "archived", 3 to "archived"), statuses)
        assertEquals("archived", service.archive(adminA, orgA, view.id).status, "archiving twice is not an error")
        assertEquals(1L, auditCount("programme.archived"))
        // An archived programme the student has not finished drops off their list.
        assertEquals(emptyList(), service.mine(cse1))
    }

    @Test
    fun `deleting a template leaves the programmes started from it`() {
        val view = service.start(tpoA, orgA, StartProgrammeRequest(template.id, null, today.toString(), listOf(cseBatch.id)))
        service.deleteTemplate(operator, template.id)

        val kept = service.get(adminA, orgA, view.id)
        assertNull(kept.templateId)
        assertEquals(3, kept.assignmentIds.size)
        assertNotFound { service.deleteTemplate(operator, template.id) }
        assertNotFound { service.adminTemplates(adminA) }
        assertNotNull(service.templates(adminA, orgA))
    }

    // -- helpers ---------------------------------------------------------------------------

    private fun module(
        week: Int,
        title: String,
        roundType: String,
    ) = ProgrammeModule(
        week,
        ProgrammeAssignmentSpec(kind = "interview", title = title, roundType = roundType, durationMinutes = 30, attemptLimit = 2),
    )

    private fun completedAttempt(
        assignment: UUID,
        endedAt: Instant,
    ) {
        val sessionId =
            jdbc
                .sql(
                    """
                    insert into public.sessions (user_id, company_name, company_archetype, role_title, round_type, language,
                                                 status, started_at, ended_at)
                    values (:u, 'General practice', 'service_based_it', 'Software Engineer', 'technical_fundamentals', 'english',
                            'completed', cast(:at as timestamptz) - interval '30 minutes', cast(:at as timestamptz))
                    returning id
                    """.trimIndent(),
                ).param("u", cse1.id)
                .param("at", endedAt.toString())
                .query(UUID::class.java)
                .single()
        jdbc
            .sql(
                """
                insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded, status, started_at, ended_at)
                values (:org, :a, :m, :s, true, 'completed', cast(:at as timestamptz) - interval '30 minutes', cast(:at as timestamptz))
                """.trimIndent(),
            ).param("org", orgA)
            .param("a", assignment)
            .param("m", cse1Member)
            .param("s", sessionId)
            .param("at", endedAt.toString())
            .update()
    }

    private fun count(sql: String): Long =
        jdbc
            .sql(sql)
            .param("o", orgA)
            .query(Long::class.java)
            .single()

    private fun auditCount(action: String): Long =
        jdbc
            .sql("select count(*) from public.org_audit_log where org_id = :o and action = :a")
            .param("o", orgA)
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
            .sql(
                """
                insert into public.users (id, email, display_name) values (:id, :email, :name)
                on conflict (id) do update set display_name = excluded.display_name
                """.trimIndent(),
            ).param("id", who.id)
            .param("email", who.email)
            .param("name", "Person ${who.id.toString().take(4)}")
            .update()
    }

    private companion object {
        fun person(): SupabaseIdentity {
            val id = UUID.randomUUID()
            return SupabaseIdentity(id, "campus-prg-test-$id@example.invalid", null)
        }
    }
}
