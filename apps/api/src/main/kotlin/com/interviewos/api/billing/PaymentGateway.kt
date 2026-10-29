package com.interviewos.api.billing

import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode
import java.security.MessageDigest
import javax.crypto.Mac
import javax.crypto.spec.SecretKeySpec

/** The payment provider, as far as this server needs it. */
interface PaymentGateway {
    /** Creates an order for [amountPaise] and returns the provider's order id. */
    fun createOrder(
        amountPaise: Long,
        currency: String,
        receipt: String,
        notes: Map<String, String>,
    ): String

    /**
     * Makes sure [paymentId] is a captured payment of exactly [amountPaise] against
     * [orderId], capturing it if it was only authorised. Throws [PaymentGatewayException]
     * when it is anything else — the credits are not granted on a payment we do not hold.
     */
    fun ensureCaptured(
        paymentId: String,
        orderId: String,
        amountPaise: Long,
        currency: String,
    )
}

class PaymentGatewayException(
    message: String,
    cause: Throwable? = null,
) : RuntimeException(message, cause)

/**
 * [PaymentGateway] over Razorpay's REST API, with the key pair as HTTP basic auth.
 * Boundary code: mocked in tests, never called by one.
 */
@Component
class RazorpayGateway(
    private val properties: BillingProperties,
    restClientBuilder: RestClient.Builder,
) : PaymentGateway {
    private val restClient = restClientBuilder.build()

    override fun createOrder(
        amountPaise: Long,
        currency: String,
        receipt: String,
        notes: Map<String, String>,
    ): String {
        val order =
            call("create an order") {
                post()
                    .uri("${base()}/v1/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(mapOf("amount" to amountPaise, "currency" to currency, "receipt" to receipt, "notes" to notes))
                    .retrieve()
                    .body(JsonNode::class.java)
            }
        return order?.get("id")?.asString()?.takeIf { it.isNotBlank() }
            ?: throw PaymentGatewayException("Razorpay returned an order without an id.")
    }

    override fun ensureCaptured(
        paymentId: String,
        orderId: String,
        amountPaise: Long,
        currency: String,
    ) {
        val payment =
            call("read a payment") {
                get()
                    .uri("${base()}/v1/payments/{id}", paymentId)
                    .retrieve()
                    .body(JsonNode::class.java)
            } ?: throw PaymentGatewayException("Razorpay returned no payment for $paymentId.")
        if (payment.get("order_id")?.asString() != orderId || payment.get("amount")?.asLong() != amountPaise) {
            throw PaymentGatewayException("Payment $paymentId does not match order $orderId.")
        }
        when (val status = payment.get("status")?.asString()) {
            "captured" -> {
                return
            }

            "authorized" -> {
                call("capture a payment") {
                    post()
                        .uri("${base()}/v1/payments/{id}/capture", paymentId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body(mapOf("amount" to amountPaise, "currency" to currency))
                        .retrieve()
                        .toBodilessEntity()
                }
            }

            else -> {
                throw PaymentGatewayException("Payment $paymentId is $status, not captured.")
            }
        }
    }

    private fun base() = properties.razorpay.baseUrl.trimEnd('/')

    private fun <T> call(
        what: String,
        block: RestClient.() -> T,
    ): T {
        val authorised =
            restClient
                .mutate()
                .defaultHeaders { it.setBasicAuth(properties.razorpay.keyId, properties.razorpay.keySecret) }
                .build()
        return try {
            authorised.block()
        } catch (ex: RestClientException) {
            throw PaymentGatewayException("Razorpay could not $what.", ex)
        }
    }
}

/**
 * Razorpay's signatures: HMAC-SHA256, hex-encoded. A checkout signs `order_id|payment_id`
 * with the key secret; a webhook signs its raw body with the webhook secret. Compared in
 * constant time, so the check does not leak how much of a forged signature was right.
 */
object RazorpaySignature {
    fun matches(
        secret: String,
        payload: String,
        signature: String?,
    ): Boolean = matches(secret, payload.toByteArray(Charsets.UTF_8), signature)

    fun matches(
        secret: String,
        payload: ByteArray,
        signature: String?,
    ): Boolean {
        if (secret.isBlank() || signature.isNullOrBlank()) return false
        val expected = hmacHex(secret, payload).toByteArray(Charsets.US_ASCII)
        return MessageDigest.isEqual(expected, signature.trim().lowercase().toByteArray(Charsets.US_ASCII))
    }

    fun hmacHex(
        secret: String,
        payload: ByteArray,
    ): String {
        val mac = Mac.getInstance("HmacSHA256")
        mac.init(SecretKeySpec(secret.toByteArray(Charsets.UTF_8), "HmacSHA256"))
        return mac.doFinal(payload).joinToString("") { "%02x".format(it) }
    }
}
