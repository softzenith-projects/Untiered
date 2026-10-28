package com.interviewos.api.billing

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class RazorpaySignatureTest {
    /** Computed independently (Python's hmac module), so this is not the code checking itself. */
    private val payload = "order_DBJOWzybf0sJbb|pay_DBJOWzybf0sJbb"
    private val signature = "0ef018ab64d6d61feb2a9d096218fea259811ea7e6c663bf3846761db9fa1a03"

    @Test
    fun `matches Razorpay's HMAC-SHA256 hex signature`() {
        assertEquals(signature, RazorpaySignature.hmacHex("test_key_secret", payload.toByteArray()))
        assertTrue(RazorpaySignature.matches("test_key_secret", payload, signature))
        assertTrue(RazorpaySignature.matches("test_key_secret", payload, signature.uppercase()))
    }

    @Test
    fun `rejects a different secret, payload or signature`() {
        assertFalse(RazorpaySignature.matches("other_secret", payload, signature))
        assertFalse(RazorpaySignature.matches("test_key_secret", "$payload ", signature))
        assertFalse(RazorpaySignature.matches("test_key_secret", payload, signature.dropLast(1) + "0"))
    }

    @Test
    fun `never matches with a blank secret or no signature`() {
        // An unset webhook secret must not turn into "every signature over an empty key".
        assertFalse(RazorpaySignature.matches("", payload, signature))
        assertFalse(RazorpaySignature.matches("  ", payload, signature))
        assertFalse(RazorpaySignature.matches("test_key_secret", payload, null))
        assertFalse(RazorpaySignature.matches("test_key_secret", payload, ""))
    }
}
