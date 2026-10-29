package com.interviewos.api.billing

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.SessionRepository
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import java.util.UUID
import kotlin.math.roundToInt

data class PackView(
    val id: String,
    val name: String,
    val credits: Int,
    val pricePaise: Long,
    val perInterviewPaise: Long,
    /** Against the dearest per-interview price on offer; 0 for that pack itself. */
    val savingsPercent: Int,
)

data class BillingOverview(
    val purchasable: Boolean,
    val creditBalance: Int,
    val currency: String,
    val packs: List<PackView>,
)

data class CreateOrderRequest(
    val packId: String = "",
)

/** What the browser needs to open Razorpay Checkout for one order. */
data class CheckoutOrder(
    val orderId: String,
    val keyId: String,
    val amountPaise: Long,
    val currency: String,
    val packId: String,
    val name: String,
    val credits: Int,
    val email: String?,
)

data class ConfirmPaymentRequest(
    val razorpayPaymentId: String = "",
    val razorpaySignature: String = "",
)

/**
 * Selling interview credits through Razorpay.
 *
 * The flow is Razorpay's standard one, with every decision on this side:
 *
 * 1. [createOrder] fixes the amount from the server's own pack list — the browser names a
 *    pack, never a price — and records the order before Checkout opens.
 * 2. The browser pays in Razorpay Checkout and hands back the payment id and signature.
 *    [confirm] checks the signature with the key secret, makes sure the payment is
 *    captured for exactly this order's amount, and grants the credits.
 * 3. [webhook] grants the same credits if the browser never came back — a closed tab, a
 *    dropped connection — once Razorpay reports the payment captured.
 *
 * Steps 2 and 3 grant once between them, whichever lands first ([BillingRepository]).
 */
@Service
class BillingService(
    private val properties: BillingProperties,
    private val billing: BillingRepository,
    private val sessions: SessionRepository,
    private val gateway: PaymentGateway,
    private val userRepository: UserRepository,
    private val objectMapper: ObjectMapper,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun overview(userId: UUID): BillingOverview {
        val dearest = properties.packs.maxOfOrNull { it.pricePaise / it.credits } ?: 0
        return BillingOverview(
            purchasable = properties.enabled,
            creditBalance = sessions.creditBalance(userId),
            currency = CURRENCY,
            packs =
                properties.packs.map { pack ->
                    val perInterview = pack.pricePaise / pack.credits
                    PackView(
                        id = pack.id,
                        name = pack.name,
                        credits = pack.credits,
                        pricePaise = pack.pricePaise,
                        perInterviewPaise = perInterview,
                        savingsPercent = if (dearest == 0L) 0 else ((1 - perInterview.toDouble() / dearest) * 100).roundToInt(),
                    )
                },
        )
    }

    fun createOrder(
        identity: SupabaseIdentity,
        request: CreateOrderRequest,
    ): CheckoutOrder {
        requireEnabled()
        val pack =
            properties.pack(request.packId)
                ?: throw ApiException.badRequest("Choose one of the packs shown.", code = "unknown_pack")
        userRepository.provision(identity)
        // Razorpay caps a receipt at 40 characters; this is 35 and unique per order.
        val receipt = "ut_" + UUID.randomUUID().toString().replace("-", "")
        val orderId =
            try {
                // The product note tells this site's payments apart in a Razorpay account
                // shared with another product.
                gateway.createOrder(pack.pricePaise, CURRENCY, receipt, mapOf("product" to "untiered", "pack" to pack.id))
            } catch (e: PaymentGatewayException) {
                log.warn("Could not create a Razorpay order", e)
                throw ApiException.upstreamUnavailable("Payments could not be reached just now. Nothing was charged — try again.")
            }
        billing.insertOrder(identity.id, orderId, pack, CURRENCY)
        return CheckoutOrder(
            orderId = orderId,
            keyId = properties.razorpay.keyId,
            amountPaise = pack.pricePaise,
            currency = CURRENCY,
            packId = pack.id,
            name = pack.name,
            credits = pack.credits,
            email = identity.email,
        )
    }

    fun confirm(
        userId: UUID,
        orderId: String,
        request: ConfirmPaymentRequest,
    ): BillingOverview {
        requireEnabled()
        val order = billing.findOrder(userId, orderId) ?: throw ApiException.notFound("That order does not exist.")
        if (order.status == "paid") return overview(userId)

        val paymentId = request.razorpayPaymentId.trim()
        if (paymentId.isEmpty() ||
            !RazorpaySignature.matches(properties.razorpay.keySecret, "$orderId|$paymentId", request.razorpaySignature)
        ) {
            log
                .atWarn()
                .addKeyValue("user_id", userId)
                .addKeyValue("order_id", orderId)
                .log("Payment confirmation with an invalid signature")
            throw ApiException.badRequest(
                "We could not verify that payment. If money left your account, it will be credited or refunded automatically.",
                code = "payment_unverified",
            )
        }
        try {
            gateway.ensureCaptured(paymentId, orderId, order.amountPaise, order.currency)
        } catch (e: PaymentGatewayException) {
            log.warn("Payment {} for order {} could not be confirmed as captured", paymentId, orderId, e)
            throw ApiException.upstreamUnavailable(
                "Your payment is still being confirmed. Your interviews will appear as soon as Razorpay confirms it.",
            )
        }
        if (billing.markPaidAndGrant(orderId, paymentId, userId = userId)) {
            log
                .atInfo()
                .addKeyValue("user_id", userId)
                .addKeyValue("order_id", orderId)
                .addKeyValue("credits", order.credits)
                .log("Interview credits granted")
        }
        return overview(userId)
    }

    /**
     * A Razorpay webhook delivery. Unauthenticated by design — Razorpay has no user token —
     * so the signature over the raw body is the only thing that admits it.
     */
    fun webhook(
        body: ByteArray,
        signature: String?,
    ) {
        val secret = properties.razorpay.webhookSecret
        if (secret.isBlank()) throw ApiException.notFound()
        if (!RazorpaySignature.matches(secret, body, signature)) {
            log.warn("Razorpay webhook with an invalid signature")
            throw ApiException(HttpStatus.UNAUTHORIZED, "invalid_signature", "Invalid signature.")
        }

        val event = objectMapper.readTree(body)
        val payment = event.path("payload").path("payment").path("entity")
        val orderId = payment.path("order_id").asString("")
        val paymentId = payment.path("id").asString("")
        if (orderId.isBlank() || paymentId.isBlank()) return

        when (event.path("event").asString("")) {
            "payment.captured", "order.paid" -> {
                if (billing.markPaidAndGrant(orderId, paymentId, amountPaise = payment.path("amount").asLong())) {
                    log
                        .atInfo()
                        .addKeyValue("order_id", orderId)
                        .log("Interview credits granted from webhook")
                }
            }

            "payment.failed" -> {
                billing.markFailed(orderId)
            }
        }
    }

    private fun requireEnabled() {
        if (!properties.enabled) {
            throw ApiException(HttpStatus.SERVICE_UNAVAILABLE, "payments_unavailable", "Buying interviews is not available yet.")
        }
    }

    private companion object {
        const val CURRENCY = "INR"
    }
}
