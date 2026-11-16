package com.interviewos.api.campus

import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.format.DateTimeFormatter
import java.util.Locale
import java.util.UUID

/** What goes into the outbox: the `email_deliveries` category, dedupe key, subject and body. */
data class CampusEmail(
    val category: String,
    val dedupeKey: String,
    val subject: String,
    val body: String,
)

/** The week a staff summary covers, Monday 00:00 to the next Monday 00:00 India time. */
data class WeekWindow(
    val start: Instant,
    val end: Instant,
    val startDate: LocalDate,
)

/** Counts only, for the weekly summary. Never a score. */
data class WeeklyCounts(
    val joined: Int,
    val active: Int,
    val completed: Int,
    val due: Int,
    val overdue: Int,
)

/**
 * Campus email copy (campus spec §9): plain, naming the college and the assignment, with the
 * deadline in India time. None of it carries a score. The button to `/dashboard` (students) or
 * `/campus` (staff) is added by the sender. The dedupe keys are stable, so a retry or a second
 * trigger for the same event never queues a second email.
 */
object CampusEmailCopy {
    const val CATEGORY_ASSIGNMENT = "campus_assignment"
    const val CATEGORY_REMINDER = "campus_reminder"
    const val CATEGORY_REPORT = "campus_report_ready"
    const val CATEGORY_WEEKLY = "campus_weekly"

    /** Categories a student or staff member can switch off with `campusReminders`. */
    val OPTIONAL_CATEGORIES = listOf(CATEGORY_REMINDER, CATEGORY_REPORT, CATEGORY_WEEKLY)

    val INDIA: ZoneId = ZoneId.of("Asia/Kolkata")
    private val DEADLINE = DateTimeFormatter.ofPattern("d MMMM yyyy, h:mm a", Locale.ENGLISH)
    private val DAY = DateTimeFormatter.ofPattern("d MMMM yyyy", Locale.ENGLISH)

    fun deadline(dueAt: Instant): String = DEADLINE.format(dueAt.atZone(INDIA)).replace("AM", "am").replace("PM", "pm") + " IST"

    fun assignmentKey(assignmentId: UUID) = "campus-assignment-$assignmentId"

    fun reminderKey(assignmentId: UUID) = "campus-reminder-$assignmentId"

    fun reportKey(sessionId: UUID) = "campus-report-$sessionId"

    fun weeklyKey(
        orgId: UUID,
        week: WeekWindow,
    ) = "campus-weekly-$orgId-${week.startDate}"

    fun newAssignment(
        assignmentId: UUID,
        college: String,
        title: String,
        dueAt: Instant,
    ) = CampusEmail(
        CATEGORY_ASSIGNMENT,
        assignmentKey(assignmentId),
        "New assignment from $college: $title",
        buildString {
            appendLine("$college has set you a new assignment on Untiered: $title.")
            appendLine()
            appendLine("It is due ${deadline(dueAt)}.")
            append("Open your dashboard to see what it involves and to start it.")
        },
    )

    fun deadlineReminder(
        assignmentId: UUID,
        college: String,
        title: String,
        dueAt: Instant,
    ) = CampusEmail(
        CATEGORY_REMINDER,
        reminderKey(assignmentId),
        "Due in two days: $title",
        buildString {
            appendLine("A reminder from $college: you have not yet completed $title.")
            appendLine()
            appendLine("It is due ${deadline(dueAt)}.")
            append("You can turn these reminders off in your email preferences.")
        },
    )

    fun reportReady(
        sessionId: UUID,
        college: String,
        title: String,
    ) = CampusEmail(
        CATEGORY_REPORT,
        reportKey(sessionId),
        "Your report for $title is ready",
        buildString {
            appendLine("You finished $title, set by $college. The feedback report on your interview is ready.")
            appendLine()
            append("Open your dashboard to read it. You can turn these emails off in your email preferences.")
        },
    )

    fun weeklySummary(
        orgId: UUID,
        college: String,
        week: WeekWindow,
        counts: WeeklyCounts,
    ): CampusEmail {
        val last = week.startDate.plusDays(6)
        return CampusEmail(
            CATEGORY_WEEKLY,
            weeklyKey(orgId, week),
            "$college this week on Untiered",
            buildString {
                appendLine("Your weekly summary for $college, ${DAY.format(week.startDate)} to ${DAY.format(last)}.")
                appendLine()
                appendLine("Students who joined: ${counts.joined}")
                appendLine("Students active in the last 14 days: ${counts.active}")
                appendLine("Assignments due this week: ${counts.completed} of ${counts.due} student assignments completed")
                appendLine("Student assignments now overdue: ${counts.overdue}")
                appendLine()
                append("Open Untiered Campus for the detail. You can turn this summary off in your email preferences.")
            },
        )
    }

    /** Monday 00:00 India time of the week that has just ended, as of [now]. */
    fun weekEndingBefore(now: Instant): WeekWindow {
        val today = now.atZone(INDIA).toLocalDate()
        val thisMonday = today.minusDays((today.dayOfWeek.value - 1).toLong())
        val start = thisMonday.minusDays(7)
        return WeekWindow(start.atStartOfDay(INDIA).toInstant(), thisMonday.atStartOfDay(INDIA).toInstant(), start)
    }
}
