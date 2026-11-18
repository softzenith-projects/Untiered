package com.interviewos.api.campus

import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.email.EmailProperties
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.stereotype.Component
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.time.Clock
import java.time.LocalDate

/**
 * The package renewal reminders (contract "Module 14"): to a college's joined admins and
 * placement officers, 30 and 7 days before a package's end date, unless a later package has
 * already been recorded (invoiced or paid) for the college.
 *
 * Idempotent twice over: `college_package_reminders` is claimed once per package per kind,
 * in the same transaction as the outbox rows, and the outbox's own dedupe key stops a second
 * row for anyone. A reminder for a college with no admin or placement officer yet is not
 * claimed, so it goes out on a later run once somebody has joined. Behind the campus switch;
 * the campus reminder preference does not apply: this is a billing notice to staff.
 */
@Service
class CollegePackageReminders internal constructor(
    private val packages: CollegePackageRepository,
    private val features: ProductFeatureProperties,
    transactionManager: PlatformTransactionManager,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        packages: CollegePackageRepository,
        features: ProductFeatureProperties,
        transactionManager: PlatformTransactionManager,
    ) : this(packages, features, transactionManager, Clock.systemUTC())

    private val log = LoggerFactory.getLogger(javaClass)
    private val transactions = TransactionTemplate(transactionManager)

    /** Returns how many outbox rows were queued. One failing package does not stop the others. */
    fun queueDue(): Int {
        if (!features.campus) return 0
        val today = CollegePackages.today(clock.instant())
        var queued = 0
        for (candidate in packages.reminderCandidates(today)) {
            try {
                queued += transactions.execute { queueOne(candidate, today) } ?: 0
            } catch (cause: RuntimeException) {
                log.warn("Could not queue the renewal reminder for package {} ({})", candidate.row.id, cause.javaClass.simpleName)
            }
        }
        return queued
    }

    private fun queueOne(
        candidate: ReminderPackage,
        today: LocalDate,
    ): Int {
        val pkg = candidate.row.usage()
        val superseded = packages.laterIssued(candidate.orgId, pkg.id, pkg.endsOn)
        val kind = CollegePackages.reminderDue(pkg, today, candidate.row.remindersSent, superseded) ?: return 0
        val recipients = packages.billingRecipients(candidate.orgId)
        if (recipients == 0) return 0
        if (!packages.claimReminder(candidate.orgId, pkg.id, kind, today, recipients)) return 0
        return packages.enqueueForStaff(candidate.orgId, CampusEmailCopy.packageReminder(candidate.college, pkg, kind))
    }
}

/** Daily at 09:30 India time, beside the other campus email jobs; nothing while SES is off. */
@Component
class CollegePackageReminderJob(
    private val reminders: CollegePackageReminders,
    private val properties: EmailProperties,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Scheduled(cron = "0 30 9 * * *", zone = "Asia/Kolkata")
    fun queueDaily() {
        if (!properties.enabled) return
        runCatching { reminders.queueDue() }
            .onFailure { log.warn("Could not queue college package reminders ({})", it.javaClass.simpleName) }
    }
}
