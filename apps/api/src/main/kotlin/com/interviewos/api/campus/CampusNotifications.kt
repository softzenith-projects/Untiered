package com.interviewos.api.campus

import com.interviewos.api.config.ProductFeatureProperties
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import java.time.Clock
import java.time.DayOfWeek
import java.time.Instant
import java.util.UUID

/**
 * The campus emails (campus spec section 9), behind the campus switch: with it off nothing is
 * queued. The callers that queue on a write (publish, join, round completion) run this inside
 * their own transaction, so a rolled-back publish tells nobody. The scheduled kinds
 * (reminders, the weekly summary) are driven by [CampusNotificationJob].
 *
 * Whether a message is then sent is decided at dispatch, by the recipient's preferences:
 * `campusReminders` turns off every kind here except the new-assignment email.
 */
@Service
class CampusNotifications internal constructor(
    private val repository: CampusNotificationRepository,
    private val features: ProductFeatureProperties,
    private val clock: Clock,
) {
    @Autowired
    constructor(repository: CampusNotificationRepository, features: ProductFeatureProperties) :
        this(repository, features, Clock.systemUTC())

    private val log = LoggerFactory.getLogger(javaClass)

    fun assignmentPublished(
        orgId: UUID,
        assignmentId: UUID,
    ) {
        if (!features.campus) return
        repository.enqueueNewAssignment(orgId, assignmentId)
    }

    fun studentJoined(
        orgId: UUID,
        memberId: UUID,
    ) {
        if (!features.campus) return
        repository.enqueueOpenAssignmentsForMember(orgId, memberId, clock.instant())
    }

    /** Never throws: telling a student their report is ready must not fail their round. */
    fun roundCompleted(sessionId: UUID) {
        if (!features.campus) return
        try {
            val round = repository.finishedAssignedRound(sessionId) ?: return
            repository.enqueueReportReady(sessionId, round)
        } catch (cause: RuntimeException) {
            log.warn("Could not queue the report-ready email for round {} ({})", sessionId, cause.javaClass.simpleName)
        }
    }

    /** Returns how many rows were queued. One failing college does not stop the others. */
    fun queueDeadlineReminders(): Int {
        if (!features.campus) return 0
        var queued = 0
        for (candidate in repository.dueForReminder(clock.instant())) {
            try {
                queued += repository.enqueueDeadlineReminder(candidate)
            } catch (cause: RuntimeException) {
                log.warn("Could not queue deadline reminders for assignment {} ({})", candidate.assignmentId, cause.javaClass.simpleName)
            }
        }
        return queued
    }

    /**
     * The summary for the week that has just ended, on Mondays only (India time). Run often; the
     * week's dedupe key makes every run after the first a no-op.
     */
    fun queueWeeklySummaries(): Int {
        if (!features.campus) return 0
        val now = clock.instant()
        if (!isSummaryDay(now)) return 0
        val week = CampusEmailCopy.weekEndingBefore(now)
        var queued = 0
        for (target in repository.weeklyTargets()) {
            try {
                val counts = repository.weeklyCounts(target.orgId, week, now)
                queued += repository.enqueueWeekly(target.orgId, CampusEmailCopy.weeklySummary(target.orgId, target.name, week, counts))
            } catch (cause: RuntimeException) {
                log.warn("Could not queue the weekly summary for college {} ({})", target.orgId, cause.javaClass.simpleName)
            }
        }
        return queued
    }

    companion object {
        /** Monday, 09:00 India time or later. */
        fun isSummaryDay(now: Instant): Boolean {
            val local = now.atZone(CampusEmailCopy.INDIA)
            return local.dayOfWeek == DayOfWeek.MONDAY && local.hour >= 9
        }
    }
}
