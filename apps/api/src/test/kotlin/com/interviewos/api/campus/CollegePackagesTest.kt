package com.interviewos.api.campus

import com.interviewos.api.campus.AssignmentGate.Blocked
import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * The package rules of contract "Module 14", without a database: India dates, the grace
 * period, first-to-expire first, the per-student limit, the failed-attempt refund and the
 * fallback to the allowance when a college has no issued package.
 */
class CollegePackagesTest {
    private val funding = CollegeBillingProperties().funding
    private val today = LocalDate.parse("2026-11-20")

    private fun pkg(
        id: Int = 1,
        status: PackageStatus = PackageStatus.PAID,
        interviews: Int = 100,
        perStudentLimit: Int? = 4,
        startsOn: String = "2026-08-01",
        endsOn: String = "2027-01-31",
        graceDays: Int = 14,
        used: Int = 0,
        usedByStudent: Int = 0,
    ) = PackageUsage(
        id = UUID(0, id.toLong()),
        status = status,
        interviews = interviews,
        perStudentLimit = perStudentLimit,
        startsOn = LocalDate.parse(startsOn),
        endsOn = LocalDate.parse(endsOn),
        graceDays = graceDays,
        used = used,
        usedByStudent = usedByStudent,
    )

    private fun choose(
        vararg packages: PackageUsage,
        on: LocalDate = today,
        statuses: Set<PackageStatus> = funding,
    ) = CollegePackages.choose(packages.toList(), on, statuses)

    @Test
    fun `invoiced and paid both fund interviews by default, draft and void never do`() {
        assertEquals(setOf(PackageStatus.INVOICED, PackageStatus.PAID), funding)
        assertEquals(setOf(PackageStatus.PAID), CollegeBillingProperties(listOf("paid", "draft", "void", "nonsense")).funding)
    }

    @Test
    fun `a college with no issued package keeps the allowance`() {
        assertNull(choose())
        assertNull(choose(pkg(status = PackageStatus.DRAFT), pkg(id = 2, status = PackageStatus.VOID)))
    }

    @Test
    fun `an issued package with room funds the interview`() {
        assertEquals(PackageChoice(UUID(0, 1), null), choose(pkg()))
        assertEquals(PackageChoice(UUID(0, 1), null), choose(pkg(status = PackageStatus.INVOICED)))
    }

    @Test
    fun `an invoiced package does not fund when only paid ones do`() {
        assertEquals(Blocked.NO_ACTIVE_PACKAGE, choose(pkg(status = PackageStatus.INVOICED), statuses = setOf(PackageStatus.PAID))?.blocked)
    }

    @Test
    fun `the window runs from the start date through the end date plus grace, inclusive`() {
        val p = pkg(startsOn = "2026-12-01", endsOn = "2026-12-31", graceDays = 14)
        assertEquals(Blocked.NO_ACTIVE_PACKAGE, choose(p, on = LocalDate.parse("2026-11-30"))?.blocked)
        assertEquals(p.id, choose(p, on = LocalDate.parse("2026-12-01"))?.packageId)
        assertEquals(p.id, choose(p, on = LocalDate.parse("2026-12-31"))?.packageId)
        // In grace: still usable.
        assertEquals(p.id, choose(p, on = LocalDate.parse("2027-01-14"))?.packageId)
        assertEquals(LocalDate.parse("2027-01-14"), p.lastUsableOn)
        // Lapsed: unused interviews are gone.
        assertEquals(Blocked.NO_ACTIVE_PACKAGE, choose(p, on = LocalDate.parse("2027-01-15"))?.blocked)
        // No grace at all.
        assertEquals(Blocked.NO_ACTIVE_PACKAGE, choose(p.copy(graceDays = 0), on = LocalDate.parse("2027-01-01"))?.blocked)
    }

    @Test
    fun `today is the India date, so 19 00 UTC on the last grace day has already lapsed`() {
        // 2027-01-14 19:00 UTC is 2027-01-15 00:30 IST.
        assertEquals(LocalDate.parse("2027-01-15"), CollegePackages.today(Instant.parse("2027-01-14T19:00:00Z")))
        assertEquals(LocalDate.parse("2027-01-14"), CollegePackages.today(Instant.parse("2027-01-14T18:29:59Z")))
        // And a package starting on 1 December opens at 00:00 IST, 18:30 UTC the day before.
        assertEquals(LocalDate.parse("2026-12-01"), CollegePackages.today(Instant.parse("2026-11-30T18:30:00Z")))
    }

    @Test
    fun `a spent pool refuses with the allowance wording`() {
        val choice = choose(pkg(interviews = 100, used = 100))
        assertEquals(Blocked.COLLEGE_ALLOWANCE, choice?.blocked)
        assertEquals("Your college has used up its interview allowance for now. Ask your placement office.", choice?.blocked?.message)
    }

