package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.interview.ReportService
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
import org.mockito.Mockito.mock
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import tools.jackson.databind.json.JsonMapper
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Module 8 against real Postgres with every migration applied: College A and College B side by
 * side. College A's staff can neither read nor write College B's notes; a faculty member's
 * attention list and notes are narrowed to their batches; a note never reaches a student route;
 * and notes go with the student's membership. A failure here is a merge blocker, as for
 * [CampusIsolationDatabaseIntegrationTest]. No model is called.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusFacultyDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)

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
    private val readinessRepository = ReadinessRepository(jdbc)
    private val mapper = JsonMapper.builder().build()
    private val audit = CampusAudit(jdbc, mapper)
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, StructureRepository(jdbc), MemberRepository(jdbc), audit, logos)
    private val platform =
        CampusAdminService(access, orgs, audit, logos, NoObjectStorage, DataSourceTransactionManager(dataSource))
    private val notifications = CampusNotifications(CampusNotificationRepository(jdbc), features)
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features, notifications)
    private val readiness =
        CampusReadinessService(access, readinessRepository, assignmentRepository, audit, mock(ReportService::class.java), mapper)
    private val faculty = CampusFacultyService(access, readiness, readinessRepository, StaffCommentRepository(jdbc), audit)

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var cseBatch: BatchView
    private lateinit var eceBatch: BatchView
    private lateinit var cse1Member: UUID
    private lateinit var ece1Member: UUID
    private lateinit var memberB: UUID
    private lateinit var interviewA: UUID
    private lateinit var interviewB: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "fac-a-$suffix", interviewAllowance = 50)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "fac-b-$suffix", interviewAllowance = 50)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgA, tpoA, CampusRole.TPO)
        val facultyMember = seedMember(orgA, facultyA, CampusRole.FACULTY)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val cse = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val ece = college.createDepartment(adminA, orgA, CreateDepartmentRequest("ECE", "Electronics"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        cseBatch = college.createBatch(adminA, orgA, CreateBatchRequest(cse.id, 2027, "CSE 2027"))
        eceBatch = college.createBatch(adminA, orgA, CreateBatchRequest(ece.id, 2027, "ECE 2027"))
        val batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        jdbc
            .sql("insert into public.org_faculty_scopes (org_id, member_id, batch_id) values (:org, :m, :b)")
            .param("org", orgA)
            .param("m", facultyMember)
            .param("b", cseBatch.id)
            .update()
        cse1Member = seedMember(orgA, cse1, CampusRole.STUDENT, cseBatch.id, "A-001")
        ece1Member = seedMember(orgA, ece1, CampusRole.STUDENT, eceBatch.id, "A-101")
        memberB = seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "B-001")
        interviewA = publishedInterview(adminA, orgA, listOf(cseBatch.id, eceBatch.id))
        interviewB = publishedInterview(adminB, orgB, listOf(batchB.id))
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
    fun `College A can neither read nor write College B's notes`() {
        val noteB = faculty.create(adminB, orgB, memberB, StaffCommentRequest("Needs mock practice."))
        val sessionB = completedAttempt(orgB, interviewB, memberB, studentB)

        assertNotFound { faculty.comments(adminA, orgA, memberB) }
        assertNotFound { faculty.comments(adminA, orgB, memberB) }
        assertNotFound { faculty.create(adminA, orgA, memberB, StaffCommentRequest("Hello")) }
        assertNotFound { faculty.update(adminA, orgA, noteB.id, StaffCommentRequest("Edited")) }
        assertNotFound { faculty.delete(adminA, orgA, noteB.id) }
        assertNotFound { faculty.update(adminA, orgB, noteB.id, StaffCommentRequest("Edited")) }
        // B's session on A's student is not one of that student's assigned sessions.
        assertNotFound { faculty.create(adminA, orgA, cse1Member, StaffCommentRequest("Hi", sessionB)) }

        val inB = faculty.comments(adminB, orgB, memberB)
        assertEquals(listOf("Needs mock practice."), inB.map { it.body })
        assertTrue(inB.single().isMine)
        assertEquals(0L, count("select count(*) from public.campus_staff_comments where org_id = :o", orgA))
        assertTrue(faculty.attention(adminA, orgA, null).none { it.memberId == memberB })
    }

    @Test
    fun `a faculty member's attention list and notes are narrowed to their batches`() {
        val attention = faculty.attention(facultyA, orgA, null)
        assertEquals(listOf(cse1Member), attention.map { it.memberId })
        assertEquals(setOf(cse1Member, ece1Member), faculty.attention(adminA, orgA, null).map { it.memberId }.toSet())

        val adminNote = faculty.create(adminA, orgA, ece1Member, StaffCommentRequest("ECE note"))
        assertNotFound { faculty.comments(facultyA, orgA, ece1Member) }
        assertNotFound { faculty.create(facultyA, orgA, ece1Member, StaffCommentRequest("Hello")) }
        assertNotFound { faculty.update(facultyA, orgA, adminNote.id, StaffCommentRequest("Edited")) }
        assertNotFound { faculty.delete(facultyA, orgA, adminNote.id) }

        val mine = faculty.create(facultyA, orgA, cse1Member, StaffCommentRequest("CSE note"))
        assertEquals(listOf("CSE note"), faculty.comments(facultyA, orgA, cse1Member).map { it.body })
        // Every staff role reads it; only the author is told it is theirs, and only the author edits it.
        val seenByTpo = faculty.comments(tpoA, orgA, cse1Member).single()
        assertEquals(false, seenByTpo.isMine)
        assertForbidden { faculty.update(tpoA, orgA, mine.id, StaffCommentRequest("TPO edit")) }
        assertForbidden { faculty.delete(tpoA, orgA, mine.id) }
        val edited = faculty.update(facultyA, orgA, mine.id, StaffCommentRequest("CSE note, revised"))
        assertEquals("CSE note, revised", edited.body)
        assertTrue(edited.editedAt != null)
        // A college admin may delete anyone's note.
        faculty.delete(adminA, orgA, mine.id)
        assertEquals(emptyList(), faculty.comments(facultyA, orgA, cse1Member))
    }

    @Test
    fun `the attention list carries the readiness reasons`() {
        // Make A's assignment overdue for everyone, and make cse1 recently active.
        jdbc
            .sql("update public.assignments set opens_at = now() - interval '9 days', due_at = now() - interval '1 day' where id = :id")
            .param("id", interviewA)
            .update()
        completedSession(cse1)

        val rows = faculty.attention(adminA, orgA, null)
        val byMember = rows.associateBy { it.memberId }
        assertEquals(listOf("overdue"), byMember.getValue(cse1Member).reasons)
        assertEquals(listOf("inactive", "overdue"), byMember.getValue(ece1Member).reasons)
        assertEquals(listOf(ece1Member, cse1Member), rows.map { it.memberId }, "most reasons first")
        assertEquals(listOf(ece1Member), faculty.attention(adminA, orgA, "inactive").map { it.memberId })
        assertEquals(1, byMember.getValue(cse1Member).overdue)
    }

    @Test
    fun `a note may name one of the student's assigned rounds, never a personal one`() {
        val personal = completedSession(cse1)
        val assigned = completedAttempt(orgA, interviewA, cse1Member, cse1)

        assertNotFound { faculty.create(adminA, orgA, cse1Member, StaffCommentRequest("On personal", personal)) }
        assertNotFound { faculty.create(adminA, orgA, ece1Member, StaffCommentRequest("Someone else's", assigned)) }
        val note = faculty.create(adminA, orgA, cse1Member, StaffCommentRequest("Good on indexes", assigned))
        assertEquals(assigned, note.sessionId)

        val audited =
            jdbc
                .sql("select detail::text from public.org_audit_log where org_id = :o and action = 'staff_comment.created'")
                .param("o", orgA)
                .query(String::class.java)
                .single()
        assertTrue(!audited.contains("indexes"), "the audit entry never holds the note's text: $audited")
    }

    @Test
    fun `a note never reaches a student route`() {
        completedAttempt(orgA, interviewA, cse1Member, cse1)
        faculty.create(adminA, orgA, cse1Member, StaffCommentRequest("PRIVATE-NOTE-MARKER"))

        val ownReadiness = mapper.writeValueAsString(readiness.mine(cse1))
        val ownAssignments = mapper.writeValueAsString(assignments.mine(cse1))
        assertTrue(!ownReadiness.contains("PRIVATE-NOTE-MARKER"), ownReadiness)
        assertTrue(!ownAssignments.contains("PRIVATE-NOTE-MARKER"), ownAssignments)
        // And a student is not staff: the notes route itself is a 404 to them.
        assertNotFound { faculty.comments(cse1, orgA, cse1Member) }
    }

    @Test
    fun `notes go with the student's membership`() {
        faculty.create(adminA, orgA, cse1Member, StaffCommentRequest("One"))
        faculty.create(facultyA, orgA, cse1Member, StaffCommentRequest("Two"))
        assertEquals(2L, count("select count(*) from public.campus_staff_comments where org_id = :o", orgA))

        jdbc.sql("delete from auth.users where id = :id").param("id", cse1.id).update()

        assertEquals(0L, count("select count(*) from public.campus_staff_comments where org_id = :o", orgA))
    }

    @Test
    fun `a deleted author's note stays, without a name`() {
        val note = faculty.create(facultyA, orgA, cse1Member, StaffCommentRequest("Kept"))
        jdbc.sql("delete from auth.users where id = :id").param("id", facultyA.id).update()

        val kept = faculty.comments(adminA, orgA, cse1Member).single()
        assertEquals(note.id, kept.id)
        assertNull(kept.authorName)
        assertEquals(false, kept.isMine)
    }

    // -- helpers ---------------------------------------------------------------------------

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
                    ),
                ).id
        assignments.publish(admin, org, id)
        return id
    }

    private fun completedSession(who: SupabaseIdentity): UUID =
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

    private fun completedAttempt(
        org: UUID,
        assignment: UUID,
        memberId: UUID,
        who: SupabaseIdentity,
    ): UUID {
        val sessionId = completedSession(who)
        jdbc
            .sql(
                """
                insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded, status, started_at, ended_at)
                values (:org, :a, :m, :s, true, 'completed', now() - interval '30 minutes', now())
                """.trimIndent(),
            ).param("org", org)
            .param("a", assignment)
            .param("m", memberId)
            .param("s", sessionId)
            .update()
        return sessionId
    }

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

    private fun assertForbidden(block: () -> Unit) {
        val error = assertThrows<ApiException> { block() }
        assertEquals(HttpStatus.FORBIDDEN, error.status, error.message)
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
            .sql("insert into public.users (id, email, display_name) values (:id, :email, :name) on conflict (id) do nothing")
            .param("id", who.id)
            .param("email", who.email)
            .param("name", "Person ${who.id.toString().take(4)}")
            .update()
    }

    private companion object {
        fun person(): SupabaseIdentity {
            val id = UUID.randomUUID()
            return SupabaseIdentity(id, "campus-fac-test-$id@example.invalid", null)
        }
    }
}
