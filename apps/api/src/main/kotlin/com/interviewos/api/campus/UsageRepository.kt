package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.time.Instant
import java.util.UUID

/**
 * The platform operator's usage and cost read (campus module 11): every college in one
 * statement. Cost is `ai_calls.micro_usd` for the sessions of that college's assignment
 * attempts only, so a student's personal rounds (no attempt) never count, and one college's
 * attempts can never pick up another's sessions (an attempt carries its own `org_id`).
 */
@Repository
class UsageRepository(
    private val jdbc: JdbcClient,
) {
    internal companion object {
        /** `"technical_fundamentals:3,hr_fit_closing:1"` (round types hold no ':' or ','). Anything malformed is skipped. */
        fun parseRounds(value: String?): List<RoundUsage> =
            value
                .orEmpty()
                .split(',')
                .mapNotNull { part ->
                    val roundType = part.substringBeforeLast(':', "")
                    val count = part.substringAfterLast(':', "").toIntOrNull()
                    if (roundType.isEmpty() || count == null) null else RoundUsage(roundType, count)
                }
    }

    /** [admin] is proof the caller passed the platform-admin gate; nothing here is scoped to one college. */
    @Suppress("UNUSED_PARAMETER")
    fun usage(
        admin: PlatformAdmin,
        from: Instant,
        to: Instant,
        monthStart: Instant,
        monthEnd: Instant,
    ): List<OrgUsageFacts> =
        jdbc
            .sql(
                """
                /* unscoped: platform-admin-usage */
                select o.id, o.name, o.interview_allowance,
                       coalesce(att.used, 0) as used,
                       coalesce(att.this_month, 0) as this_month,
                       coalesce(att.in_range, 0) as in_range,
                       coalesce(cost.micro_usd, 0) as micro_usd,
                       coalesce(rounds.by_round, '') as by_round
                  from public.organisations o
                  left join lateral (
                        select count(*) filter (where a.org_funded and a.status <> 'failed') as used,
                               count(*) filter (where a.org_funded and a.status <> 'failed'
                                                  and a.started_at >= cast(:monthStart as timestamptz)
                                                  and a.started_at < cast(:monthEnd as timestamptz)) as this_month,
                               count(*) filter (where a.org_funded and a.status <> 'failed'
                                                  and a.started_at >= cast(:from as timestamptz)
                                                  and a.started_at < cast(:to as timestamptz)) as in_range
                          from public.assignment_attempts a
                         where a.org_id = o.id
                  ) att on true
                  left join lateral (
                        select string_agg(t.round_type || ':' || t.n, ',') as by_round
                          from (select x.round_type, count(*) as n
                                  from public.assignment_attempts a
                                  join public.assignments x on x.org_id = a.org_id and x.id = a.assignment_id
                                 where a.org_id = o.id and a.org_funded and a.status <> 'failed' and x.round_type is not null
                                   and a.started_at >= cast(:from as timestamptz)
                                   and a.started_at < cast(:to as timestamptz)
                                 group by x.round_type) t
                  ) rounds on true
                  left join lateral (
                        select sum(c.micro_usd) as micro_usd
                          from public.assignment_attempts a
                          join public.ai_calls c on c.session_id = a.session_id
                         where a.org_id = o.id
                           and c.occurred_at >= cast(:from as timestamptz)
                           and c.occurred_at < cast(:to as timestamptz)
                  ) cost on true
                 order by o.name, o.id
                """.trimIndent(),
            ).param("from", from.toString())
            .param("to", to.toString())
            .param("monthStart", monthStart.toString())
            .param("monthEnd", monthEnd.toString())
            .query { rs, _ ->
                OrgUsageFacts(
                    orgId = UUID.fromString(rs.getString("id")),
                    orgName = rs.getString("name"),
                    interviewAllowance = rs.getInt("interview_allowance"),
                    interviewsUsed = rs.getInt("used"),
                    interviewsThisMonth = rs.getInt("this_month"),
                    interviewsInRange = rs.getInt("in_range"),
                    microUsd = rs.getLong("micro_usd"),
                    interviewsByRound = parseRounds(rs.getString("by_round")),
                )
            }.list()
}