    @Test
    fun `a failed attempt is not in used, so its interview is available again`() {
        // 100 started, one failed: the repository counts 99, and one is left.
        assertEquals(UUID(0, 1), choose(pkg(interviews = 100, used = 99))?.packageId)
    }

    @Test
    fun `the per-student limit stops one student, not the college`() {
        assertEquals(Blocked.PACKAGE_STUDENT_LIMIT, choose(pkg(perStudentLimit = 4, usedByStudent = 4))?.blocked)
        assertEquals(UUID(0, 1), choose(pkg(perStudentLimit = 4, usedByStudent = 3))?.packageId)
        assertEquals(UUID(0, 1), choose(pkg(perStudentLimit = null, usedByStudent = 40))?.packageId)
    }

    @Test
    fun `the earliest-ending usable package is spent first`() {
        val later = pkg(id = 1, startsOn = "2026-11-01", endsOn = "2027-05-31")
        val sooner = pkg(id = 2, startsOn = "2026-06-01", endsOn = "2026-11-30")
        assertEquals(sooner.id, choose(later, sooner)?.packageId)
        // Once the earlier one is spent, the next one takes over.
        assertEquals(later.id, choose(later, sooner.copy(used = 100))?.packageId)
        // A student at the limit of the earlier one moves on to the later one.
        assertEquals(later.id, choose(later, sooner.copy(usedByStudent = 4))?.packageId)
        // A package in the grace period still comes before a fresh one.
        assertEquals(sooner.id, choose(later, sooner, on = LocalDate.parse("2026-12-10"))?.packageId)
    }

    @Test
    fun `a renewal carries nothing over`() {
        // The old package lapsed with 60 unused; the new one is exactly what it says.
        val old = pkg(id = 1, endsOn = "2026-10-31", used = 40)
        val renewal = pkg(id = 2, interviews = 50, startsOn = "2026-11-01", endsOn = "2027-04-30", used = 50)
        assertEquals(Blocked.COLLEGE_ALLOWANCE, choose(old, renewal)?.blocked)
    }

    @Test
    fun `the reasons come in order - no package in window, then spent, then the student's limit`() {
        val future = pkg(id = 1, startsOn = "2027-01-01", endsOn = "2027-06-30")
        val spent = pkg(id = 2, used = 100)
        val atLimit = pkg(id = 3, usedByStudent = 4)
        assertEquals(Blocked.NO_ACTIVE_PACKAGE, choose(future)?.blocked)
        assertEquals(Blocked.COLLEGE_ALLOWANCE, choose(future, spent)?.blocked)
        assertEquals(Blocked.PACKAGE_STUDENT_LIMIT, choose(future, spent, atLimit)?.blocked)
    }

    @Test
    fun `the gate uses the package choice instead of the allowance, after the student's own caps`() {
        val now = Instant.parse("2026-11-20T10:00:00Z")

        fun gate(
            packages: PackageChoice?,
            collegeUsed: Int = 0,
            attemptsUsed: Int = 0,
        ) = AssignmentGate.evaluate(
            kind = AssignmentKind.INTERVIEW,
            now = now,
            opensAt = now.minusSeconds(60),
            dueAt = now.plusSeconds(3600),
            allowLate = false,
            attemptsUsed = attemptsUsed,
            attemptLimit = 2,
            orgFundedUsed = attemptsUsed,
            interviewCap = null,
            collegeUsed = collegeUsed,
            collegeAllowance = 0,
            packages = packages,
        )
        // The allowance is 0 and used up, but a package funds it.
        assertNull(gate(PackageChoice(UUID(0, 1), null)))
        assertEquals(Blocked.PACKAGE_STUDENT_LIMIT, gate(PackageChoice(null, Blocked.PACKAGE_STUDENT_LIMIT)))
        // No packages: the allowance decides exactly as before.
        assertEquals(Blocked.COLLEGE_ALLOWANCE, gate(null))
        // The assignment's own attempt limit is still checked first.
        assertEquals(Blocked.ATTEMPT_LIMIT, gate(PackageChoice(null, Blocked.NO_ACTIVE_PACKAGE), attemptsUsed = 2))
        // An MCQ test never needs a package.
        assertNull(
            AssignmentGate.evaluate(
                AssignmentKind.MCQ_TEST,
                now,
                now.minusSeconds(60),
                now.plusSeconds(3600),
                false,
                0,
                2,
                0,
                null,
                0,
                0,
                PackageChoice(null, Blocked.NO_ACTIVE_PACKAGE),
            ),
        )
    }

