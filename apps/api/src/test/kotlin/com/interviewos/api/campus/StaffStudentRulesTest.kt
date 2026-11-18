package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

/** What a college reads beside one student's score (contract "Module 6", `StudentReadiness.staff`). */
class StaffStudentRulesTest {
    private val now = Instant.parse("2026-11-14T06:00:00Z")
    private val interviewId = UUID.fromString("0a000000-0000-0000-0000-0000000000a1")
    private val mcqId = UUID.fromString("0a000000-0000-0000-0000-0000000000a2")
    private val session = UUID.fromString("0a000000-0000-0000-0000-000000000051")
    private val attempt = UUID.fromString("0a000000-0000-0000-0000-000000000061")

    @Test
    fun `the reasons are the attention list's reasons, from the same facts`() {
        val facts = facts(ReadinessBand.NEEDS_STRUCTURED_PREP, overdue = 1, lastActiveAt = now.minus(Duration.ofDays(30)))

        val detail = StaffStudentRules.detail(facts, now)

        assertEquals(listOf("low_score", "inactive", "overdue"), detail.attention)
        assertEquals(AttentionRules.reasons(facts.result.band, facts.overdue, facts.student.lastActiveAt, now).map { it.wireValue }, detail.attention)
        assertEquals(now.minus(Duration.ofDays(30)).toString(), detail.lastActiveAt)
    }

    @Test
    fun `a student who needs nothing has no reasons, and a student with no activity has no date`() {
        val calm = StaffStudentRules.detail(facts(ReadinessBand.STRONG, overdue = 0, lastActiveAt = now.minus(Duration.ofDays(1))), now)
        assertEquals(emptyList(), calm.attention)

        val never = StaffStudentRules.detail(facts(ReadinessBand.STRONG, overdue = 0, lastActiveAt = null), now)
        assertNull(never.lastActiveAt)
        assertEquals(listOf("inactive"), never.attention)
    }

    @Test
    fun `assigned work keeps its order, status and the report or attempt staff may open`() {
        val work =
            listOf(
                AssignedWorkFact(interviewId, "Technical round", AssignmentKind.INTERVIEW, CompletionStatus.COMPLETED, now, session, null),
                AssignedWorkFact(mcqId, "Core CS test", AssignmentKind.MCQ_TEST, CompletionStatus.OVERDUE, now.plusSeconds(60), null, attempt),
            )

        val rows = StaffStudentRules.detail(facts(ReadinessBand.STRONG, 0, now, work), now).assignedWork

        assertEquals(listOf("Technical round", "Core CS test"), rows.map { it.title })
        assertEquals(listOf("interview", "mcq_test"), rows.map { it.kind })
        assertEquals(listOf("completed", "overdue"), rows.map { it.status })
        assertEquals(session, rows[0].sessionId)
        assertNull(rows[0].mcqAttemptId)
        assertNull(rows[1].sessionId)
        assertEquals(attempt, rows[1].mcqAttemptId)
    }

    private fun facts(
        band: ReadinessBand,
        overdue: Int,
        lastActiveAt: Instant?,
        work: List<AssignedWorkFact> = emptyList(),
    ) = StudentReadinessFacts(
        student =
            ReadinessStudentRow(
                memberId = UUID.randomUUID(),
                userId = UUID.randomUUID(),
                name = "Asha",
                rollNumber = null,
                batchId = UUID.randomUUID(),
                batchName = "CSE 2027",
                departmentId = UUID.randomUUID(),
                departmentCode = "CSE",
                lastActiveAt = lastActiveAt,
            ),
        result = ReadinessResult(null, band, emptyMap(), emptyList(), emptyList()),
        assigned = work.size,
        completed = 0,
        overdue = overdue,
        dueNow = 0,
        started = false,
        work = work,
    )
}
