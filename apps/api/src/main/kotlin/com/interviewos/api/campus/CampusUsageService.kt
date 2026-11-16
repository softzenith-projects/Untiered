package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.time.Clock
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.format.DateTimeParseException

/**
 * Internal usage and AI cost per college (campus module 11). Platform admin only, and a 404 for
 * everyone else, as every `/admin/campus` route. The figure is an estimate from the existing
 * `ai_calls` ledger; the page says so.
 *
 * The range is calendar dates in UTC and both ends are inclusive: `to` covers its whole day.
 */
@Service
class CampusUsageService internal constructor(
    private val access: CampusAccess,
    private val usage: UsageRepository,
    private val clock: Clock,
) {
    @Autowired
    constructor(access: CampusAccess, usage: UsageRepository) : this(access, usage, Clock.systemUTC())

    @Transactional(readOnly = true)
    fun usage(
        identity: SupabaseIdentity,
        from: String?,
        to: String?,
    ): List<OrgUsageRow> {
        val admin = access.requirePlatformAdmin(identity)
        val today = LocalDate.now(clock.withZone(ZoneOffset.UTC))
        val firstOfMonth = today.withDayOfMonth(1)
        val fromDate = parse(from, "from") ?: firstOfMonth
        val toDate = parse(to, "to") ?: firstOfMonth.plusMonths(1).minusDays(1)
        if (toDate.isBefore(fromDate)) throw ApiException.badRequest("`to` must not be before `from`.", code = "usage_range_invalid")
        val facts =
            usage.usage(
                admin,
                from = fromDate.atStartOfDay().toInstant(ZoneOffset.UTC),
                to = toDate.plusDays(1).atStartOfDay().toInstant(ZoneOffset.UTC),
                monthStart = firstOfMonth.atStartOfDay().toInstant(ZoneOffset.UTC),
                monthEnd = firstOfMonth.plusMonths(1).atStartOfDay().toInstant(ZoneOffset.UTC),
            )
        return facts.map(::row)
    }

    private fun parse(
        value: String?,
        name: String,
    ): LocalDate? {
        if (value.isNullOrBlank()) return null
        return try {
            LocalDate.parse(value.trim())
        } catch (_: DateTimeParseException) {
            throw ApiException.badRequest("`$name` must be a date like 2026-11-01.", code = "usage_range_invalid")
        }
    }

    companion object {
        internal fun row(facts: OrgUsageFacts): OrgUsageRow {
            val cost = facts.microUsd / MICRO
            return OrgUsageRow(
                orgId = facts.orgId,
                orgName = facts.orgName,
                interviewAllowance = facts.interviewAllowance,
                interviewsUsed = facts.interviewsUsed,
                interviewsThisMonth = facts.interviewsThisMonth,
                aiCostUsd = cost,
                aiCostPerInterviewUsd = if (facts.interviewsInRange == 0) null else cost / facts.interviewsInRange,
            )
        }

        private const val MICRO = 1_000_000.0
    }
}

/** `GET /admin/campus/usage` (contract "Module 11"). */
@RestController
@RequestMapping("/api/v1/admin/campus/usage")
class CampusUsageController(
    private val service: CampusUsageService,
) {
    @GetMapping
    fun usage(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam(required = false) from: String?,
        @RequestParam(required = false) to: String?,
    ): List<OrgUsageRow> = service.usage(SupabaseIdentity.from(jwt), from, to)
}
