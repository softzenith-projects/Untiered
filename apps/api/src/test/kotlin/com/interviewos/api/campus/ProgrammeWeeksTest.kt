package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Instant
import java.time.LocalDate
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** The week-by-week view of a programme (contract "Module 10"): unlock dates and per-week completion. */
class ProgrammeWeeksTest {
    private val programme = UUID.randomUUID()
    private val startsOn = LocalDate.of(2026, 11, 2)

    // Week 3 opens Mon 16 Nov 09:00 IST (03:30 UTC).
    private val duringWeekThree = Instant.parse("2026-11-18T06:00:00Z")
    private val beforeWeekOne = Instant.parse("2026-11-01T06:00:00Z")

    private fun module(
        week: Int,
        title: String,
        kind: AssignmentKind = AssignmentKind.INTERVIEW,
    ) = ProgrammeAssignmentRow(UUID.randomUUID(), programme, week, kind, title)

    private fun fact(
        module: ProgrammeAssignmentRow,
        member: UUID,
        completed: Boolean,
    ) = RecipientFacts(
        assignmentId = module.id,
        memberId = member,
        userId = UUID.randomUUID(),
        name = null,
        email = "x@college.edu",
        rollNumber = null,
        batchId = UUID.randomUUID(),
        batchName = "CSE 2027",
        attemptsUsed = 0,
        orgFundedUsed = 0,
        attemptCompleted = completed,
        attemptInProgress = false,
        sessionIds = emptyList(),
        completedSessionIds = emptyList(),
        stepsAnswered = 0,
        stepsCorrect = 0,
        stepsTotal = 0,
        lastActivityAt = null,
    )

    @Test
    fun `each week unlocks at 9 am India time seven days after the last, and is due a week later`() {
        val modules = listOf(module(1, "Aptitude"), module(2, "Core CS"), module(3, "Interview"), module(4, "Arena"))

        val rows = ProgrammeWeeks.rows(startsOn, modules, emptyList(), duringWeekThree)

        assertEquals(listOf(1, 2, 3, 4), rows.map { it.week })
        assertEquals("2026-11-02T03:30:00Z", rows[0].opensAt)
        assertEquals("2026-11-09T03:30:00Z", rows[1].opensAt)
        assertEquals("2026-11-16T03:30:00Z", rows[2].opensAt)
        assertEquals("2026-11-23T03:30:00Z", rows[2].dueAt)
        assertEquals(listOf(true, true, true, false), rows.map { it.opened })
    }

    @Test
    fun `completion is students who finished every assignment of the week over students it was set for`() {
        val first = module(3, "Technical round")
        val second = module(3, "Arena set", AssignmentKind.ARENA_SCENARIOS)
        val asha = UUID.randomUUID()
        val bilal = UUID.randomUUID()
        val chetan = UUID.randomUUID()
        val facts =
            listOf(
                fact(first, asha, completed = true),
                fact(second, asha, completed = true),
                fact(first, bilal, completed = true),
                fact(second, bilal, completed = false),
                fact(first, chetan, completed = false),
                fact(second, chetan, completed = false),
            ).map { if (it.assignmentId == second.id) it.copy(stepsTotal = 2, stepsAnswered = if (it.memberId == asha) 2 else 0) else it }

        val week = ProgrammeWeeks.rows(startsOn, listOf(first, second), facts, duringWeekThree).single()

        assertEquals(3, week.students)
        assertEquals(1, week.completedStudents)
        assertEquals(1.0 / 3, week.completionRate)
        assertEquals(listOf("Technical round", "Arena set"), week.assignments.map { it.title })
    }

    @Test
    fun `a locked week reports no completion, and a week nobody is set has none to report`() {
        val early = module(1, "Aptitude")
        val rows = ProgrammeWeeks.rows(startsOn, listOf(early), listOf(fact(early, UUID.randomUUID(), completed = true)), beforeWeekOne)
        assertEquals(false, rows.single().opened)
        assertNull(rows.single().completionRate)
        assertEquals(1, rows.single().completedStudents)

        val empty = ProgrammeWeeks.rows(startsOn, listOf(early), emptyList(), duringWeekThree).single()
        assertEquals(0, empty.students)
        assertNull(empty.completionRate)
    }

    @Test
    fun `only weeks that have an assignment are listed, in order`() {
        val rows = ProgrammeWeeks.rows(startsOn, listOf(module(4, "D"), module(1, "A")), emptyList(), duringWeekThree)
        assertEquals(listOf(1, 4), rows.map { it.week })
    }
}
