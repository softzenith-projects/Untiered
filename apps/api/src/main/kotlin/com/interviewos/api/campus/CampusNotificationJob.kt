package com.interviewos.api.campus

import com.interviewos.api.email.EmailProperties
import org.slf4j.LoggerFactory
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component

/**
 * Queues the scheduled campus emails into the outbox; [com.interviewos.api.email.LifecycleEmailJob]
 * sends them. Every 15 minutes: deadline reminders for assignments inside their 48-hour window,
 * and, on Monday from 09:00 India time, the weekly summaries. Both are idempotent through their
 * dedupe keys, so a restart, a second instance or a late run never double-sends.
 *
 * Like the other mail jobs it does nothing while SES is not configured, so no rows pile up.
 */
@Component
class CampusNotificationJob(
    private val notifications: CampusNotifications,
    private val properties: EmailProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(initialDelay = 120_000, fixedDelay = 900_000)
    fun queueScheduled() {
        if (!properties.enabled) return
        runCatching { notifications.queueOpenedAssignments() }
            .onFailure { log.warn("Could not queue campus emails for newly opened assignments ({})", it.javaClass.simpleName) }
        runCatching { notifications.queueDeadlineReminders() }
            .onFailure { log.warn("Could not queue campus deadline reminders ({})", it.javaClass.simpleName) }
        runCatching { notifications.queueWeeklySummaries() }
            .onFailure { log.warn("Could not queue campus weekly summaries ({})", it.javaClass.simpleName) }
    }
}
