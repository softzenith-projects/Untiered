package com.interviewos.api.campus

import com.interviewos.api.campus.AssignmentGate.Blocked
import com.interviewos.api.interview.RoundType
import org.junit.jupiter.api.Test
import org.springframework.http.HttpStatus
import java.time.Duration
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * The one decision behind `canStart` / `blockedReason` and admission (contract "Admission").
 * Each refusal, the order they are checked in, and the boundaries of each cap.
 */
class AssignmentGateTest {
    private val now = Instant.parse("2026-11-20T10:00:00Z")
    private val opens = now.minus(Duration.ofDays(1))
    private val due = now.plus(Duration.ofDays(1))

    private fun gate(
        kind: AssignmentKind = AssignmentKind.INTERVIEW,
        at: Instant = now,
        opensAt: Instant = opens,
        dueAt: Instant = due,
        allowLate: Boolean = false,
        attemptsUsed: Int = 0,
        attemptLimit: Int = 3,
        orgFundedUsed: Int = 0,
        interviewCap: Int? = null,
        collegeUsed: Int = 0,
        collegeAllowance: Int = 100,
    ): Blocked? =
        AssignmentGate.evaluate(
            kind,
            at,
            opensAt,
            dueAt,
            allowLate,
            attemptsUsed,
            attemptLimit,
            orgFundedUsed,
            interviewCap,
            collegeUsed,
            collegeAllowance,
        )

    @Test
    fun `an open assignment with room everywhere may be started`() {
        assertNull(gate())
    }

    @Test
    fun `not open until opensAt, inclusive of the instant itself`() {
        assertEquals(Blocked.NOT_OPEN, gate(opensAt = now.plusSeconds(1)))
        assertNull(gate(opensAt = now))
    }

    @Test
    fun `past due at dueAt itself unless late attempts are allowed`() {
        assertEquals(Blocked.PAST_DUE, gate(dueAt = now))
        assertEquals(Blocked.PAST_DUE, gate(dueAt = now.minusSeconds(1)))
        assertNull(gate(dueAt = now.plusSeconds(1)))
        assertNull(gate(dueAt = now.minus(Duration.ofDays(3)), opensAt = now.minus(Duration.ofDays(5)), allowLate = true))
    }

    @Test
    fun `attempts not handed back are counted against the attempt limit`() {
        assertNull(gate(attemptsUsed = 2, attemptLimit = 3, orgFundedUsed = 2))
        assertEquals(Blocked.ATTEMPT_LIMIT, gate(attemptsUsed = 3, attemptLimit = 3, orgFundedUsed = 3))
    }

    @Test
    fun `the per-student cap is the attempt limit when it is not set`() {
        assertEquals(Blocked.STUDENT_CAP, gate(attemptsUsed = 1, attemptLimit = 3, orgFundedUsed = 1, interviewCap = 1))
        assertNull(gate(attemptsUsed = 1, attemptLimit = 3, orgFundedUsed = 1, interviewCap = 2))
        // No cap: the limit decides, and the limit is checked first.
        assertEquals(Blocked.ATTEMPT_LIMIT, gate(attemptsUsed = 3, attemptLimit = 3, orgFundedUsed = 3, interviewCap = null))
    }

    @Test
    fun `the college's allowance is spent at its last unit`() {
        assertNull(gate(collegeUsed = 99, collegeAllowance = 100))
        assertEquals(Blocked.COLLEGE_ALLOWANCE, gate(collegeUsed = 100, collegeAllowance = 100))
        assertEquals(Blocked.COLLEGE_ALLOWANCE, gate(collegeUsed = 0, collegeAllowance = 0))
        // An allowance lowered below what has been used still refuses rather than going negative.
        assertEquals(Blocked.COLLEGE_ALLOWANCE, gate(collegeUsed = 12, collegeAllowance = 5))
    }

    @Test
    fun `the checks run in the contract's order`() {
        // Not open beats every other refusal.
        assertEquals(
            Blocked.NOT_OPEN,
            gate(
                opensAt = now.plusSeconds(60),
                dueAt = now.plusSeconds(120),
                attemptsUsed = 9,
                attemptLimit = 1,
                orgFundedUsed = 9,
                interviewCap = 1,
                collegeUsed = 9,
                collegeAllowance = 0,
            ),
        )
        assertEquals(
            Blocked.PAST_DUE,
            gate(dueAt = now, attemptsUsed = 9, attemptLimit = 1, orgFundedUsed = 9, interviewCap = 1, collegeAllowance = 0),
        )
        assertEquals(
            Blocked.ATTEMPT_LIMIT,
            gate(attemptsUsed = 1, attemptLimit = 1, orgFundedUsed = 1, interviewCap = 1, collegeAllowance = 0),
        )
        assertEquals(
            Blocked.STUDENT_CAP,
            gate(attemptsUsed = 1, attemptLimit = 2, orgFundedUsed = 1, interviewCap = 1, collegeAllowance = 0),
        )
        assertEquals(Blocked.COLLEGE_ALLOWANCE, gate(attemptsUsed = 1, attemptLimit = 2, orgFundedUsed = 1, collegeAllowance = 0))
    }

