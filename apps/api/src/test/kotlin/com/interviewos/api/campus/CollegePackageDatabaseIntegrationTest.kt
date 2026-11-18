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
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Contract "Module 14" against real Postgres with every migration applied: College A and
 * College B side by side. Package-funded admission (the package written on the attempt, the
 * earliest end first, the per-student limit, the failed-attempt refund, the allowance when a
 * college has no package), the organisation lock that stops two racing starts from spending
 * a package's last interview twice, tenant isolation of packages, and the reminder job's
 * idempotency. A failure here is a merge blocker, as for [CampusAssignmentDatabaseIntegrationTest].
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CollegePackageDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)
    private val transactionManager = DataSourceTransactionManager(dataSource)
    private val transactions = TransactionTemplate(transactionManager)

    private val operator = person()
    private val adminA = person()
    private val tpoA = person()
    private val adminB = person()
    private val studentA = person()
    private val studentA2 = person()
    private val studentB = person()
    private val everyone = listOf(operator, adminA, tpoA, adminB, studentA, studentA2, studentB)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val features = ProductFeatureProperties(campus = true)
    private val users = UserRepository(jdbc)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), users)
    private val orgs = OrganisationRepository(jdbc)
    private val structure = StructureRepository(jdbc)
    private val members = MemberRepository(jdbc)
    private val assignmentRepository = AssignmentRepository(jdbc)
    private val packageRepository = CollegePackageRepository(jdbc)
    private val audit = CampusAudit(jdbc, JsonMapper.builder().build())
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, structure, members, audit, logos)
    private val platform = CampusAdminService(access, orgs, audit, logos, NoStorage, transactionManager)
    private val notifications = CampusNotifications(CampusNotificationRepository(jdbc), features)
    private val assignments = CampusAssignmentService(access, assignmentRepository, audit, features, notifications)
    private val admission = AssignedRoundAdmission(access, assignmentRepository, features, notifications)
    private val packages = CollegePackageService(access, packageRepository, orgs, audit, CollegeBillingProperties())
    private val reminders = CollegePackageReminders(packageRepository, features, transactionManager)

    private val today: LocalDate = CollegePackages.today(Instant.now())

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var batchA: BatchView
    private lateinit var batchB: BatchView
    private lateinit var memberA: UUID

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "pkg-a-$suffix", interviewAllowance = 0)).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "pkg-b-$suffix", interviewAllowance = 0)).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgA, tpoA, CampusRole.TPO)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val departmentA = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        batchA = college.createBatch(adminA, orgA, CreateBatchRequest(departmentA.id, 2027, "CSE 2027"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        memberA = seedMember(orgA, studentA, CampusRole.STUDENT, batchA.id, "A-001")
        seedMember(orgA, studentA2, CampusRole.STUDENT, batchA.id, "A-002")
        seedMember(orgB, studentB, CampusRole.STUDENT, batchB.id, "B-001")
    }

    @AfterEach
    fun cleanUp() {
        for (person in everyone) {
            jdbc.sql("delete from public.email_deliveries where user_id = :id").param("id", person.id).update()
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
    fun `a college with no package keeps its allowance exactly as before`() {
        jdbc.sql("update public.organisations set interview_allowance = 1 where id = :id").param("id", orgA).update()
        val inA = publishedInterview(orgA, batchA.id)

        val session = start(studentA, inA)
        assertNull(packageOf(session))
        assertEquals("college_allowance_exhausted", refusal(studentA2, inA).code)

        // A draft is the operator's working, not a package: the allowance still decides.
        packages.create(operator, orgA, request(interviews = 50))
        assertEquals("college_allowance_exhausted", refusal(studentA2, inA).code)
    }

    @Test
    fun `an issued package funds the interview and the attempt records it`() {
        val pkg = issued(orgA, interviews = 10)
        val inA = publishedInterview(orgA, batchA.id)

        val session = start(studentA, inA)

        assertEquals(pkg, packageOf(session))
        // The allowance is 0, and it no longer matters.
        assertEquals(true, assignments.mine(studentA2).single().canStart)
        val view = packages.adminList(operator, orgA).single()
        assertEquals(1, view.interviewsUsed)
        assertEquals(9, view.interviewsRemaining)
        assertEquals(9, packages.collegeView(tpoA, orgA).current?.interviewsRemaining)
    }

    @Test
    fun `the earliest-ending package is spent first, then the next`() {
        val later = issued(orgA, interviews = 5, startsOn = today.minusDays(5), endsOn = today.plusDays(200))
        val sooner = issued(orgA, interviews = 1, startsOn = today.minusDays(100), endsOn = today.plusDays(10))
        val inA = publishedInterview(orgA, batchA.id)

        assertEquals(sooner, packageOf(start(studentA, inA)))
        assertEquals(later, packageOf(start(studentA2, inA)))
    }

    @Test
    fun `the per-student limit refuses that student only, in the list and at admission`() {
        issued(orgA, interviews = 10, perStudentLimit = 1)
        val first = publishedInterview(orgA, batchA.id)
        val second = publishedInterview(orgA, batchA.id)

        start(studentA, first)

        val mine = assignments.mine(studentA).single { it.id == second }
        assertEquals(false, mine.canStart)
        assertEquals("package_student_limit", mine.blockedReason)
        assertEquals("package_student_limit", refusal(studentA, second).code)
        // Another student of the same college is unaffected.
        start(studentA2, second)
    }

    @Test
    fun `a failed attempt hands its interview back to the package`() {
        val pkg = issued(orgA, interviews = 1)
        val inA = publishedInterview(orgA, batchA.id)
        val session = start(studentA, inA)
        assertEquals("college_allowance_exhausted", refusal(studentA2, inA).code)

        jdbc
            .sql("update public.assignment_attempts set status = 'failed', ended_at = now() where session_id = :s")
            .param("s", session)
            .update()

        assertEquals(pkg, packageOf(start(studentA2, inA)))
    }

    @Test
    fun `a package outside its window, or past its grace, funds nothing`() {
        val inA = publishedInterview(orgA, batchA.id)
        issued(orgA, interviews = 10, startsOn = today.plusDays(1), endsOn = today.plusDays(100))
        assertEquals("college_package_inactive", refusal(studentA, inA).code)

        // Ended 14 days ago with 14 days' grace: today is the last usable day.
        issued(orgA, interviews = 10, startsOn = today.minusDays(100), endsOn = today.minusDays(14), graceDays = 14)
        start(studentA, inA)
        // Ended 15 days ago: lapsed.
        jdbc
            .sql("update public.college_packages set ends_on = ends_on - 1 where org_id = :o and ends_on < :t")
            .param("o", orgA)
            .param("t", today)
            .update()
        assertEquals("college_package_inactive", refusal(studentA2, inA).code)
    }

    @Test
    fun `two starts racing for the last interview of a package admit exactly one`() {
        issued(orgA, interviews = 1)
        val inA = publishedInterview(orgA, batchA.id)

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
            val refused = outcomes.single { it.isFailure }.exceptionOrNull()
            assertTrue(refused is ApiException, refused.toString())
            assertEquals("college_allowance_exhausted", refused.code)
            assertEquals(
                1L,
                count("select count(*) from public.assignment_attempts where org_id = :o and package_id is not null", mapOf("o" to orgA)),
            )
        } finally {
            pool.shutdownNow()
        }
    }

    @Test
    fun `one college's packages are invisible and untouchable from another, in the service and the database`() {
        val inB = issued(orgB, interviews = 10)
        issued(orgA, interviews = 10)

        assertNotFound { packages.update(operator, orgA, inB, PackageRequest(interviews = 5)) }
        assertNotFound { packages.void(operator, orgA, inB) }
        assertTrue(packages.adminList(operator, orgA).none { it.id == inB })
        assertTrue(
            packages
                .collegeView(adminA, orgA)
                .packages
                .orEmpty()
                .none { it.id == inB },
        )
        // College A's staff cannot read College B at all.
        assertNotFound { packages.collegeView(adminA, orgB) }
        // A student is not staff.
        assertNotFound { packages.collegeView(studentA, orgA) }

        // The composite key refuses an A attempt charged to B's package even if a bug tried it.
        val inA = publishedInterview(orgA, batchA.id)
        val session = start(studentA, inA)
        assertThrows<DataAccessException> {
            jdbc
                .sql("update public.assignment_attempts set package_id = :p where session_id = :s")
                .param("p", inB)
                .param("s", session)
                .update()
        }
        // And B's package is untouched by A's start.
        assertEquals(0, packages.adminList(operator, orgB).single().interviewsUsed)
    }

    @Test
    fun `payment rows survive the deletion of whoever recorded them`() {
        val pkg = issued(orgA, interviews = 10)
        jdbc.sql("delete from public.users where id = :id").param("id", operator.id).update()

        assertEquals(
            1L,
            count("select count(*) from public.college_packages where id = :p and created_by is null", mapOf("p" to pkg)),
        )
    }

    @Test
    fun `every package change is on the college's audit log as the platform admin`() {
        val id = packages.create(operator, orgA, request(interviews = 10)).id
        packages.update(operator, orgA, id, PackageRequest(interviews = 12))
        packages.invoice(operator, orgA, id, InvoicePackageRequest(invoicedOn = today.toString()))
        packages.markPaid(operator, orgA, id, PayPackageRequest(paymentReference = "NEFT 1"))

        val actions =
            jdbc
                .sql(
                    "select action from public.org_audit_log where org_id = :o and target_id = :t and actor_kind = 'platform_admin' order by id",
                ).param("o", orgA)
                .param("t", id)
                .query(String::class.java)
                .list()
        assertEquals(listOf("package.created", "package.updated", "package.invoiced", "package.paid"), actions)
    }

    @Test
    fun `the renewal reminder goes to admins and placement officers once per package per kind`() {
        val pkg = issued(orgA, interviews = 10, startsOn = today.minusDays(100), endsOn = today.plusDays(20))

        val first = reminders.queueDue()
        val second = reminders.queueDue()

        // Other colleges in the same database may queue too; this college's two staff do.
        assertTrue(first >= 2, "queued $first")
        assertEquals(0, second)
        val recipients =
            jdbc
                .sql("select user_id from public.email_deliveries where category = 'campus_billing' and dedupe_key like :k")
                .param("k", "campus-package-$pkg-%")
                .query(UUID::class.java)
                .list()
                .toSet()
        assertEquals(setOf(adminA.id, tpoA.id), recipients)
        assertEquals(
            1L,
            count("select count(*) from public.college_package_reminders where package_id = :p and kind = 'ends_in_30'", mapOf("p" to pkg)),
        )
    }

    @Test
    fun `a recorded renewal silences the reminder`() {
        issued(orgA, interviews = 10, startsOn = today.minusDays(100), endsOn = today.plusDays(5))
        issued(orgA, interviews = 10, startsOn = today.plusDays(6), endsOn = today.plusDays(200), paid = false)

        reminders.queueDue()
        assertEquals(0L, count("select count(*) from public.college_package_reminders where org_id = :o", mapOf("o" to orgA)))
    }

    // -- helpers ---------------------------------------------------------------

    private fun request(
        interviews: Int,
        perStudentLimit: Int? = null,
        startsOn: LocalDate = today.minusDays(30),
        endsOn: LocalDate = today.plusDays(150),
        graceDays: Int = 14,
    ) = PackageRequest(
        interviews = interviews,
        perStudentLimit = perStudentLimit,
        startsOn = startsOn.toString(),
        endsOn = endsOn.toString(),
        graceDays = graceDays,
        amountPaise = 9_900_000,
        invoiceNumber = "UT-${UUID.randomUUID().toString().take(6)}",
    )

    /** A package created, invoiced and (by default) paid, through the platform-admin service. */
    private fun issued(
        org: UUID,
        interviews: Int,
        perStudentLimit: Int? = null,
        startsOn: LocalDate = today.minusDays(30),
        endsOn: LocalDate = today.plusDays(150),
        graceDays: Int = 14,
        paid: Boolean = true,
    ): UUID {
        val id = packages.create(operator, org, request(interviews, perStudentLimit, startsOn, endsOn, graceDays)).id
        packages.invoice(operator, org, id, InvoicePackageRequest())
        if (paid) packages.markPaid(operator, org, id, PayPackageRequest(paymentReference = "NEFT"))
        return id
    }

    private fun start(
        who: SupabaseIdentity,
        assignmentId: UUID,
    ): UUID = transactions.execute { admission.admit(who, assignmentId) { insertSession(who) } }!!

    private fun refusal(
        who: SupabaseIdentity,
        assignmentId: UUID,
    ): ApiException = assertThrows<ApiException> { start(who, assignmentId) }

    private fun packageOf(session: UUID): UUID? =
        jdbc
            .sql("select package_id from public.assignment_attempts where session_id = :s")
            .param("s", session)
            .query { rs, _ -> rs.getString("package_id")?.let(UUID::fromString) }
            .single()

    private fun publishedInterview(
        org: UUID,
        batchId: UUID,
    ): UUID {
        val admin = if (org == orgA) adminA else adminB
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
                        targets = AssignmentTargets(batchIds = listOf(batchId)),
                    ),
                ).id
        assignments.publish(admin, org, id)
        return id
    }

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
            return SupabaseIdentity(id, "campus-pkg-test-$id@example.invalid", null)
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
