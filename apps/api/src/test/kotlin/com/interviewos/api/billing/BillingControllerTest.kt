package com.interviewos.api.billing

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@WebMvcTest(BillingController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiSecurityTestConfiguration::class)
class BillingControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var service: BillingService

    private val id = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(id, "candidate@example.com", null)

    @Test
    fun `creates an order for the signed-in candidate`() {
        given(service.createOrder(identity, CreateOrderRequest("single")))
            .willReturn(CheckoutOrder("order_1", "rzp_test_key", 19_900, "INR", "single", "1 interview", 1, "candidate@example.com"))

        mockMvc
            .perform(
                post("/api/v1/billing/orders")
                    .with(token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"packId":"single"}"""),
            ).andExpect(status().isCreated)
            .andExpect(jsonPath("$.orderId").value("order_1"))
            .andExpect(jsonPath("$.amountPaise").value(19_900))
    }

    @Test
    fun `reads the caller's own balance and packs`() {
        given(service.overview(id)).willReturn(BillingOverview(true, 4, "INR", emptyList()))

        mockMvc
            .perform(get("/api/v1/billing").with(token()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.creditBalance").value(4))
            .andExpect(jsonPath("$.purchasable").value(true))
    }

    @Test
    fun `refuses orders and confirmations without a token`() {
        mockMvc
            .perform(
                post("/api/v1/billing/orders")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"packId":"single"}"""),
            ).andExpect(status().isUnauthorized)
        mockMvc
            .perform(
                post("/api/v1/billing/orders/order_1/confirm")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"razorpayPaymentId":"pay_1","razorpaySignature":"x"}"""),
            ).andExpect(status().isUnauthorized)
        verifyNoInteractions(service)
    }

    @Test
    fun `admits a webhook with no token and hands the raw body to the signature check`() {
        val body = """{"event":"payment.captured"}"""

        mockMvc
            .perform(
                post("/api/v1/billing/razorpay/webhook")
                    .header("X-Razorpay-Signature", "sig")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content(body),
            ).andExpect(status().isOk)

        verify(service).webhook(body.toByteArray(), "sig")
    }

    private fun token() =
        jwt().jwt { builder: Jwt.Builder ->
            builder
                .subject(id.toString())
                .claim("email", "candidate@example.com")
        }
}
