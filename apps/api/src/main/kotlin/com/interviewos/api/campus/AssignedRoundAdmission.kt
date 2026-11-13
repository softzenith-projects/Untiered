package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Component
import java.time.Clock
import java.util.UUID

/**
 * The round a college assigned, as `POST /sessions` takes it instead of the client's values
 * (contract "Student": round type, length, company, role, stage, language and focus topic).
 */
data class AssignedRound(
    val assignmentId: UUID,
    val roundType: String,
    val durationMinutes: Int,
    /** Null or blank means general practice, exactly as an empty company does on a personal round. */
    val companyName: String?,
    val roleTitle: String?,
    val candidateStage: String,
    val language: String,
    val focusTopic: String?,
)

/**
 * Admitting an interview started from an assignment, which the college pays for (contract
 * "Admission", plan §4 "Cap enforcement").
 *
 * [InterviewService][com.interviewos.api.interview.InterviewService] calls [roundFor] before
 * its admission transaction, to take the round's configuration, and [admit] inside it. Inside,
 * the organisation row is locked first, so every assigned start in one college queues behind
 * the one before it and reads its attempt; the caps are then checked by [AssignmentGate], the
 * session is inserted, and the attempt is written with `org_funded = true`. The student's free
 * rounds and credits are never touched on this path: no `practice_usage` row, no charge.
 *
 * Every refusal for "this is not your assignment" — no joined student membership, a suspended
 * college, an assignment of another college, one not targeted at the student, not published,
 * or a scenario set — is the same `404 assignment_not_found`, so the answer never confirms
 * that somebody else's assignment exists.
 */
@Component
class AssignedRoundAdmission internal constructor(
    private val access: CampusAccess,
    private val assignments: AssignmentRepository,
    private val features: ProductFeatureProperties,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        assignments: AssignmentRepository,
        features: ProductFeatureProperties,
    ) : this(access, assignments, features, Clock.systemUTC())

    /** The assigned round's configuration, or `404 assignment_not_found`. Read-only. */
    fun roundFor(
        identity: SupabaseIdentity,
        assignmentId: UUID,
    ): AssignedRound = load(identity, assignmentId).second.toRound()

    /**
     * Must run inside the caller's admission transaction: the organisation lock taken here is
     * held until it commits, and [insertSession] must write in that same transaction. Returns
     * the session id [insertSession] returned.
     */
    fun admit(
        identity: SupabaseIdentity,
        assignmentId: UUID,
        insertSession: () -> UUID,
    ): UUID {
        // 1. The assignment and the student's joined membership, scoped to the student's college.
        val (scope, row) = load(identity, assignmentId)
        val memberId = checkNotNull(scope.memberId)
        // 2. Serialise every assigned start in this college until the transaction ends.
        val allowance = assignments.lockOrgForAdmission(scope) ?: throw notFound()
        // 3. The caps, in the contract's order.
        val counts = assignments.admissionCounts(scope, row.id, memberId)
        AssignmentGate
            .evaluate(
                kind = row.kind,
                now = clock.instant(),
                opensAt = row.opensAt,
                dueAt = row.dueAt,
                allowLate = row.allowLate,
                attemptsUsed = counts.attemptsUsed,
                attemptLimit = row.attemptLimit,
                orgFundedUsed = counts.orgFundedUsed,
                interviewCap = row.interviewCap,
                collegeUsed = counts.collegeUsed,
                collegeAllowance = allowance,
            )?.let { throw it.toException() }
        // 4. The session, then the attempt that the college pays for.
        val sessionId = insertSession()
        assignments.insertAttempt(scope, row.id, memberId, sessionId)
        return sessionId
    }

    private fun load(
        identity: SupabaseIdentity,
        assignmentId: UUID,
    ): Pair<OrgScope, AssignmentRow> {
        if (!features.campus) throw notFound()
        val scope = access.resolveOwnStudentMembership(identity) ?: throw notFound()
        scope.require(CampusPermission.OWN_MEMBERSHIP)
        if (assignments.activeOrg(scope) == null) throw notFound()
        val row =
            assignments
                .publishedFor(scope, checkNotNull(scope.memberId), assignmentId)
                .singleOrNull()
                ?.takeIf { it.kind == AssignmentKind.INTERVIEW }
                ?: throw notFound()
        return scope to row
    }

    private fun AssignmentRow.toRound(): AssignedRound =
        AssignedRound(
            assignmentId = id,
            roundType = checkNotNull(roundType) { "An interview assignment has a round type" },
            durationMinutes = checkNotNull(durationMinutes) { "An interview assignment has a length" },
            companyName = companyName,
            roleTitle = roleTitle,
            candidateStage = candidateStage ?: "student",
            language = language,
            focusTopic = focusTopic,
        )

    companion object {
        fun notFound() =
            ApiException(
                HttpStatus.NOT_FOUND,
                "assignment_not_found",
                "That assignment is not available to you. It may have been archived, or it is not one of yours.",
            )
    }
}