    @Test
    fun `new refusals carry their own codes and statuses`() {
        assertEquals("no_active_package", Blocked.NO_ACTIVE_PACKAGE.wireValue)
        assertEquals("college_package_inactive", Blocked.NO_ACTIVE_PACKAGE.code)
        assertEquals(402, Blocked.NO_ACTIVE_PACKAGE.status.value())
        assertEquals("package_student_limit", Blocked.PACKAGE_STUDENT_LIMIT.wireValue)
        assertEquals(409, Blocked.PACKAGE_STUDENT_LIMIT.status.value())
    }

    @Test
    fun `current is the package the next interview comes from, else the spent one in its window`() {
        val sooner = pkg(id = 2, endsOn = "2026-11-30", used = 100)
        val later = pkg(id = 1, endsOn = "2027-05-31")
        assertEquals(later.id, CollegePackages.current(listOf(sooner, later), today, funding)?.id)
        assertEquals(sooner.id, CollegePackages.current(listOf(sooner), today, funding)?.id)
        assertNull(CollegePackages.current(listOf(pkg(endsOn = "2026-10-01")), today, funding))
    }

    // -- reminders --------------------------------------------------------------------------

    private val ending = pkg(endsOn = "2026-12-31")

    private fun due(
        on: String,
        sent: Set<PackageReminderKind> = emptySet(),
        superseded: Boolean = false,
        p: PackageUsage = ending,
    ) = CollegePackages.reminderDue(p, LocalDate.parse(on), sent, superseded)

    @Test
    fun `the 30-day reminder is due from 30 days before the end until 8 days before`() {
        assertNull(due("2026-11-30"))
        assertEquals(PackageReminderKind.ENDS_IN_30, due("2026-12-01"))
        assertEquals(PackageReminderKind.ENDS_IN_30, due("2026-12-23"))
        assertNull(due("2026-12-10", sent = setOf(PackageReminderKind.ENDS_IN_30)))
    }

    @Test
    fun `the 7-day reminder is due from 7 days before through the end date, never both at once`() {
        assertEquals(PackageReminderKind.ENDS_IN_7, due("2026-12-24"))
        assertEquals(PackageReminderKind.ENDS_IN_7, due("2026-12-31"))
        assertEquals(PackageReminderKind.ENDS_IN_7, due("2026-12-26", sent = setOf(PackageReminderKind.ENDS_IN_30)))
        assertNull(due("2026-12-26", sent = setOf(PackageReminderKind.ENDS_IN_7)))
        // After the end date, in grace: no more reminders.
        assertNull(due("2027-01-01"))
    }

    @Test
    fun `a later recorded package, or a package not issued, silences the reminders`() {
        assertNull(due("2026-12-24", superseded = true))
        assertNull(due("2026-12-24", p = ending.copy(status = PackageStatus.DRAFT)))
        assertNull(due("2026-12-24", p = ending.copy(status = PackageStatus.VOID)))

        val renewal = pkg(id = 9, status = PackageStatus.INVOICED, startsOn = "2027-01-01", endsOn = "2027-06-30")
        assertTrue(CollegePackages.superseded(ending, listOf(ending, renewal)))
        assertFalse(CollegePackages.superseded(ending, listOf(ending, renewal.copy(status = PackageStatus.DRAFT))))
        assertFalse(CollegePackages.superseded(renewal, listOf(ending, renewal)))
    }

    @Test
    fun `the next reminder date is the start of the next window, or today when one is due`() {
        fun next(
            on: String,
            sent: Set<PackageReminderKind> = emptySet(),
        ) = CollegePackages.nextReminderOn(ending, LocalDate.parse(on), sent, superseded = false)
        assertEquals(LocalDate.parse("2026-12-01"), next("2026-11-20"))
        assertEquals(LocalDate.parse("2026-12-05"), next("2026-12-05"))
        assertEquals(LocalDate.parse("2026-12-24"), next("2026-12-05", setOf(PackageReminderKind.ENDS_IN_30)))
        assertNull(next("2026-12-26", setOf(PackageReminderKind.ENDS_IN_30, PackageReminderKind.ENDS_IN_7)))
        assertNull(next("2027-01-02"))
        assertNull(CollegePackages.nextReminderOn(ending, LocalDate.parse("2026-11-20"), emptySet(), superseded = true))
    }

    @Test
    fun `the reminder email names counts and dates, never a price`() {
        val email = CampusEmailCopy.packageReminder("Demo College", ending.copy(used = 30), PackageReminderKind.ENDS_IN_30)
        assertEquals(CampusEmailCopy.CATEGORY_BILLING, email.category)
        assertEquals("campus-package-${ending.id}-ends_in_30", email.dedupeKey)
        assertTrue(email.subject.contains("31 December 2026"), email.subject)
        assertTrue(email.body.contains("Interviews remaining: 70 of 100"), email.body)
        assertTrue(email.body.contains("4"), email.body)
        assertTrue(email.body.contains("14 January 2027"), email.body)
        assertFalse(email.body.contains("₹") || email.body.contains("paise") || email.body.contains("INR"), email.body)
    }
}