    @Test
    fun `a scenario set is refused only for its dates, and never costs the college`() {
        assertNull(gate(kind = AssignmentKind.ARENA_SCENARIOS, attemptsUsed = 5, attemptLimit = 1, collegeAllowance = 0))
        assertEquals(Blocked.NOT_OPEN, gate(kind = AssignmentKind.ARENA_SCENARIOS, opensAt = now.plusSeconds(1)))
        assertEquals(Blocked.PAST_DUE, gate(kind = AssignmentKind.ARENA_SCENARIOS, dueAt = now))
    }

    @Test
    fun `an MCQ test is refused for its dates and its attempt limit, never for the cap or the allowance`() {
        val mcq = AssignmentKind.MCQ_TEST
        assertNull(gate(kind = mcq, attemptsUsed = 1, attemptLimit = 2, orgFundedUsed = 9, interviewCap = 1, collegeAllowance = 0))
        assertEquals(Blocked.ATTEMPT_LIMIT, gate(kind = mcq, attemptsUsed = 2, attemptLimit = 2))
        assertEquals(Blocked.NOT_OPEN, gate(kind = mcq, opensAt = now.plusSeconds(1)))
        assertEquals(Blocked.PAST_DUE, gate(kind = mcq, dueAt = now))
        assertEquals("coding", AssignmentRules.defaultComponent(mcq, null, listOf("dsa")))
        assertEquals("core_cs", AssignmentRules.defaultComponent(mcq, null, listOf("dsa", "java")))
    }

    @Test
    fun `refusals carry the contract's codes and statuses`() {
        assertEquals("assignment_not_open" to HttpStatus.CONFLICT, Blocked.NOT_OPEN.toException().let { it.code to it.status })
        assertEquals("assignment_past_due" to HttpStatus.CONFLICT, Blocked.PAST_DUE.toException().let { it.code to it.status })
        assertEquals(
            "assignment_attempt_limit" to HttpStatus.CONFLICT,
            Blocked.ATTEMPT_LIMIT.toException().let { it.code to it.status },
        )
        assertEquals("assignment_student_cap" to HttpStatus.CONFLICT, Blocked.STUDENT_CAP.toException().let { it.code to it.status })
        assertEquals(
            "college_allowance_exhausted" to HttpStatus.PAYMENT_REQUIRED,
            Blocked.COLLEGE_ALLOWANCE.toException().let { it.code to it.status },
        )
        assertEquals(
            listOf(
                "not_open",
                "past_due",
                "attempt_limit",
                "student_cap",
                "college_allowance",
                "no_active_package",
                "package_student_limit",
            ),
            Blocked.entries.map { it.wireValue },
        )
    }

    // -- completion and defaults --------------------------------------------------------

    @Test
    fun `completion is completed, then overdue, then in progress, then not started`() {
        fun status(
            completed: Boolean,
            inProgress: Boolean,
            dueAt: Instant = due,
            allowLate: Boolean = false,
        ) = AssignmentRules.completion(completed, inProgress, dueAt, allowLate, now)

        assertEquals(CompletionStatus.COMPLETED, status(completed = true, inProgress = true, dueAt = now.minusSeconds(1)))
        assertEquals(CompletionStatus.OVERDUE, status(completed = false, inProgress = true, dueAt = now))
        assertEquals(CompletionStatus.OVERDUE, status(completed = false, inProgress = false, dueAt = now.minusSeconds(1)))
        assertEquals(
            CompletionStatus.IN_PROGRESS,
            status(completed = false, inProgress = true, dueAt = now.minusSeconds(1), allowLate = true),
        )
        assertEquals(CompletionStatus.IN_PROGRESS, status(completed = false, inProgress = true))
        assertEquals(CompletionStatus.NOT_STARTED, status(completed = false, inProgress = false))
        assertEquals(
            CompletionStatus.NOT_STARTED,
            status(completed = false, inProgress = false, dueAt = now.minusSeconds(1), allowLate = true),
        )
    }

    @Test
    fun `the readiness component defaults from the round type, as the web derives it`() {
        val expected =
            mapOf(
                RoundType.CODING_PRACTICAL to "coding",
                RoundType.APTITUDE to "aptitude",
                RoundType.HR_FIT_CLOSING to "communication",
                RoundType.BEHAVIOURAL_COMPETENCY to "communication",
                RoundType.TECHNICAL_FUNDAMENTALS to "technical_interview",
                RoundType.PROJECT_DEEP_DIVE to "technical_interview",
                RoundType.CUSTOM_TOPIC to "core_cs",
            )
        assertEquals(expected.keys.toList(), AssignmentRules.ASSIGNABLE_ROUND_TYPES.sortedBy { expected.keys.indexOf(it) })
        for ((roundType, component) in expected) {
            assertEquals(component, AssignmentRules.defaultComponent(AssignmentKind.INTERVIEW, roundType), roundType.dbValue)
        }
        assertEquals("coding", AssignmentRules.defaultComponent(AssignmentKind.ARENA_SCENARIOS, null, listOf("dsa", "dsa")))
        assertEquals("core_cs", AssignmentRules.defaultComponent(AssignmentKind.ARENA_SCENARIOS, null, listOf("dsa", "system-design")))
        assertEquals("core_cs", AssignmentRules.defaultComponent(AssignmentKind.ARENA_SCENARIOS, null, emptyList()))
    }
}
