package com.interviewos.api.campus

import java.security.MessageDigest
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.LocalTime
import java.util.UUID

/**
 * The weekly unlock and the certificate id (contract "Module 10"). Pure, so the dates are
 * tested without a database.
 *
 * Week n opens at `startsOn + 7(n − 1)` days, 09:00 India time, and is due 7 days later. India
 * has no daylight saving, so "7 days later" is always exactly 168 hours and always 09:00 IST.
 */
object ProgrammeSchedule {
    val OPENS_AT: LocalTime = LocalTime.of(9, 0)
    val WEEK: Duration = Duration.ofDays(7)
    const val MAX_WEEKS = 12

    /** How far ahead a programme may be scheduled to start. */
    const val MAX_DAYS_AHEAD = 366L

    fun opensAt(
        startsOn: LocalDate,
        week: Int,
    ): Instant {
        require(week in 1..MAX_WEEKS) { "week $week is outside 1..$MAX_WEEKS" }
        return startsOn
            .plusDays(7L * (week - 1))
            .atTime(OPENS_AT)
            .atZone(CampusEmailCopy.INDIA)
            .toInstant()
    }

    fun dueAt(
        startsOn: LocalDate,
        week: Int,
    ): Instant = opensAt(startsOn, week).plus(WEEK)

    /** Today's date in India: a programme may start today or later, never in the past. */
    fun today(now: Instant): LocalDate = now.atZone(CampusEmailCopy.INDIA).toLocalDate()

    /**
     * A stable, unguessable-looking id for one student's certificate of one programme:
     * `UT-` and 16 Crockford base-32 characters of SHA-256 over the two ids. It is derived, not
     * stored, so the same certificate always prints the same id. It identifies; it proves
     * nothing on its own (there is no public verification route in v1).
     */
    fun certificateId(
        programmeId: UUID,
        memberId: UUID,
    ): String {
        val digest = MessageDigest.getInstance("SHA-256").digest("untiered-certificate:$programmeId:$memberId".toByteArray())
        val bits = StringBuilder()
        for (byte in digest.take(10)) bits.append((byte.toInt() and 0xff).toString(2).padStart(8, '0'))
        val code = bits.chunked(5).joinToString("") { CROCKFORD[it.toInt(2)].toString() }
        return "UT-" + code.chunked(4).joinToString("-")
    }

    private const val CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ"
}
