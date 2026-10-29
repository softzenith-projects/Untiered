package com.interviewos.api.interview

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.ZoneId

/**
 * How much free practice a candidate gets.
 *
 * Two separate allowances:
 *
 * - **Lifetime** ([freeRounds]): how many rounds a candidate may start free, ever, before
 *   paying (owner decision, 29 Oct 2026: 3). A round that fails on our side is handed back.
 *   This is what bounds the model bill now that paid interviews exist. Null means no limit.
 * - **Daily** ([dailyRounds], [dailyMinutes]): how many free rounds may be *started*, and
 *   how many planned minutes they may add up to, per calendar day in [dayZone]. Off by
 *   default since the lifetime limit replaced it: a candidate may use all three free rounds
 *   in their first sitting. Null switches either one off; paid rounds never count.
 *
 * The web's legal pages state these numbers (`apps/web/src/lib/legal.ts`), so change both.
 *
 * The day is India's because the product is India-first; a candidate elsewhere still gets
 * the same allowance, it just resets at a different hour of their day.
 */
@ConfigurationProperties(prefix = "interviewos.entitlement")
data class EntitlementProperties(
    val freeRounds: Int? = 3,
    val dailyRounds: Int? = null,
    val dailyMinutes: Int? = null,
    val dayZone: ZoneId = ZoneId.of("Asia/Kolkata"),
)
