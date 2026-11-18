package com.interviewos.api.campus

import java.time.Instant
import java.util.UUID

// Wire shapes for module 8 (docs/campus-api-contract.md, "Module 8: faculty view"). A change
// here changes that file in the same commit, because the web app is built against it.

data class AttentionRow(
    val memberId: UUID,
    val name: String?,
    val rollNumber: String?,
    val batchName: String,
    /** Contract `AttentionReason` values, in the order low_score, inactive, overdue. */
    val reasons: List<String>,
    val overall: Int?,
    val band: String,
    val overdue: Int,
    val lastActiveAt: String?,
    /** True when staff have kept at least one private note on this student. The note itself is not sent. */
    val hasStaffNote: Boolean = false,
)

data class StaffComment(
    val id: UUID,
    val memberId: UUID,
    val sessionId: UUID?,
    val authorName: String?,
    val isMine: Boolean,
    val body: String,
    val createdAt: String,
    val editedAt: String?,
)

/** `POST …/comments` and `PATCH …/comments/{id}` (the latter reads only `body`). */
data class StaffCommentRequest(
    val body: String? = null,
    val sessionId: UUID? = null,
)

/** Why a student is on the "needs attention" list. */
enum class AttentionReason(
    val wireValue: String,
) {
    /** Readiness band is `needs_structured_prep`. */
    LOW_SCORE("low_score"),

    /** No activity (module 3's signals) in the last 14 days, or none at all. */
    INACTIVE("inactive"),

    /** At least one published assignment is overdue. */
    OVERDUE("overdue"),
    ;

    companion object {
        fun fromWireValue(value: String?): AttentionReason? = entries.firstOrNull { it.wireValue == value }
    }
}

/**
 * Who needs attention, and in what order (contract "Module 8"). Pure, so the rules are tested
 * without a database; the inputs come from [CampusReadinessService.compute], never recomputed.
 */
internal object AttentionRules {
    fun reasons(
        band: ReadinessBand,
        overdue: Int,
        lastActiveAt: Instant?,
        now: Instant,
    ): List<AttentionReason> {
        val activeSince = now.minus(CampusReadinessService.ACTIVE_WINDOW)
        return listOfNotNull(
            AttentionReason.LOW_SCORE.takeIf { band == ReadinessBand.NEEDS_STRUCTURED_PREP },
            AttentionReason.INACTIVE.takeIf { lastActiveAt == null || !lastActiveAt.isAfter(activeSince) },
            AttentionReason.OVERDUE.takeIf { overdue > 0 },
        )
    }

    /**
     * Every student with at least one reason, narrowed to [only] when given: most reasons first,
     * then the lowest overall score (a student with no score after every scored one), then name
     * and member id so the order is stable.
     */
    fun rows(
        students: List<StudentReadinessFacts>,
        now: Instant,
        only: AttentionReason?,
    ): List<AttentionRow> =
        students
            .mapNotNull { facts ->
                val reasons = reasons(facts.result.band, facts.overdue, facts.student.lastActiveAt, now)
                if (reasons.isEmpty() || (only != null && only !in reasons)) return@mapNotNull null
                AttentionRow(
                    memberId = facts.student.memberId,
                    name = facts.student.name,
                    rollNumber = facts.student.rollNumber,
                    batchName = facts.student.batchName,
                    reasons = reasons.map { it.wireValue },
                    overall = facts.result.overall,
                    band = facts.result.band.wireValue,
                    overdue = facts.overdue,
                    lastActiveAt = facts.student.lastActiveAt?.toString(),
                )
            }.sortedWith(ORDER)

    val ORDER: Comparator<AttentionRow> =
        compareByDescending<AttentionRow> { it.reasons.size }
            .thenBy(nullsLast()) { it.overall }
            .thenBy(nullsLast()) { it.name?.lowercase() }
            .thenBy { it.memberId }
}
