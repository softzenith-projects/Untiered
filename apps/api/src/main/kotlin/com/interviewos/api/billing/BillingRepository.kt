package com.interviewos.api.billing

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

/** A credit-pack order as this server recorded it when it was created. */
data class OrderRow(
    val userId: UUID,
    val orderId: String,
    val amountPaise: Long,
    val currency: String,
    val credits: Int,
    val status: String,
)

/**
 * Payments and the credits they grant.
 *
 * Reads on the candidate's behalf are scoped by `user_id` from the verified token, as in
 * `SessionRepository`. The one unscoped path is the webhook's, which has no candidate: it
 * is trusted because Razorpay signed it, and it can only ever grant an order's own credits
 * to the user who created that order.
 */
@Repository
class BillingRepository(
    private val jdbcClient: JdbcClient,
) {
    fun insertOrder(
        userId: UUID,
        orderId: String,
        pack: CreditPack,
        currency: String,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.payments
                       (user_id, provider, provider_order_id, amount_minor, currency, status, plan, credits)
                values (:u, 'razorpay', :o, :amount, :currency, 'created', :plan, :credits)
                """.trimIndent(),
            ).param("u", userId)
            .param("o", orderId)
            .param("amount", pack.pricePaise)
            .param("currency", currency)
            .param("plan", pack.id)
            .param("credits", pack.credits)
            .update()
    }

    fun findOrder(
        userId: UUID,
        orderId: String,
    ): OrderRow? =
        jdbcClient
            .sql(
                """
                select user_id, provider_order_id, amount_minor, currency, credits, status::text as status
                  from public.payments
                 where provider = 'razorpay' and provider_order_id = :o and user_id = :u and credits is not null
                """.trimIndent(),
            ).param("o", orderId)
            .param("u", userId)
            .query { rs, _ ->
                OrderRow(
                    userId = rs.getObject("user_id", UUID::class.java),
                    orderId = rs.getString("provider_order_id"),
                    amountPaise = rs.getLong("amount_minor"),
                    currency = rs.getString("currency"),
                    credits = rs.getInt("credits"),
                    status = rs.getString("status"),
                )
            }.optional()
            .orElse(null)

    /**
     * Marks the order paid and grants its credits, in one statement, once.
     *
     * Both the browser's callback and Razorpay's webhook report the same payment, in either
     * order and possibly at the same moment. The `status <> 'paid'` guard lets only the first
     * update through, and the one-grant-per-payment index catches anything that slips past.
     * When [amountPaise] is given — the webhook path — an order is only paid by a payment of
     * exactly its own amount. Returns true when this call granted the credits.
     *
     * An order whose account was deleted before the payment landed is marked paid and
     * grants nothing — there is nobody left to hold the credits. That payment is a refund
     * to make by hand from the Razorpay dashboard.
     */
    fun markPaidAndGrant(
        orderId: String,
        paymentId: String,
        userId: UUID? = null,
        amountPaise: Long? = null,
    ): Boolean {
        val scope =
            listOfNotNull(
                userId?.let { "and user_id = :u" },
                amountPaise?.let { "and amount_minor = :amount" },
            ).joinToString(" ")
        var statement =
            jdbcClient
                .sql(
                    """
                    with paid as (
                      update public.payments
                         set status = 'paid', provider_payment_id = :p, paid_at = now()
                       where provider = 'razorpay' and provider_order_id = :o and status <> 'paid'
                         and credits is not null $scope
                      returning id, user_id, credits
                    ), granted as (
                      insert into public.interview_credits (user_id, delta, reason, payment_id)
                      select user_id, credits, 'purchase', id from paid where user_id is not null
                      on conflict do nothing
                      returning id
                    )
                    select count(*) from granted
                    """.trimIndent(),
                ).param("o", orderId)
                .param("p", paymentId)
        if (userId != null) statement = statement.param("u", userId)
        if (amountPaise != null) statement = statement.param("amount", amountPaise)
        return statement.query(Int::class.java).single() > 0
    }

    /** A failed attempt. Razorpay lets the same order be retried, so a later success still pays it. */
    fun markFailed(orderId: String) {
        jdbcClient
            .sql(
                """
                update public.payments set status = 'failed'
                 where provider = 'razorpay' and provider_order_id = :o and status = 'created'
                """.trimIndent(),
            ).param("o", orderId)
            .update()
    }
}
