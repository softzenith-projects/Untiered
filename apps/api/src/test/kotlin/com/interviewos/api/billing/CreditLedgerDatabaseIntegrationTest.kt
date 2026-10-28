package com.interviewos.api.billing

import com.interviewos.api.interview.Archetype
import com.interviewos.api.interview.Confidence
import com.interviewos.api.interview.SessionRepository
import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.AfterEach
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable
import org.springframework.dao.DataAccessException
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.jdbc.datasource.DriverManagerDataSource
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The credit ledger's real SQL, against a local Supabase instance with every migration applied. */
@EnabledIfEnvironmentVariable(named = "TEST_DB_URL", matches = ".+")
class CreditLedgerDatabaseIntegrationTest {
    private val userId = UUID.randomUUID()
    private val otherUserId = UUID.randomUUID()
    private val jdbc =
        JdbcClient.create(
            DriverManagerDataSource(
                System.getenv("TEST_DB_URL"),
                System.getenv("TEST_DB_USER") ?: "postgres",
                System.getenv("TEST_DB_PASSWORD") ?: "postgres",
            ),
        )
    private val billing = BillingRepository(jdbc)
    private val sessions = SessionRepository(jdbc, StorageProperties())
    private val fivePack = CreditPack(id = "pack_5", name = "5 interviews", credits = 5, pricePaise = 89_900)

    @BeforeEach
    fun createUsers() {
        createUser(userId)
        createUser(otherUserId)
    }

    @AfterEach
    fun deleteUsers() {
        for (id in listOf(userId, otherUserId)) {
            jdbc.sql("delete from public.storage_deletion_jobs where user_id = :u").param("u", id).update()
            jdbc.sql("delete from auth.users where id = :u").param("u", id).update()
        }
    }

    @Test
    fun `a payment grants its pack once, however many times it is reported`() {
        val orderId = "order_${UUID.randomUUID()}"
        billing.insertOrder(userId, orderId, fivePack, "INR")
        assertEquals("created", billing.findOrder(userId, orderId)?.status)

        assertTrue(billing.markPaidAndGrant(orderId, "pay_1", userId = userId))
        // The webhook arriving after the browser's callback, and a repeated callback.
        assertFalse(billing.markPaidAndGrant(orderId, "pay_1", amountPaise = 89_900))
        assertFalse(billing.markPaidAndGrant(orderId, "pay_1", userId = userId))

        assertEquals(5, sessions.creditBalance(userId))
        assertEquals("paid", billing.findOrder(userId, orderId)?.status)
    }

    @Test
    fun `an order is neither visible to nor payable by another candidate`() {
        val orderId = "order_${UUID.randomUUID()}"
        billing.insertOrder(userId, orderId, fivePack, "INR")

        assertNull(billing.findOrder(otherUserId, orderId))
        assertFalse(billing.markPaidAndGrant(orderId, "pay_1", userId = otherUserId))
        assertEquals(0, sessions.creditBalance(otherUserId))
        assertEquals(0, sessions.creditBalance(userId))
    }

    @Test
    fun `a webhook for the wrong amount grants nothing`() {
        val orderId = "order_${UUID.randomUUID()}"
        billing.insertOrder(userId, orderId, fivePack, "INR")

        assertFalse(billing.markPaidAndGrant(orderId, "pay_1", amountPaise = 100))
        assertEquals(0, sessions.creditBalance(userId))
        assertTrue(billing.markPaidAndGrant(orderId, "pay_1", amountPaise = 89_900))
    }

    @Test
    fun `a failed attempt can still be paid by a later retry of the same order`() {
        val orderId = "order_${UUID.randomUUID()}"
        billing.insertOrder(userId, orderId, fivePack, "INR")

        billing.markFailed(orderId)
        assertEquals("failed", billing.findOrder(userId, orderId)?.status)
        assertTrue(billing.markPaidAndGrant(orderId, "pay_2", amountPaise = 89_900))
        assertEquals(5, sessions.creditBalance(userId))
    }

    @Test
    fun `a round charged a credit is refunded once when it fails on our side`() {
        grant(1)
        val session = openSession()
        sessions.spendCredit(userId, session)
        assertEquals(0, sessions.creditBalance(userId))
        // A session is charged at most once.
        assertFailsWith<DataAccessException> { sessions.spendCredit(userId, session) }

        assertTrue(sessions.failSessionAndRefundUsage(session, userId))
        assertFalse(sessions.failSessionAndRefundUsage(session, userId))
        assertEquals(1, sessions.creditBalance(userId))
    }

    @Test
    fun `a completed or abandoned paid round keeps its charge`() {
        grant(2)
        val completed = openSession()
        sessions.spendCredit(userId, completed)
        assertTrue(sessions.markSessionStatus(completed, userId, "completed"))
        assertFalse(sessions.failSessionAndRefundUsage(completed, userId))

        val abandoned = openSession()
        sessions.spendCredit(userId, abandoned)
        assertTrue(sessions.markSessionStatus(abandoned, userId, "abandoned"))

        assertEquals(0, sessions.creditBalance(userId))
    }

    @Test
    fun `a failed free round refunds no credit it never spent`() {
        val session = openSession()
        sessions.recordPracticeUsage(userId, session, 30)

        assertTrue(sessions.failSessionAndRefundUsage(session, userId))
        assertEquals(0, sessions.creditBalance(userId))
    }

    @Test
    fun `only rounds no credit paid for count against the lifetime free tier`() {
        grant(1)
        val paid = openSession()
        sessions.spendCredit(userId, paid)
        assertTrue(sessions.markSessionStatus(paid, userId, "completed"))
        assertEquals(0, sessions.countCompletedFreeSessions(userId))

        val free = openSession()
        assertTrue(sessions.markSessionStatus(free, userId, "completed"))
        assertEquals(1, sessions.countCompletedFreeSessions(userId))
    }

    @Test
    fun `the ledger outlives a deleted round, so deleting it neither refunds nor loses the charge`() {
        grant(1)
        val session = openSession()
        sessions.spendCredit(userId, session)
        jdbc.sql("delete from public.sessions where id = :s").param("s", session).update()

        assertEquals(0, sessions.creditBalance(userId))
    }

    @Test
    fun `locking for admission works for a provisioned candidate`() {
        sessions.lockForAdmission(userId)
    }

    private fun grant(credits: Int) {
        val orderId = "order_${UUID.randomUUID()}"
        billing.insertOrder(userId, orderId, fivePack.copy(credits = credits), "INR")
        assertTrue(billing.markPaidAndGrant(orderId, "pay_${UUID.randomUUID()}", userId = userId))
    }

    private fun openSession(): UUID =
        sessions.insertSession(
            userId = userId,
            companyName = "Example Company",
            archetype = Archetype.GLOBAL_PRODUCT,
            confidence = Confidence.INFERRED,
            roleTitle = "Engineer",
            roundType = "technical_fundamentals",
            language = "english",
            consentAudio = true,
            consentVideo = false,
            durationMinutes = 30,
        )

    private fun createUser(id: UUID) {
        val email = "credit-test-$id@example.invalid"
        jdbc
            .sql(
                """
                insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, created_at, updated_at)
                values (:id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', :email, '', now(), now(), now())
                """.trimIndent(),
            ).param("id", id)
            .param("email", email)
            .update()
        jdbc
            .sql("insert into public.users (id, email) values (:id, :email) on conflict (id) do nothing")
            .param("id", id)
            .param("email", email)
            .update()
    }
}
