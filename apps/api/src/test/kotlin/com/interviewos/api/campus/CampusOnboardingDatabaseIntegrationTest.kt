package com.interviewos.api.campus

import com.interviewos.api.account.AccountRepository
import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.email.EmailProperties
import com.interviewos.api.email.SesEmailSender
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
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.willAnswer
import org.mockito.Mockito.mock
import org.springframework.dao.DataAccessException
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import org.springframework.transaction.support.TransactionTemplate
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertContentEquals
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/**
 * Module 3 against real Postgres with every migration applied: imports, invites, the invite
 * email job and joining, with College A and College B side by side. A failure here is a merge
 * blocker, as for [CampusIsolationDatabaseIntegrationTest]. Services run without Spring
 * proxies; where a transaction matters (accept, the race), the test opens one.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusOnboardingDatabaseIntegrationTest {
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
    private val memberA = person()
    private val memberB = person()
    private val joinerOne = person()
    private val joinerTwo = person()
    private val everyone = listOf(operator, adminA, adminB, memberA, memberB, joinerOne, joinerTwo)

    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operator.id.toString()))
    private val users = UserRepository(jdbc)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), users)
    private val orgs = OrganisationRepository(jdbc)
    private val structure = StructureRepository(jdbc)
    private val members = MemberRepository(jdbc)
    private val invites = InviteRepository(jdbc)
    private val audit = CampusAudit(jdbc, JsonMapper.builder().build())
    private val logos = OrgLogos(StorageProperties())
    private val college = CampusOrgService(access, orgs, structure, members, audit, logos)
    private val platform = CampusAdminService(access, orgs, audit, logos, NoStorage, DataSourceTransactionManager(dataSource))
    private val onboarding = CampusOnboardingService(access, invites, structure, audit)
    private val notifications = CampusNotifications(CampusNotificationRepository(jdbc), ProductFeatureProperties(campus = true))
    private val join =
        CampusJoinService(invites, access, audit, users, MeCampusService(access, members, audit, logos), logos, notifications)

    private lateinit var orgA: UUID
    private lateinit var orgB: UUID
    private lateinit var batchA: BatchView
    private lateinit var batchB: BatchView
    private lateinit var batchBOnly: BatchView

    private val consent = AcceptInviteRequest(CampusJoinService.CONSENT_VERSION, agreeDataSharing = true, agreeAiEvaluation = true)

    @BeforeEach
    fun seed() {
        everyone.forEach(::createUser)
        val suffix = UUID.randomUUID().toString().take(8)
        orgA = platform.create(operator, CreateOrgRequest(name = "College A", slug = "onb-a-$suffix")).id
        orgB = platform.create(operator, CreateOrgRequest(name = "College B", slug = "onb-b-$suffix")).id
        seedMember(orgA, adminA, CampusRole.COLLEGE_ADMIN)
        seedMember(orgB, adminB, CampusRole.COLLEGE_ADMIN)
        val departmentA = college.createDepartment(adminA, orgA, CreateDepartmentRequest("CSE", "Computer Science"))
        val departmentB = college.createDepartment(adminB, orgB, CreateDepartmentRequest("CSE", "Computer Science"))
        batchA = college.createBatch(adminA, orgA, CreateBatchRequest(departmentA.id, 2027, "CSE 2027"))
        batchB = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2027, "CSE 2027"))
        batchBOnly = college.createBatch(adminB, orgB, CreateBatchRequest(departmentB.id, 2028, "CSE 2028"))
        seedMember(orgA, memberA, CampusRole.STUDENT, batchA.id, "A-001")
        seedMember(orgB, memberB, CampusRole.STUDENT, batchB.id, "B-001")
    }

    @AfterEach
    fun cleanUp() {
        for (org in listOfNotNull(if (::orgA.isInitialized) orgA else null, if (::orgB.isInitialized) orgB else null)) {
            jdbc.sql("delete from public.organisations where id = :id").param("id", org).update()
        }
        for (person in everyone) {
            jdbc.sql("delete from auth.users where id = :id").param("id", person.id).update()
        }
    }

    @Test
    fun `an import is checked against this college only, and commit invites the valid rows once`() {
        val newEmail = "new-${UUID.randomUUID()}@example.invalid"
        val csv =
            buildString {
                appendLine("name,email,roll_number,department,batch,graduation_year")
                appendLine("New Student,$newEmail,A-100,CSE,CSE 2027,2027")
                appendLine("Already Here,${memberA.email.uppercase()},A-101,CSE,CSE 2027,2027")
                // B's member and B's roll number: not A's business, and A must not learn of them.
                appendLine("B Person,${memberB.email},B-001,CSE,CSE 2027,2027")
                // A batch only B has.
                appendLine("Wrong Batch,other-${UUID.randomUUID()}@example.invalid,A-102,CSE,CSE 2028,2028")
                appendLine("Roll Clash,clash-${UUID.randomUUID()}@example.invalid,A-001,CSE,CSE 2027,2027")
            }.toByteArray()

        val preview = onboarding.createImport(adminA, orgA, csv.size.toLong()) { csv }

        assertEquals("previewed", preview.status)
        assertEquals(
            listOf(emptyList(), listOf("already_member"), emptyList(), listOf("unknown_batch"), listOf("roll_number_taken")),
            preview.rows.map { it.problems },
        )
        assertEquals(ImportSummary(total = 5, valid = 2, withProblems = 3), preview.summary)
        assertEquals(preview, onboarding.getImport(adminA, orgA, preview.id))

        val result = onboarding.commitImport(adminA, orgA, preview.id)
        assertEquals(ImportCommitResult(invited = 2, skipped = 3), result)
        val conflict = assertThrows<ApiException> { onboarding.commitImport(adminA, orgA, preview.id) }
        assertEquals("import_not_open", conflict.code)

        val listed = allInvites(adminA, orgA)
        assertEquals(setOf(newEmail, memberB.email), listed.map { it.email }.toSet())
        assertTrue(listed.all { it.status == "invited" && it.sendStatus == "pending" && it.batchId == batchA.id && it.sendCount == 1 })
        assertEquals(1, countAudit(orgA, "import.committed"))

        // Discarding drops the rows at once; the import is then closed.
        val second = onboarding.createImport(adminA, orgA, csv.size.toLong()) { csv }
        onboarding.discardImport(adminA, orgA, second.id)
        val discarded = onboarding.getImport(adminA, orgA, second.id)
        assertEquals("discarded", discarded.status)
        assertEquals(emptyList(), discarded.rows)
        assertEquals("import_not_open", assertThrows<ApiException> { onboarding.commitImport(adminA, orgA, second.id) }.code)
    }

    @Test
    fun `college A cannot reach B's imports or invites, and A's lists never show B's`() {
        val csv = "name,email,batch\nB Student,b-${UUID.randomUUID()}@example.invalid,CSE 2027\n".toByteArray()
        val importB = onboarding.createImport(adminB, orgB, csv.size.toLong()) { csv }
        val inviteB = onboarding.createInvite(adminB, orgB, studentInvite("b-single-${UUID.randomUUID()}@example.invalid", batchB.id))

        assertNotFound { onboarding.getImport(adminA, orgA, importB.id) }
        assertNotFound { onboarding.commitImport(adminA, orgA, importB.id) }
        assertNotFound { onboarding.discardImport(adminA, orgA, importB.id) }
        assertNotFound { onboarding.resend(adminA, orgA, inviteB.id) }
        assertNotFound { onboarding.revoke(adminA, orgA, inviteB.id) }
        // The gate itself: A's admin under B's path.
        assertNotFound { onboarding.getImport(adminA, orgB, importB.id) }
        assertNotFound { onboarding.listInvites(adminA, orgB, null, null, null, null, null) }
        // A student invite naming B's batch is refused by the service.
        assertNotFound { onboarding.createInvite(adminA, orgA, studentInvite("x-${UUID.randomUUID()}@example.invalid", batchB.id)) }

        assertEquals(emptyList(), allInvites(adminA, orgA))
        assertEquals(listOf(inviteB.id), allInvites(adminB, orgB).map { it.id })
        assertEquals("previewed", onboarding.getImport(adminB, orgB, importB.id).status)
        assertEquals(
            "invited",
            onboarding
                .listInvites(adminB, orgB, null, null, null, null, null)
                .items
                .single()
                .status,
        )
    }

    @Test
    fun `the database refuses an A import row or invite naming a B batch`() {
        val importA =
            jdbc
                .sql("insert into public.campus_imports (org_id, row_count) values (:a, 1) returning id")
                .param("a", orgA)
                .query(UUID::class.java)
                .single()
        assertThrows<DataAccessException> {
            jdbc
                .sql(
                    "insert into public.campus_import_rows (org_id, import_id, row_number, email, batch_id) values (:a, :i, 1, 'x@y.co', :b)",
                ).param("a", orgA)
                .param("i", importA)
                .param("b", batchB.id)
                .update()
        }
        assertThrows<DataAccessException> {
            jdbc
                .sql(
                    """
                    insert into public.campus_invites (org_id, role, batch_id, email, full_name, expires_at)
                    values (:a, 'student', :b, 'x@y.co', 'X', now() + interval '1 day')
                    """.trimIndent(),
                ).param("a", orgA)
                .param("b", batchB.id)
                .update()
        }
        // B's import under A's org id.
        val importB =
            jdbc
                .sql("insert into public.campus_imports (org_id, row_count) values (:b, 1) returning id")
                .param("b", orgB)
                .query(UUID::class.java)
                .single()
        assertThrows<DataAccessException> {
            jdbc
                .sql("insert into public.campus_import_rows (org_id, import_id, row_number) values (:a, :i, 1)")
                .param("a", orgA)
                .param("i", importB)
                .update()
        }
    }

    @Test
    fun `the job emails a link whose token is stored only as its hash`() {
        val email = "joiner-${UUID.randomUUID()}@example.invalid"
        val invite = onboarding.createInvite(adminA, orgA, studentInvite(email, batchA.id))
        val placeholder = tokenHash(invite.id)
        assertEquals(32, placeholder.size)

        val token = sendThroughJob(email)

        val stored = tokenHash(invite.id)
        assertContentEquals(InviteTokens.hash(token), stored)
        assertFalse(placeholder.contentEquals(stored), "each email rotates the token")
        val row =
            jdbc
                .sql("select row_to_json(i)::text from public.campus_invites i where i.id = :id")
                .param("id", invite.id)
                .query(String::class.java)
                .single()
        assertFalse(row.contains(token), "the raw token is never written to the row")
        val sent = allInvites(adminA, orgA).single { it.id == invite.id }
        assertEquals("sent", sent.sendStatus)
        assertTrue(sent.lastSentAt != null)

        // A resend kills the emailed link at once, before the next email goes.
        onboarding.resend(adminA, orgA, invite.id)
        assertThrows<ApiException> { join.preview(joinerOne, token) }.also { assertEquals("invite_not_found", it.code) }
        assertEquals(2, allInvites(adminA, orgA).single { it.id == invite.id }.sendCount)
    }

    @Test
    fun `two accepts of one link at once make exactly one membership`() {
        val email = "race-${UUID.randomUUID()}@example.invalid"
        val invite = onboarding.createInvite(adminA, orgA, studentInvite(email, batchA.id, rollNumber = "A-200"))
        val token = setToken(invite.id)
        val request = consent.copy(confirmDifferentEmail = true)

        val start = CountDownLatch(1)
        val pool = Executors.newFixedThreadPool(2)
        val outcomes =
            listOf(joinerOne, joinerTwo)
                .map { who ->
                    pool.submit(
                        Callable {
                            start.await()
                            runCatching { transactions.execute { join.accept(who, token, request) } }
                        },
                    )
                }.also { start.countDown() }
                .map { it.get(30, TimeUnit.SECONDS) }
        pool.shutdown()

        assertEquals(1, outcomes.count { it.isSuccess }, outcomes.toString())
        val failure = outcomes.single { it.isFailure }.exceptionOrNull() as ApiException
        assertEquals("invite_not_found", failure.code)
        assertEquals(
            1L,
            count(
                "select count(*) from public.org_members where org_id = :org and user_id in (:a, :b)",
                mapOf("org" to orgA, "a" to joinerOne.id, "b" to joinerTwo.id),
            ),
        )
        val joined = allInvites(adminA, orgA).single { it.id == invite.id }
        assertEquals("joined", joined.status)
        val membership =
            jdbc
                .sql(
                    """
                    select consent_version, consented_at is not null, roll_number, batch_id
                      from public.org_members
                     where org_id = :org and role = 'student' and roll_number = 'A-200'
                    """.trimIndent(),
                ).param("org", orgA)
                .query { rs, _ -> listOf(rs.getString(1), rs.getBoolean(2), rs.getString(3), UUID.fromString(rs.getString(4))) }
                .single()
        assertEquals(listOf<Any>(CampusJoinService.CONSENT_VERSION, true, "A-200", batchA.id), membership)
        assertEquals(1, countAudit(orgA, "member.joined"))

        // Used: the same link is now a 404 for anyone, including the winner.
        assertEquals("invite_not_found", assertThrows<ApiException> { join.preview(joinerOne, token) }.code)
    }

    @Test
    fun `a student of another college cannot join, and nothing is written`() {
        val invite = onboarding.createInvite(adminA, orgA, studentInvite(memberB.email, batchA.id))
        val token = setToken(invite.id)

        val refused = assertThrows<ApiException> { transactions.execute { join.accept(memberB, token, consent) } }

        assertEquals("already_in_college", refused.code)
        assertEquals(HttpStatus.CONFLICT, refused.status)
        assertEquals("invited", allInvites(adminA, orgA).single().status)
        assertEquals(
            0L,
            count(
                "select count(*) from public.org_members where org_id = :org and user_id = :u",
                mapOf(
                    "org" to orgA,
                    "u" to memberB.id,
                ),
            ),
        )
    }

    @Test
    fun `a batch with an open invite cannot be deleted`() {
        onboarding.createInvite(adminA, orgA, studentInvite("hold-${UUID.randomUUID()}@example.invalid", batchA.id))
        val emptyBatch = college.createBatch(adminA, orgA, CreateBatchRequest(batchA.departmentId, 2029, "CSE 2029"))
        val invite = onboarding.createInvite(adminA, orgA, studentInvite("gone-${UUID.randomUUID()}@example.invalid", emptyBatch.id))

        assertEquals("batch_has_members", assertThrows<ApiException> { college.deleteBatch(adminA, orgA, emptyBatch.id) }.code)
        onboarding.revoke(adminA, orgA, invite.id)
        // Revoked, it no longer holds the batch; it goes with it.
        college.deleteBatch(adminA, orgA, emptyBatch.id)
        assertEquals(0L, count("select count(*) from public.campus_invites where id = :id", mapOf("id" to invite.id)))
    }

    @Test
    fun `account deletion removes invites to the account's email and those it accepted`() {
        // Accepted from a differently-addressed account: found through the membership, not the email.
        val accepted = onboarding.createInvite(adminA, orgA, studentInvite("roll-${UUID.randomUUID()}@example.invalid", batchA.id))
        transactions.execute { join.accept(joinerOne, setToken(accepted.id), consent.copy(confirmDifferentEmail = true)) }
        val open = onboarding.createInvite(adminB, orgB, studentInvite(joinerOne.email, batchB.id))
        val unrelated = onboarding.createInvite(adminB, orgB, studentInvite("keep-${UUID.randomUUID()}@example.invalid", batchB.id))

        transactions.execute { AccountRepository(jdbc).deleteCampusInvites(joinerOne.id) }

        val left =
            jdbc
                .sql("select id from public.campus_invites where id in (:ids)")
                .param("ids", listOf(accepted.id, open.id, unrelated.id))
                .query(UUID::class.java)
                .list()
        assertEquals(listOf(unrelated.id), left)
    }

    // -- helpers -----------------------------------------------------------------

    private fun studentInvite(
        email: String,
        batchId: UUID,
        rollNumber: String? = null,
    ) = CreateInviteRequest(email = email, fullName = "Student", role = "student", batchId = batchId, rollNumber = rollNumber)

    /** What the email job does for one invite, without sending: a fresh token, its hash stored. */
    private fun setToken(inviteId: UUID): String {
        val token = InviteTokens.generate()
        jdbc
            .sql("update public.campus_invites set token_hash = :hash where id = :id")
            .param("hash", InviteTokens.hash(token))
            .param("id", inviteId)
            .update()
        return token
    }

    /** Runs the real job with SES mocked, and returns the token in the link sent to [email]. */
    private fun sendThroughJob(email: String): String {
        val sender = mock(SesEmailSender::class.java)
        val links = mutableMapOf<String, String>()
        willAnswer { call -> links[call.getArgument(0)] = call.getArgument(4) }
            .given(sender)
            .sendTransactional(anyString(), anyString(), anyString(), anyString(), anyString())
        val job = CampusInviteEmailJob(invites, EmailProperties(enabled = true, publicBaseUrl = "https://untiered.tech"), sender)
        repeat(10) {
            if (email !in links) job.dispatch()
        }
        return links.getValue(email).substringAfter("token=")
    }

    private fun tokenHash(inviteId: UUID): ByteArray =
        jdbc
            .sql("select token_hash from public.campus_invites where id = :id")
            .param("id", inviteId)
            .query { rs, _ -> rs.getBytes(1) }
            .single()

    private fun allInvites(
        who: SupabaseIdentity,
        org: UUID,
    ): List<InviteView> = onboarding.listInvites(who, org, null, null, null, null, null).items

    private fun countAudit(
        org: UUID,
        action: String,
    ): Int =
        count(
            "select count(*) from public.org_audit_log where org_id = :org and action = :action",
            mapOf(
                "org" to org,
                "action" to action,
            ),
        ).toInt()

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
            return SupabaseIdentity(id, "campus-onb-test-$id@example.invalid", null)
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
