package com.interviewos.api.billing

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.SessionRepository
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.ArgumentMatchers.anyLong
import org.mockito.ArgumentMatchers.anyString
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.http.HttpStatus
import tools.jackson.databind.ObjectMapper
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class BillingServiceTest {
    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(userId, "candidate@example.com", null)
    private val keySecret = "test_key_secret"
    private val webhookSecret = "test_webhook_secret"
    private val properties =
        BillingProperties(
            razorpay = BillingProperties.Razorpay(keyId = "rzp_test_key", keySecret = keySecret, webhookSecret = webhookSecret),
        )
    private val billing = mock(BillingRepository::class.java)
    private val sessions = mock(SessionRepository::class.java)
    private val gateway = mock(PaymentGateway::class.java)
    private val users = mock(UserRepository::class.java)

    private fun service(props: BillingProperties = properties) = BillingService(props, billing, sessions, gateway, users, ObjectMapper())

    private val order = OrderRow(userId, "order_1", 89_900, "INR", 5, "created")

    @Test
    fun `the packs are the owner's prices, with the discount against a single interview`() {
        val packs = service().overview(userId).packs

        assertEquals(listOf(19_900L, 89_900L, 1_49_900L), packs.map { it.pricePaise })
        assertEquals(listOf(1, 5, 10), packs.map { it.credits })
        assertEquals(listOf(0, 10, 25), packs.map { it.savingsPercent })
        assertEquals(listOf(19_900L, 17_980L, 14_990L), packs.map { it.perInterviewPaise })
    }

    @Test
    fun `without keys nothing is for sale and no order is created`() {
        val closed = service(BillingProperties())

        assertEquals(false, closed.overview(userId).purchasable)
        val refused = assertFailsWith<ApiException> { closed.createOrder(identity, CreateOrderRequest("single")) }
        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, refused.status)
        verifyNoInteractions(gateway)
    }

    @Test
    fun `an order is priced from the server's pack, never the browser`() {
        given(gateway.createOrder(anyLong(), anyString(), anyString(), anyMap())).willReturn("order_1")

        val checkout = service().createOrder(identity, CreateOrderRequest("pack_10"))

        assertEquals(1_49_900, checkout.amountPaise)
        assertEquals(10, checkout.credits)
        assertEquals("rzp_test_key", checkout.keyId)
        verify(billing).insertOrder(userId, "order_1", BillingProperties.DEFAULT_PACKS[2], "INR")
    }

    @Test
    fun `an unknown pack is refused`() {
        val refused = assertFailsWith<ApiException> { service().createOrder(identity, CreateOrderRequest("pack_1000")) }

        assertEquals("unknown_pack", refused.code)
        verifyNoInteractions(gateway)
    }

    @Test
    fun `a correctly signed, captured payment grants the pack`() {
        given(billing.findOrder(userId, "order_1")).willReturn(order)
        given(billing.markPaidAndGrant("order_1", "pay_1", userId, null)).willReturn(true)

        service().confirm(userId, "order_1", ConfirmPaymentRequest("pay_1", sign(keySecret, "order_1|pay_1")))

        verify(gateway).ensureCaptured("pay_1", "order_1", 89_900, "INR")
        verify(billing).markPaidAndGrant("order_1", "pay_1", userId, null)
    }

    @Test
    fun `a forged signature grants nothing`() {
        given(billing.findOrder(userId, "order_1")).willReturn(order)

        val refused =
            assertFailsWith<ApiException> {
                service().confirm(userId, "order_1", ConfirmPaymentRequest("pay_1", sign("wrong", "order_1|pay_1")))
            }

        assertEquals("payment_unverified", refused.code)
        verifyNoInteractions(gateway)
        verify(billing, never()).markPaidAndGrant("order_1", "pay_1", userId, null)
    }

    @Test
    fun `a signature for another payment does not pay this order`() {
        given(billing.findOrder(userId, "order_1")).willReturn(order)

        assertFailsWith<ApiException> {
            service().confirm(userId, "order_1", ConfirmPaymentRequest("pay_2", sign(keySecret, "order_1|pay_1")))
        }
        verifyNoInteractions(gateway)
    }

    @Test
    fun `a payment Razorpay does not hold as captured grants nothing`() {
        given(billing.findOrder(userId, "order_1")).willReturn(order)
        willThrow(PaymentGatewayException("refunded")).given(gateway).ensureCaptured("pay_1", "order_1", 89_900, "INR")

        val refused =
            assertFailsWith<ApiException> {
                service().confirm(userId, "order_1", ConfirmPaymentRequest("pay_1", sign(keySecret, "order_1|pay_1")))
            }

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, refused.status)
        verify(billing, never()).markPaidAndGrant("order_1", "pay_1", userId, null)
    }

    @Test
    fun `confirming an order that is already paid changes nothing`() {
        given(billing.findOrder(userId, "order_1")).willReturn(order.copy(status = "paid"))

        service().confirm(userId, "order_1", ConfirmPaymentRequest("pay_1", "anything"))

        verifyNoInteractions(gateway)
    }

    @Test
    fun `another candidate's order is not found`() {
        val refused =
            assertFailsWith<ApiException> {
                service().confirm(userId, "order_9", ConfirmPaymentRequest("pay_1", sign(keySecret, "order_9|pay_1")))
            }

        assertEquals(HttpStatus.NOT_FOUND, refused.status)
    }

    @Test
    fun `a signed capture webhook grants the order for exactly its amount`() {
        val body = webhook("payment.captured", amount = 89_900)

        service().webhook(body, sign(webhookSecret, body))

        verify(billing).markPaidAndGrant("order_1", "pay_1", null, 89_900)
    }

    @Test
    fun `an unsigned or forged webhook is refused`() {
        val body = webhook("payment.captured", amount = 89_900)

        val forged = assertFailsWith<ApiException> { service().webhook(body, sign(keySecret, body)) }
        assertFailsWith<ApiException> { service().webhook(body, null) }

        assertEquals(HttpStatus.UNAUTHORIZED, forged.status)
        verifyNoInteractions(billing)
    }

    @Test
    fun `a failed payment webhook marks the attempt failed`() {
        val body = webhook("payment.failed", amount = 89_900)

        service().webhook(body, sign(webhookSecret, body))

        verify(billing).markFailed("order_1")
    }

    private fun sign(
        secret: String,
        payload: String,
    ) = RazorpaySignature.hmacHex(secret, payload.toByteArray())

    private fun sign(
        secret: String,
        payload: ByteArray,
    ) = RazorpaySignature.hmacHex(secret, payload)

    private fun webhook(
        event: String,
        amount: Long,
    ) = """{"event":"$event","payload":{"payment":{"entity":{"id":"pay_1","order_id":"order_1","amount":$amount}}}}"""
        .toByteArray()

    private fun anyMap(): Map<String, String> = org.mockito.ArgumentMatchers.anyMap<String, String>() ?: emptyMap()
}
