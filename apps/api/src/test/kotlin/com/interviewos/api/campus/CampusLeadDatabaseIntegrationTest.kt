package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.common.TurnstileVerifier
import com.interviewos.api.email.EmailProperties
import com.interviewos.api.pool.anyArg
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
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DataSourceTransactionManager
import org.springframework.jdbc.datasource.DriverManagerDataSource
import tools.jackson.databind.json.JsonMapper
import java.util.UUID
import kotlin.random.Random
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertNull

/**
 * Module 13 against real Postgres with every migration applied: the public form's merge and
 * limits, what is (and is not) stored, conversion into a college, and the purge. Services run
 * without Spring proxies; the service's own TransactionTemplate is what makes convert atomic.
 */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CampusLeadDatabaseIntegrationTest {
    private val dataSource =
        DriverManagerDataSource(
            System.getenv("TEST_DB_URL"),
            System.getenv("TEST_DB_USER") ?: "postgres",
            System.getenv("TEST_DB_PASSWORD") ?: "postgres",
        )
    private val jdbc = JdbcClient.create(dataSource)
    private val transactionManager = DataSourceTransactionManager(dataSource)

    private val operatorId = UUID.randomUUID()
    private val operator = SupabaseIdentity(operatorId, "campus-lead-test-$operatorId@example.invalid", null)
    private val adminProperties = AdminProperties(emails = listOf(operator.email), userIds = listOf(operatorId.toString()))
    private val users = UserRepository(jdbc)
    private val access = CampusAccess(jdbc, adminProperties, AdminAccess(adminProperties), users)
    private val orgs = OrganisationRepository(jdbc)
    private val audit = CampusAudit(jdbc, JsonMapper.builder().build())
    private val logos = OrgLogos(StorageProperties())
    private val colleges = CampusAdminService(access, orgs, audit, logos, NoObjectStorage, transactionManager)
    private val onboarding = CampusOnboardingService(access, InviteRepository(jdbc), StructureRepository(jdbc), audit)
    private val leads = LeadRepository(jdbc)
    private val rateLimiter = LeadRateLimiter(jdbc, CampusLeadProperties(leadHashSalt = "test-salt"))
    private val turnstile =
        object : TurnstileVerifier {
            override fun verify(
                token: String?,
                remoteIp: String?,
            ) = token == "ok"
        }

    private fun service(onboarding: CampusOnboardingService = this.onboarding) =
        CampusLeadService(
            access,
            leads,
            rateLimiter,
            turnstile,
            colleges,
            onboarding,
            audit,
            EmailProperties(enabled = true),
            CampusLeadProperties(leadNotifyEmail = "leads@untiered.tech", leadHashSalt = "test-salt"),
            transactionManager,
        )

    private val tag = UUID.randomUUID().toString().take(8)
    private val email = "lead-$tag@example.invalid"

    /** An address in the benchmarking range that no other run is likely to draw. */
    private fun freshIp() = "198.18.${Random.nextInt(256)}.${Random.nextInt(1, 255)}"

    private fun request(
        college: String = "Lead Test College $tag",
        address: String = email,
    ) = LeadRequest(
        collegeName = college,
        city = "Nagpur",
        state = "Maharashtra",
        contactName = "Asha Rao",
        contactRole = "tpo",
        email = address,
        phone = "+91 98765 43210",
        approxStudents = 600,
        message = "Please call after 4pm.",
        consentToContact = true,
        turnstileToken = "ok",
    )

    @BeforeEach
    fun seed() {
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", operatorId)
            .param("email", operator.email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", operatorId)
            .param("email", operator.email)
            .update()
    }

    @AfterEach
    fun cleanUp() {
        jdbc.sql("delete from public.campus_leads where email like :pattern").param("pattern", "%$tag%").update()
        jdbc.sql("delete from public.organisations where slug like :pattern").param("pattern", "%$tag%").update()
        jdbc.sql("delete from auth.users where id = :id").param("id", operatorId).update()
    }

    @Test
    fun `a repeat for the same college merges, another college is a second lead, and the first queues one notice`() {
        service().submit(request(), freshIp())
        service().submit(request().copy(message = null, approxStudents = 700), freshIp())
        service().submit(request(college = "Another College $tag"), freshIp())

        val rows =
            jdbc
                .sql(
                    "select college_name, submission_count, approx_students, message, notify_status from public.campus_leads " +
                        "where email = :email order by created_at",
                ).param("email", email)
                .query { rs, _ ->
                    listOf(rs.getString(1), rs.getInt(2), rs.getInt(3), rs.getString(4), rs.getString(5))
                }.list()
        assertEquals(
            listOf(
                listOf("Lead Test College $tag", 2, 700, "Please call after 4pm.", "pending"),
                listOf("Another College $tag", 1, 600, "Please call after 4pm.", "pending"),
            ),
            rows,
        )
        val claimed = leads.claimNotices(100).filter { it.collegeName.endsWith(tag) }
        assertEquals(2, claimed.size)
        assertEquals(emptyList(), leads.claimNotices(100).filter { it.collegeName.endsWith(tag) })
    }

    @Test
    fun `five per IP an hour and three per email a day, counted under a salted hash, never the raw values`() {
        val ip = freshIp()
        repeat(5) { service().submit(request(address = "ip-$it-$tag@example.invalid"), ip) }
        assertEquals(HttpStatus.TOO_MANY_REQUESTS, assertThrows<ApiException> { service().submit(request(), ip) }.status)

        repeat(3) { service().submit(request(), freshIp()) }
        assertEquals("rate_limited", assertThrows<ApiException> { service().submit(request(), freshIp()) }.code)

        // A failed captcha still spends an IP attempt.
        val other = freshIp()
        repeat(5) { assertThrows<ApiException> { service().submit(request().copy(turnstileToken = "bad"), other) } }
        assertEquals("rate_limited", assertThrows<ApiException> { service().submit(request(), other) }.code)

        val ipHits =
            jdbc
                .sql("select hits from public.campus_lead_rate_limits where kind = 'ip' and key_hash = :hash")
                .param("hash", rateLimiter.hash(LeadRateLimiter.KIND_IP, ip))
                .query(Int::class.java)
                .single()
        assertEquals(6, ipHits)
        for (table in listOf("campus_lead_rate_limits", "campus_leads")) {
            val leaked =
                jdbc
                    .sql("select count(*) from public.$table t where t::text like :ip or t::text like :other")
                    .param("ip", "%$ip%")
                    .param("other", "%$other%")
                    .query(Long::class.java)
                    .single()
            assertEquals(0, leaked, "$table must not hold a raw IP")
        }
        val emailInBuckets =
            jdbc
                .sql("select count(*) from public.campus_lead_rate_limits t where t::text like :email")
                .param("email", "%$tag%")
                .query(Long::class.java)
                .single()
        assertEquals(0, emailInBuckets)
    }

    @Test
    fun `convert creates exactly one college and one admin invite and marks the lead, and only once`() {
        service().submit(request(), freshIp())
        val leadId = leadIdFor(email)
        val slug = "lead-$tag"

        val result = service().convert(operator, leadId, ConvertLeadRequest(name = "Lead Test College", slug = slug))

        assertEquals("Lead Test College", result.org.name)
        assertEquals("Nagpur", result.org.city)
        assertEquals(email, result.org.contactEmail)
        assertEquals("college_admin", result.invite.role)
        assertEquals(email, result.invite.email)
        assertEquals(1L, count("select count(*) from public.organisations where slug = :v", slug))
        assertEquals(
            1L,
            count("select count(*) from public.campus_invites where org_id = :v and role = 'college_admin'", result.org.id),
        )
        val lead = leads.find(PlatformAdmin(operatorId), leadId)
        assertNotNull(lead)
        assertEquals("converted", lead.status)
        assertEquals(result.org.id, lead.orgId)
        assertEquals(operatorId, lead.statusChangedBy)
        assertEquals(
            1L,
            count("select count(*) from public.org_audit_log where org_id = :v and action = 'lead.converted'", result.org.id),
        )

        val again = assertThrows<ApiException> { service().convert(operator, leadId, ConvertLeadRequest(slug = "$slug-2")) }
        assertEquals("lead_already_converted", again.code)
        assertEquals(0L, count("select count(*) from public.organisations where slug = :v", "$slug-2"))
    }

    @Test
    fun `when the invite fails, the college is not created and the lead stays open`() {
        service().submit(request(), freshIp())
        val leadId = leadIdFor(email)
        val failing = mock(CampusOnboardingService::class.java)
        given(failing.adminCreateInvite(anyArg(), anyArg(), anyArg())).willThrow(IllegalStateException("invite store down"))
        val slug = "lead-fail-$tag"

        assertThrows<IllegalStateException> { service(failing).convert(operator, leadId, ConvertLeadRequest(slug = slug)) }

        assertEquals(0L, count("select count(*) from public.organisations where slug = :v", slug))
        val lead = leads.find(PlatformAdmin(operatorId), leadId)
        assertEquals("new", lead?.status)
        assertNull(lead?.orgId)
    }

    @Test
    fun `the purge deletes not-a-fit leads marked over 180 days ago, and nothing else`() {
        val old = insertLead("not_a_fit", statusChangedDaysAgo = 181)
        val recent = insertLead("not_a_fit", statusChangedDaysAgo = 10)
        val oldButOpen = insertLead("new", statusChangedDaysAgo = 300)
        val oldContacted = insertLead("contacted", statusChangedDaysAgo = 300)

        leads.purgeNotAFit()

        assertEquals(listOf(recent, oldButOpen, oldContacted).sorted(), remaining(listOf(old, recent, oldButOpen, oldContacted)).sorted())
    }

    @Test
    fun `stale rate-limit buckets are purged`() {
        val hash = rateLimiter.hash(LeadRateLimiter.KIND_IP, "stale-$tag")
        jdbc
            .sql("insert into public.campus_lead_rate_limits (kind, key_hash, window_start) values ('ip', :h, now() - interval '3 days')")
            .param("h", hash)
            .update()

        rateLimiter.purgeStale()

        assertEquals(0L, count("select count(*) from public.campus_lead_rate_limits where key_hash = :v", hash))
    }

    private fun insertLead(
        status: String,
        statusChangedDaysAgo: Int,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.campus_leads
                       (college_name, city, state, contact_name, contact_role, email, consented_at, status, status_changed_at,
                        created_at)
                values ('Purge College', 'Pune', 'MH', 'A', 'other', :email, now(), :status,
                        now() - make_interval(days => :days), now() - make_interval(days => :days + 1))
                returning id
                """.trimIndent(),
            ).param("email", "purge-${UUID.randomUUID().toString().take(6)}-$tag@example.invalid")
            .param("status", status)
            .param("days", statusChangedDaysAgo)
            .query(UUID::class.java)
            .single()

    private fun remaining(ids: List<UUID>): List<UUID> =
        jdbc
            .sql("select id from public.campus_leads where id in (:ids)")
            .param("ids", ids)
            .query(UUID::class.java)
            .list()
            .filterNotNull()

    private fun leadIdFor(address: String): UUID =
        jdbc
            .sql("select id from public.campus_leads where email = :email")
            .param("email", address)
            .query(UUID::class.java)
            .single()

    private fun count(
        sql: String,
        value: Any,
    ): Long =
        jdbc
            .sql(sql)
            .param("v", value)
            .query(Long::class.java)
            .single()
}
