package com.interviewos.api.billing

import org.springframework.boot.context.properties.ConfigurationProperties

/**
 * What can be bought, and the Razorpay account it is bought through.
 *
 * Buying is off until both API keys are set ([enabled]): the start screen then says Pro
 * is coming, exactly as before, and the billing endpoints refuse. The free allowance in
 * `interviewos.entitlement` is untouched either way — credits only ever add to it.
 *
 * Prices are in paise and inclusive of every tax, because an Indian consumer price has to
 * be the price paid. The packs are the owner's (28 October 2026); a pack's `id` is stored
 * on its payment row, so retire an id rather than reusing it for a different pack.
 */
@ConfigurationProperties(prefix = "interviewos.billing")
data class BillingProperties(
    val razorpay: Razorpay = Razorpay(),
    val packs: List<CreditPack> = DEFAULT_PACKS,
) {
    val enabled: Boolean get() = razorpay.keyId.isNotBlank() && razorpay.keySecret.isNotBlank()

    fun pack(id: String): CreditPack? = packs.firstOrNull { it.id == id }

    data class Razorpay(
        val keyId: String = "",
        val keySecret: String = "",
        /** Signs webhook deliveries. Separate from the key secret, and set in the dashboard. */
        val webhookSecret: String = "",
        val baseUrl: String = "https://api.razorpay.com",
    )

    companion object {
        val DEFAULT_PACKS =
            listOf(
                CreditPack(id = "single", name = "1 credit", credits = 1, pricePaise = 19_900),
                CreditPack(id = "pack_5", name = "5 credits", credits = 5, pricePaise = 89_900),
                CreditPack(id = "pack_10", name = "10 credits", credits = 10, pricePaise = 1_49_900),
            )
    }
}

/** A number of interview credits sold together at one price. */
data class CreditPack(
    val id: String,
    val name: String,
    val credits: Int,
    val pricePaise: Long,
)
