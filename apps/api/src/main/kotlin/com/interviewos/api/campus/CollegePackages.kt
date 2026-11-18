package com.interviewos.api.campus

import org.springframework.boot.context.properties.ConfigurationProperties
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.ChronoUnit
import java.util.UUID

/** `college_packages.status` (contract "Module 14"). */
enum class PackageStatus(
    val wireValue: String,
) {
    DRAFT("draft"),
    INVOICED("invoiced"),
    PAID("paid"),
    VOID("void"),
    ;

    /** Invoiced or paid: the package has been issued to the college. */
    val issued: Boolean get() = this == INVOICED || this == PAID

    companion object {
        fun fromWireValue(value: String?): PackageStatus? = entries.firstOrNull { it.wireValue == value }
    }
}

/** The two renewal reminders, by how many days before `ends_on` each one is due. */
enum class PackageReminderKind(
    val dbValue: String,
    val daysBefore: Int,
) {
    ENDS_IN_30("ends_in_30", 30),
    ENDS_IN_7("ends_in_7", 7),
    ;

    companion object {
        fun fromDbValue(value: String?): PackageReminderKind? = entries.firstOrNull { it.dbValue == value }
    }
}

/**
 * Which package statuses fund an interview (`interviewos.campus.billing.funding-statuses`).
 * Both invoiced and paid by default, so a college is not blocked while its bank transfer
 * clears; `paid` alone makes payment a precondition. Draft and void never fund anything,
 * whatever this says.
 */
@ConfigurationProperties(prefix = "interviewos.campus.billing")
data class CollegeBillingProperties(
    val fundingStatuses: List<String> = listOf(PackageStatus.INVOICED.wireValue, PackageStatus.PAID.wireValue),
) {
    val funding: Set<PackageStatus>
        get() = fundingStatuses.mapNotNull { PackageStatus.fromWireValue(it.trim()) }.filter { it.issued }.toSet()
}

/** One issued package and how much of it is spent, as admission reads it under the org lock. */
data class PackageUsage(
    val id: UUID,
    val status: PackageStatus,
    val interviews: Int,
    val perStudentLimit: Int?,
    val startsOn: LocalDate,
    val endsOn: LocalDate,
    val graceDays: Int,
    /** Attempts charged to this package that did not fail, across the college. */
    val used: Int,
    /** This student's attempts charged to this package that did not fail. */
    val usedByStudent: Int = 0,
) {
    val lastUsableOn: LocalDate get() = endsOn.plusDays(graceDays.toLong())
    val remaining: Int get() = (interviews - used).coerceAtLeast(0)
}

/**
 * What package funding says about one student's next college-assigned interview: the package
 * that pays for it, or why none can. Null from [CollegePackages.choose] means the college has
 * no issued package, and the allowance decides instead.
 */
data class PackageChoice(
    val packageId: UUID?,
    val blocked: AssignmentGate.Blocked?,
) {
    init {
        require((packageId == null) != (blocked == null)) { "A choice is a package or a refusal" }
    }
}

/**
 * The package rules (contract "Module 14"), pure so the edges are tested without a database:
 * India dates, the grace period, first-to-expire first, the per-student limit and the
 * failed-attempt refund (a failed attempt is simply not in `used`).
 */
object CollegePackages {
    val INDIA: ZoneId = CampusEmailCopy.INDIA

    /** The calendar date in India at [now]: a package's dates are India dates. */
    fun today(now: Instant): LocalDate = now.atZone(INDIA).toLocalDate()

    /** Whether [pkg] can fund an interview on [today], spent or not. */
    fun inWindow(
        pkg: PackageUsage,
        today: LocalDate,
        funding: Set<PackageStatus>,
    ): Boolean = pkg.status in funding && pkg.status.issued && !today.isBefore(pkg.startsOn) && !today.isAfter(pkg.lastUsableOn)

    private val FIFO: Comparator<PackageUsage> =
        compareBy<PackageUsage>({ it.endsOn }, { it.lastUsableOn }, { it.startsOn }, { it.id })

