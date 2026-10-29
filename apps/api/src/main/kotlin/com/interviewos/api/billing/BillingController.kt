package com.interviewos.api.billing

import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

@RestController
@RequestMapping("/api/v1/billing")
class BillingController(
    private val service: BillingService,
) {
    @GetMapping
    fun overview(
        @AuthenticationPrincipal jwt: Jwt,
    ): BillingOverview = service.overview(SupabaseIdentity.from(jwt).id)

    @PostMapping("/orders")
    @ResponseStatus(HttpStatus.CREATED)
    fun createOrder(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: CreateOrderRequest,
    ): CheckoutOrder = service.createOrder(SupabaseIdentity.from(jwt), request)

    @PostMapping("/orders/{orderId}/confirm")
    fun confirm(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orderId: String,
        @RequestBody request: ConfirmPaymentRequest,
    ): BillingOverview = service.confirm(SupabaseIdentity.from(jwt).id, orderId, request)

    /** Raw body, because the signature is over the exact bytes Razorpay sent. */
    @PostMapping("/razorpay/webhook")
    fun webhook(
        @RequestBody body: ByteArray,
        @RequestHeader("X-Razorpay-Signature", required = false) signature: String?,
    ) = service.webhook(body, signature)
}
