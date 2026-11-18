package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.interview.AnswerTiming
import com.interviewos.api.interview.SessionRepository
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * Interview integrity signals (campus spec §5, contract "Module 5").
 *
 * Recorded only for rounds started from an assignment, which the student was told about on
 * the start screen before consenting. A personal round's events are accepted and dropped — the
 * same `204`, so the room needs no knowledge of the rule to be safe — and nothing about a
 * personal round is ever stored. While the campus switch is off, nothing is stored at all.
 *
 * The summary is the same for the student and their college, and is read by nothing else:
 * readiness (module 6) never sees it, and no score moves because of it.
 */
@Service
class IntegrityService(
    private val sessions: SessionRepository,
    private val integrity: IntegrityRepository,
    private val readiness: ReadinessRepository,
    private val access: CampusAccess,
    private val audit: CampusAudit,
    private val features: ProductFeatureProperties,
    private val objectMapper: ObjectMapper,
) {
    /** `POST /sessions/{id}/integrity-events`. Someone else's session is a 404. */
    fun record(
        userId: UUID,
        sessionId: UUID,
        batch: IntegrityEventBatch?,
    ) {
        if (!features.campus) return
        sessions.findSession(sessionId, userId) ?: throw ApiException.notFound()
        val increments = IntegrityRules.tally(batch)
        if (increments.isEmpty) return
        // The write itself refuses a session with no assignment attempt; a personal round is a no-op.
        integrity.increment(sessionId, userId, increments)
    }

    /** `GET /sessions/{id}/integrity`: the student sees exactly what their college sees. */
    fun mine(
        userId: UUID,
        sessionId: UUID,
    ): IntegritySummary {
        sessions.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (!features.campus) return IntegritySummary.NOT_RECORDED
        return summaryOf(sessionId, userId)
    }

    /**
     * The staff view, behind the same check as the staff report view: the session must belong to
     * an attempt of this member at one of this college's assignments, inside a faculty member's
     * batches; anything else is a 404. Audited as `integrity.viewed`.
     */
    fun staff(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        sessionId: UUID,
    ): IntegritySummary {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENT_REPORT_VIEW)
        val ownerUserId = readiness.attemptSessionOwner(scope, memberId, sessionId) ?: throw ApiException.notFound()
        val summary = summaryOf(sessionId, ownerUserId)
        audit.record(
            scope,
            "integrity.viewed",
            CampusReadinessService.TARGET_SESSION,
            sessionId,
            mapOf("memberId" to memberId.toString()),
        )
        return summary
    }

    /**
     * The counts of every assigned round of one student, added together, for the student's page.
     * Behind the same check as the staff report view; a student outside the college or a faculty
     * member's batches is a 404, and a personal round is never counted. Audited as
     * `integrity_totals.viewed`.
     */
    fun studentTotals(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
    ): StudentIntegrityTotals {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENT_REPORT_VIEW)
        if (!readiness.studentInScope(scope, memberId)) throw ApiException.notFound()
        val rounds =
            readiness.attemptSessions(scope, memberId).map { round ->
                val timings = integrity.answerTimings(round.sessionId, round.userId).mapNotNull { AnswerTiming.parse(it, objectMapper) }
                integrity.counts(round.sessionId, round.userId) to IntegrityRules.timingSignals(timings)
            }
        audit.record(scope, "integrity_totals.viewed", CampusOrgService.TARGET_MEMBER, memberId)
        return IntegrityRules.totals(rounds)
    }

    private fun summaryOf(
        sessionId: UUID,
        ownerUserId: UUID,
    ): IntegritySummary {
        if (!integrity.isAssigned(sessionId, ownerUserId)) return IntegritySummary.NOT_RECORDED
        val timings = integrity.answerTimings(sessionId, ownerUserId).mapNotNull { AnswerTiming.parse(it, objectMapper) }
        return IntegrityRules.summary(integrity.counts(sessionId, ownerUserId), IntegrityRules.timingSignals(timings))
    }
}
