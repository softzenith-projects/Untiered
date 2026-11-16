package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals

/** Who is on the "students needing attention" list, and in what order (contract "Module 8"). */
class AttentionRulesTest {
    private val now = Instant.parse("2026-11-14T06:00:00Z")
    private val recently = now.minus(Duration.ofDays(2))
    private val longAgo = now.minus(Duration.ofDays(20))

    @Test
    fun `each reason comes from one readiness fact`() {
        assertEquals(
            listOf(AttentionReason.LOW_SCORE),
            AttentionRules.reasons(ReadinessBand.NEEDS_STRUCTURED_PREP, overdue = 0, lastActiveAt = recently, now = now),
        )
        assertEquals(
            listOf(AttentionReason.INACTIVE),
            AttentionRules.reasons(ReadinessBand.STRONG, overdue = 0, lastActiveAt = longAgo, now = now),
        )
        assertEquals(
            listOf(AttentionReason.OVERDUE),
            AttentionRules.reasons(ReadinessBand.NEEDS_IMPROVEMENT, overdue = 1, lastActiveAt = recently, now = now),
        )
        assertEquals(
            listOf(AttentionReason.LOW_SCORE, AttentionReason.INACTIVE, AttentionReason.OVERDUE),
            AttentionRules.reasons(ReadinessBand.NEEDS_STRUCTURED_PREP, overdue = 3, lastActiveAt = null, now = now),
        )
        assertEquals(emptyList(), AttentionRules.reasons(ReadinessBand.INTERVIEW_READY, overdue = 0, lastActiveAt = recently, now = now))
    }

    @Test
    fun `needs improvement and not enough evidence are not a low score`() {
        for (band in listOf(ReadinessBand.NEEDS_IMPROVEMENT, ReadinessBand.NOT_ENOUGH_EVIDENCE)) {
            assertEquals(emptyList(), AttentionRules.reasons(band, overdue = 0, lastActiveAt = recently, now = now), band.name)
        }
    }

    @Test
    fun `inactive means no activity in the last 14 days, or none ever`() {
        val edge = now.minus(Duration.ofDays(14))
        assertEquals(listOf(AttentionReason.INACTIVE), AttentionRules.reasons(ReadinessBand.STRONG, 0, edge, now))
        assertEquals(emptyList(), AttentionRules.reasons(ReadinessBand.STRONG, 0, edge.plusSeconds(1), now))
        assertEquals(listOf(AttentionReason.INACTIVE), AttentionRules.reasons(ReadinessBand.STRONG, 0, null, now))
    }

    @Test
    fun `rows are ordered by number of reasons, then overall ascending with no score last, then name`() {
        val students =
            listOf(
                facts("Zoya", ReadinessBand.NEEDS_IMPROVEMENT, overall = 60, overdue = 1, lastActiveAt = recently),
                facts("Arjun", ReadinessBand.NEEDS_STRUCTURED_PREP, overall = 30, overdue = 2, lastActiveAt = longAgo),
                facts("Bina", ReadinessBand.NOT_ENOUGH_EVIDENCE, overall = null, overdue = 1, lastActiveAt = recently),
                facts("Chetan", ReadinessBand.NEEDS_STRUCTURED_PREP, overall = 40, overdue = 0, lastActiveAt = recently),
                facts("Dev", ReadinessBand.STRONG, overall = 90, overdue = 0, lastActiveAt = recently),
                facts("Esha", ReadinessBand.NEEDS_IMPROVEMENT, overall = 55, overdue = 0, lastActiveAt = null),
            )

        val rows = AttentionRules.rows(students, now, only = null)

        assertEquals(listOf("Arjun", "Chetan", "Esha", "Zoya", "Bina"), rows.map { it.name })
        assertEquals(listOf("low_score", "inactive", "overdue"), rows.first().reasons)
        assertEquals(2, rows.first().overdue)
    }

    @Test
    fun `a reason filter keeps only the students with that reason`() {
        val students =
            listOf(
                facts("Arjun", ReadinessBand.NEEDS_STRUCTURED_PREP, overall = 30, overdue = 2, lastActiveAt = recently),
                facts("Bina", ReadinessBand.STRONG, overall = 88, overdue = 0, lastActiveAt = longAgo),
                facts("Chetan", ReadinessBand.NEEDS_IMPROVEMENT, overall = 61, overdue = 1, lastActiveAt = recently),
            )

        assertEquals(listOf("Arjun", "Chetan"), AttentionRules.rows(students, now, AttentionReason.OVERDUE).map { it.name })
        assertEquals(listOf("Bina"), AttentionRules.rows(students, now, AttentionReason.INACTIVE).map { it.name })
        assertEquals(listOf("Arjun"), AttentionRules.rows(students, now, AttentionReason.LOW_SCORE).map { it.name })
    }

    @Test
    fun `reason values round-trip`() {
        assertEquals(listOf("low_score", "inactive", "overdue"), AttentionReason.entries.map { it.wireValue })
        for (reason in AttentionReason.entries) assertEquals(reason, AttentionReason.fromWireValue(reason.wireValue))
        assertEquals(null, AttentionReason.fromWireValue("LOW_SCORE"))
    }

    private fun facts(
        name: String,
        band: ReadinessBand,
        overall: Int?,
        overdue: Int,
        lastActiveAt: Instant?,
    ) = StudentReadinessFacts(
        student =
            ReadinessStudentRow(
                memberId = UUID.randomUUID(),
                userId = UUID.randomUUID(),
                name = name,
                rollNumber = null,
                batchId = BATCH,
                batchName = "CSE 2027",
                departmentId = DEPARTMENT,
                departmentCode = "CSE",
                lastActiveAt = lastActiveAt,
            ),
        result = ReadinessResult(overall, band, emptyMap(), emptyList(), emptyList()),
        assigned = overdue,
        completed = 0,
        overdue = overdue,
        dueNow = 0,
        started = false,
    )

    private companion object {
        val BATCH: UUID = UUID.randomUUID()
        val DEPARTMENT: UUID = UUID.randomUUID()
    }
}