    /**
     * The package that pays for this student's next interview, or why none can, checked in
     * this order:
     * 1. no issued package at all → null (the allowance applies, exactly as before packages);
     * 2. none in its window with a funding status → [AssignmentGate.Blocked.NO_ACTIVE_PACKAGE];
     * 3. every one of those spent → [AssignmentGate.Blocked.COLLEGE_ALLOWANCE];
     * 4. the student at the per-student limit of every one with interviews left →
     *    [AssignmentGate.Blocked.PACKAGE_STUDENT_LIMIT];
     * 5. otherwise the remaining candidate with the earliest end date.
     *
     * [packages] are the college's packages with this student's usage; drafts and voids may be
     * included and are ignored.
     */
    fun choose(
        packages: List<PackageUsage>,
        today: LocalDate,
        funding: Set<PackageStatus>,
    ): PackageChoice? {
        if (packages.none { it.status.issued }) return null
        val open = packages.filter { inWindow(it, today, funding) }
        if (open.isEmpty()) return PackageChoice(null, AssignmentGate.Blocked.NO_ACTIVE_PACKAGE)
        val withRoom = open.filter { it.remaining > 0 }
        if (withRoom.isEmpty()) return PackageChoice(null, AssignmentGate.Blocked.COLLEGE_ALLOWANCE)
        val forStudent = withRoom.filter { it.perStudentLimit == null || it.usedByStudent < it.perStudentLimit }
        val chosen = forStudent.minWithOrNull(FIFO) ?: return PackageChoice(null, AssignmentGate.Blocked.PACKAGE_STUDENT_LIMIT)
        return PackageChoice(chosen.id, null)
    }

    /**
     * The package staff see as the college's current one: the package the next interview
     * would come from (ignoring any one student's limit), else the earliest-ending one in its
     * window even when spent, else null.
     */
    fun current(
        packages: List<PackageUsage>,
        today: LocalDate,
        funding: Set<PackageStatus>,
    ): PackageUsage? {
        val open = packages.filter { inWindow(it, today, funding) }
        return open.filter { it.remaining > 0 }.minWithOrNull(FIFO) ?: open.minWithOrNull(FIFO)
    }

    /** Days from [today] to the package's end date; negative once it has ended. */
    fun daysLeft(
        pkg: PackageUsage,
        today: LocalDate,
    ): Long = ChronoUnit.DAYS.between(today, pkg.endsOn)

    /**
     * Whether a later package has been recorded for the same college, which silences the
     * renewal reminders: another issued (invoiced or paid) package ending after this one.
     */
    fun superseded(
        pkg: PackageUsage,
        all: List<PackageUsage>,
    ): Boolean = all.any { it.id != pkg.id && it.status.issued && it.endsOn.isAfter(pkg.endsOn) }

    /**
     * The reminder due for [pkg] on [today], if any. The 30-day one is due from 30 days before
     * the end date until 8 days before; the 7-day one from 7 days before until the end date.
     * Inside the 7-day window only the 7-day reminder goes out, so a package recorded late,
     * or a missed run, never sends both at once. Only an issued package gets reminders.
     */
    fun reminderDue(
        pkg: PackageUsage,
        today: LocalDate,
        sent: Set<PackageReminderKind>,
        superseded: Boolean,
    ): PackageReminderKind? {
        if (!pkg.status.issued || superseded) return null
        val left = daysLeft(pkg, today)
        return when {
            left in 0..PackageReminderKind.ENDS_IN_7.daysBefore -> {
                PackageReminderKind.ENDS_IN_7.takeUnless { it in sent }
            }

            left in (PackageReminderKind.ENDS_IN_7.daysBefore + 1)..PackageReminderKind.ENDS_IN_30.daysBefore -> {
                PackageReminderKind.ENDS_IN_30.takeUnless { it in sent }
            }

            else -> {
                null
            }
        }
    }

    /**
     * The next date a reminder for [pkg] will go out: today when one is due now, else the start
     * of the next window not yet passed. Null when none will (superseded, not issued, all
     * sent, or ended).
     */
    fun nextReminderOn(
        pkg: PackageUsage,
        today: LocalDate,
        sent: Set<PackageReminderKind>,
        superseded: Boolean,
    ): LocalDate? {
        if (!pkg.status.issued || superseded) return null
        if (reminderDue(pkg, today, sent, superseded = false) != null) return today
        return PackageReminderKind.entries
            .filter { it !in sent }
            .map { pkg.endsOn.minusDays(it.daysBefore.toLong()) }
            .filter { it.isAfter(today) }
            .minOrNull()
    }
}
