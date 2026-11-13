package com.interviewos.api.campus

import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.email.EmailProperties
import com.interviewos.api.email.EmailService
import com.interviewos.api.email.LifecycleEmailJob
import com.interviewos.api.email.SesEmailSender
import com.interviewos.api.email.UpdateEmailPreferences
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
import org.mockito.ArgumentCaptor
import org.mockito.Mockito.atLeast
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.web.client.RestClient
import software.amazon.awssdk.services.sesv2.SesV2Client
import software.amazon.awssdk.services.sesv2.model.SendEmailRequest
import tools.jackson.databind.json.JsonMapper
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertTrue

/**
 * Module 9 against real Postgres with every migration applied: the outbox rows that publishing,
 * joining, reminders, finished rounds and the weekly summary queue, with College A and College B
 * side by side. A failure here is a merge blocker, as for [CampusIsolationDatabaseIntegrationTest].
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusNotificationDatabaseIntegrationTest {
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
    private val adminB = person()
    private val studentA = person()
    private val studentA2 = person()
    private val studentB = person()
    private val lateJoiner = person()
    private val everyone = listOf(operator, adminA, tpoA, adminB, studentA, studentA2, studentB, lateJoiner)

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
    private val notificationRepository = CampusNotificationRepository(jdbc)
    private val notifications = CampusNotifications(notificationRepository, features)
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features, notifications)

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var batchA: BatchView
    private lateinit var batchB: BatchView
    private lateinit var memberA: UUID
    private lateinit var memberA2: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "ntf-a-$suffix", interviewAllowance = 10)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "ntf-b-$suffix", interviewAllowance = 10)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgA, tpoA, CampusRole.TPO)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val departmentA = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        batchA = college.createBatch(adminA, orgA, CreateBatchRequest(departmentA.id, 2027, "CSE 2027"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        memberA = seedMember(orgA, studentA, CampusRole.STUDENT, batchA.id, "A-001")
        memberA2 = seedMember(orgA, studentA2, CampusRole.STUDENT, batchA.id, "A-002")
        seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "B-001")
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
    fun `publishing queues exactly one email per recipient, and never for another college`() {
        val inA = publishedInterview(adminA, orgA, batchA.id)

        assertEquals(1, rows(studentA, "campus_assignment"))
        assertEquals(1, rows(studentA2, "campus_assignment"))
        // Another college's student, and the staff who published it, are not recipients.
        assertEquals(0, rows(studentB, "campus_assignment"))
        assertEquals(0, rows(adminA, "campus_assignment"))
        assertEquals(0, rows(adminB, "campus_assignment"))

        // B publishing its own assignment reaches only B's student.
        publishedInterview(adminB, orgB, batchB.id)
        assertEquals(1, rows(studentB, "campus_assignment"))
        assertEquals(1, rows(studentA, "campus_assignment"))

        val body =
            jdbc
                .sql("select subject || ' ' || body from public.email_deliveries where user_id = :u and category = 'campus_assignment'")
                .param("u", studentA.id)
                .query(String::class.java)
                .single()
        assertTrue(body.contains("College A") && body.contains("Technical round") && body.contains("IST"), body)
        assertEquals(
            "campus-assignment-$inA",
            jdbc
                .sql("select dedupe_key from public.email_deliveries where user_id = :u and category = 'campus_assignment'")
                .param("u", studentA.id)
                .query(String::class.java)
                .single(),
        )
    }

    @Test
    fun `a retry or a second publish never duplicates the email`() {
        val inA = publishedInterview(adminA, orgA, batchA.id)

        // The service refuses a second publish; the notification itself is also idempotent.
        assertThrows<com.interviewos.api.common.ApiException> { assignments.publish(adminA, orgA, inA) }
        notifications.assignmentPublished(orgA, inA)
        notifications.assignmentPublished(orgA, inA)

        assertEquals(1, rows(studentA, "campus_assignment"))
        assertEquals(1, rows(studentA2, "campus_assignment"))
    }

    @Test
    fun `a student targeted by name and by batch still gets one email`() {
        val id =
            assignments
                .create(adminA, orgA, interviewRequest(batchIds = listOf(batchA.id), memberIds = listOf(memberA)))
                .id
        assignments.publish(adminA, orgA, id)

        assertEquals(1, rows(studentA, "campus_assignment"))
    }

    @Test
    fun `a student who joins the batch later is told about its open assignments, once`() {
        val inA = publishedInterview(adminA, orgA, batchA.id)
        val joined = seedMember(orgA, lateJoiner, CampusRole.STUDENT, batchA.id, "A-003")

        notifications.studentJoined(orgA, joined)
        notifications.studentJoined(orgA, joined)

        assertEquals(1, rows(lateJoiner, "campus_assignment"))
        assertEquals(
            "campus-assignment-$inA",
            jdbc
                .sql("select dedupe_key from public.email_deliveries where user_id = :u and category = 'campus_assignment'")
                .param("u", lateJoiner.id)
                .query(String::class.java)
                .single(),
        )
        // The students already in the batch are not emailed again.
        assertEquals(1, rows(studentA, "campus_assignment"))
    }

    @Test
    fun `an assignment that is already closed or archived is not announced to a late joiner`() {
        val inA = publishedInterview(adminA, orgA, batchA.id)
        assignments.archive(adminA, orgA, inA)
        val joined = seedMember(orgA, lateJoiner, CampusRole.STUDENT, batchA.id, "A-003")

        notifications.studentJoined(orgA, joined)

        assertEquals(0, rows(lateJoiner, "campus_assignment"))
    }

    @Test
    fun `the deadline reminder goes once to students who have not completed, and not for a fresh assignment`() {
        val soon = publishedInterview(adminA, orgA, batchA.id, dueInHours = 40)
        // Published days ago: the new-assignment email is long gone, so the reminder is due.
        jdbc.sql("update public.assignments set published_at = now() - interval '5 days' where id = :id").param("id", soon).update()
        // Published inside the window: it already said "due soon", so no reminder.
        publishedInterview(adminA, orgA, batchA.id, dueInHours = 30)
        // Not in the window yet.
        val later = publishedInterview(adminA, orgA, batchA.id, dueInHours = 120)
        jdbc.sql("update public.assignments set published_at = now() - interval '5 days' where id = :id").param("id", later).update()
        // studentA has completed the soon one.
        completeAttempt(soon, memberA, studentA)

        notifications.queueDeadlineReminders()
        notifications.queueDeadlineReminders()

        assertEquals(0, rows(studentA, "campus_reminder"))
        assertEquals(1, rows(studentA2, "campus_reminder"))
        assertEquals(0, rows(studentB, "campus_reminder"))
        assertEquals(
            "campus-reminder-$soon",
            jdbc
                .sql("select dedupe_key from public.email_deliveries where user_id = :u and category = 'campus_reminder'")
                .param("u", studentA2.id)
                .query(String::class.java)
                .single(),
        )
    }

    @Test
    fun `a finished assigned round queues one report email for the student, and a personal round none`() {
        val inA = publishedInterview(adminA, orgA, batchA.id)
        val session = insertSession(studentA)
        insertAttempt(inA, memberA, session, "in_progress")

        notifications.roundCompleted(session)
        assertEquals(0, rows(studentA, "campus_report_ready"), "an unfinished attempt must not announce a report")

        jdbc
            .sql(
                "update public.assignment_attempts set status = 'completed', ended_at = now() where session_id = :s",
            ).param("s", session)
            .update()
        notifications.roundCompleted(session)
        notifications.roundCompleted(session)
        assertEquals(1, rows(studentA, "campus_report_ready"))
        assertEquals(0, rows(adminA, "campus_report_ready"))
        val text =
            jdbc
                .sql("select subject || ' ' || body from public.email_deliveries where user_id = :u and category = 'campus_report_ready'")
                .param("u", studentA.id)
                .query(String::class.java)
                .single()
                .lowercase()
        assertTrue(!Regex("score|rating|%").containsMatchIn(text), text)

        val personal = insertSession(studentA2)
        notifications.roundCompleted(personal)
        assertEquals(0, rows(studentA2, "campus_report_ready"))
    }

    @Test
    fun `the weekly summary goes to the admin and the placement officer of each college, once a week`() {
        publishedInterview(adminA, orgA, batchA.id)
        val monday =
            CampusNotifications(notificationRepository, features, Clock.fixed(Instant.parse("2026-11-16T04:00:00Z"), ZoneOffset.UTC))

        monday.queueWeeklySummaries()
        monday.queueWeeklySummaries()

        assertEquals(1, rows(adminA, "campus_weekly"))
        assertEquals(1, rows(tpoA, "campus_weekly"))
        assertEquals(1, rows(adminB, "campus_weekly"))
        assertEquals(0, rows(studentA, "campus_weekly"))
        val key =
            jdbc
                .sql(
                    "select dedupe_key from public.email_deliveries where user_id = :u and category = 'campus_weekly'",
                ).param("u", adminA.id)
                .query(String::class.java)
                .single()
        assertEquals("campus-weekly-$orgA-2026-11-09", key)

        // The next Monday is a new week, so a new email; a Tuesday sends nothing.
        CampusNotifications(
            notificationRepository,
            features,
            Clock.fixed(Instant.parse("2026-11-23T04:00:00Z"), ZoneOffset.UTC),
        ).queueWeeklySummaries()
        CampusNotifications(
            notificationRepository,
            features,
            Clock.fixed(Instant.parse("2026-11-24T04:00:00Z"), ZoneOffset.UTC),
        ).queueWeeklySummaries()
        assertEquals(2, rows(adminA, "campus_weekly"))
    }

    @Test
    fun `with the campus switch off nothing is queued`() {
        val off = ProductFeatureProperties(campus = false)
        val offAssignments =
            CampusAssignmentService(access, assignmentRepository, audit, off, CampusNotifications(notificationRepository, off))
        val id = assignments.create(adminA, orgA, interviewRequest(batchIds = listOf(batchA.id))).id

        offAssignments.publish(adminA, orgA, id)

        assertEquals(0, rows(studentA, "campus_assignment"))
        assertEquals(0, CampusNotifications(notificationRepository, off).queueDeadlineReminders())
        assertEquals(0, CampusNotifications(notificationRepository, off).queueWeeklySummaries())
    }

    @Test
    fun `a student who turned campus reminders off still gets the new assignment but no reminder or report email`() {
        val optedOut = SupabaseIdentity(studentA2.id, studentA2.email, null)
        EmailService(jdbc, users).updatePreferences(optedOut, UpdateEmailPreferences(false, false, false, campusReminders = false))

        val soon = publishedInterview(adminA, orgA, batchA.id, dueInHours = 40)
        jdbc.sql("update public.assignments set published_at = now() - interval '5 days' where id = :id").param("id", soon).update()
        notifications.queueDeadlineReminders()
        val session = insertSession(studentA2)
        insertAttempt(soon, memberA2, session, "completed")
        notifications.roundCompleted(session)

        // Queued (the preference is applied by the sender, and by cancelling on change)...
        assertEquals(1, rows(studentA2, "campus_assignment"))
        // ...and the sender sends the essential email and cancels the optional ones.
        val client = mock(SesV2Client::class.java)
        val job =
            LifecycleEmailJob(
                jdbc,
                EmailProperties(enabled = true),
                RestClient.builder(),
                SesEmailSender(client, EmailProperties()),
                features,
            )
        jdbc
            .sql(
                "update public.email_deliveries set next_attempt_at = now() - interval '1 year' where user_id in (:a, :b) and category like 'campus%'",
            ).param("a", studentA2.id)
            .param("b", studentA.id)
            .update()
        repeat(10) { job.dispatch() }

        assertEquals("sent", statusOf(studentA2, "campus_assignment"))
        assertEquals("cancelled", statusOf(studentA2, "campus_reminder"))
        assertEquals("cancelled", statusOf(studentA2, "campus_report_ready"))
        // The student who kept the default still gets theirs.
        assertEquals("sent", statusOf(studentA, "campus_assignment"))
        assertEquals("sent", statusOf(studentA, "campus_reminder"))
        val sent = ArgumentCaptor.forClass(SendEmailRequest::class.java)
        verify(client, atLeast(1)).sendEmail(sent.capture())
    }

    @Test
    fun `turning reminders off later cancels the pending optional emails but not the assignment`() {
        val soon = publishedInterview(adminA, orgA, batchA.id, dueInHours = 40)
        jdbc.sql("update public.assignments set published_at = now() - interval '5 days' where id = :id").param("id", soon).update()
        notifications.queueDeadlineReminders()
        assertEquals("pending", statusOf(studentA2, "campus_reminder"))

        EmailService(jdbc, users).updatePreferences(
            SupabaseIdentity(studentA2.id, studentA2.email, null),
            UpdateEmailPreferences(false, false, false, campusReminders = false),
        )

        assertEquals("cancelled", statusOf(studentA2, "campus_reminder"))
        assertEquals("pending", statusOf(studentA2, "campus_assignment"))
        // Leaving campusReminders out of the request leaves the setting alone.
        EmailService(jdbc, users).updatePreferences(
            SupabaseIdentity(studentA2.id, studentA2.email, null),
            UpdateEmailPreferences(false, false, false),
        )
        assertEquals(
            false,
            jdbc
                .sql(
                    "select campus_reminders from public.email_preferences where user_id = :u",
                ).param("u", studentA2.id)
                .query(Boolean::class.java)
                .single(),
        )
    }

    // -- helpers ---------------------------------------------------------------

    private fun rows(
        who: SupabaseIdentity,
        category: String,
    ): Int =
        jdbc
            .sql("select count(*) from public.email_deliveries where user_id = :u and category = :c")
            .param("u", who.id)
            .param("c", category)
            .query(Int::class.java)
            .single()

    private fun statusOf(
        who: SupabaseIdentity,
        category: String,
    ): String =
        jdbc
            .sql("select status from public.email_deliveries where user_id = :u and category = :c")
            .param("u", who.id)
            .param("c", category)
            .query(String::class.java)
            .single()

    private fun publishedInterview(
        admin: SupabaseIdentity,
        org: UUID,
        batchId: UUID,
        dueInHours: Long = 7 * 24,
    ): UUID {
        val id = assignments.create(admin, org, interviewRequest(batchIds = listOf(batchId), dueInHours = dueInHours)).id
        assignments.publish(admin, org, id)
        return id
    }

    private fun interviewRequest(
        batchIds: List<UUID> = emptyList(),
        memberIds: List<UUID> = emptyList(),
        dueInHours: Long = 7 * 24,
    ) = AssignmentRequest(
        kind = "interview",
        title = "Technical round",
        roundType = "technical_fundamentals",
        durationMinutes = 30,
        dueAt = Instant.now().plus(dueInHours, ChronoUnit.HOURS).toString(),
        allowLate = false,
        attemptLimit = 2,
        targets = AssignmentTargets(batchIds = batchIds, memberIds = memberIds),
    )

    private fun completeAttempt(
        assignmentId: UUID,
        member: UUID,
        who: SupabaseIdentity,
    ) = insertAttempt(assignmentId, member, insertSession(who), "completed")

    private fun insertAttempt(
        assignmentId: UUID,
        member: UUID,
        session: UUID,
        status: String,
    ) {
        jdbc
            .sql(
                """
                insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded, status, ended_at)
                select a.org_id, a.id, :m, :s, true, :status, case when :status = 'in_progress' then null else now() end
                  from public.assignments a where a.id = :a
                """.trimIndent(),
            ).param("m", member)
            .param("s", session)
            .param("status", status)
            .param("a", assignmentId)
            .update()
    }

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
            return SupabaseIdentity(id, "campus-ntf-test-$id@example.invalid", null)
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
