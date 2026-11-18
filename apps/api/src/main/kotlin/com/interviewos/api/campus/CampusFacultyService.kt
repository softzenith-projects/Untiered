package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.util.UUID

/**
 * The faculty view (campus spec §8, contract "Module 8"): the "students needing attention" list
 * and private staff notes on a student.
 *
 * The attention list is read straight off [CampusReadinessService.compute] — the same students,
 * bands and overdue counts the dashboard shows — so it can never disagree with readiness. A
 * faculty member sees only the students of their batches, because the computation is scoped.
 *
 * Notes are staff-only: no student route reads them. Every write is audited, without the text.
 * Staff routes follow the campus order: resolve the [OrgScope] (404 when not staff there), check
 * the permission by name (403), then look things up (404 outside the college or scope), then
 * validate the body.
 */
@Service
class CampusFacultyService internal constructor(
    private val access: CampusAccess,
    private val readinessService: CampusReadinessService,
    private val readiness: ReadinessRepository,
    private val comments: StaffCommentRepository,
    private val audit: CampusAudit,
    private val clock: Clock,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        readinessService: CampusReadinessService,
        readiness: ReadinessRepository,
        comments: StaffCommentRepository,
        audit: CampusAudit,
    ) : this(access, readinessService, readiness, comments, audit, Clock.systemUTC())

    // -- students needing attention -------------------------------------------------------

    @Transactional
    fun attention(
        identity: SupabaseIdentity,
        orgId: UUID,
        reason: String?,
    ): List<AttentionRow> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.READINESS_VIEW)
        val only =
            reason?.trim()?.takeIf { it.isNotEmpty() }?.let {
                AttentionReason.fromWireValue(it)
                    ?: throw ApiException.badRequest("reason must be low_score, inactive or overdue.", code = "invalid_reason")
            }
        val students = readinessService.compute(scope, ReadinessFilter(), readiness.weights(scope))
        audit.recordPlatformAdminRead(scope, "attention.viewed", CampusOrgService.TARGET_ORG, orgId)
        val rows = AttentionRules.rows(students, clock.instant(), only)
        val noted = comments.membersWithNotes(scope, rows.map { it.memberId })
        return rows.map { it.copy(hasStaffNote = it.memberId in noted) }
    }

    // -- private staff notes --------------------------------------------------------------

    @Transactional(readOnly = true)
    fun comments(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
    ): List<StaffComment> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_NOTES)
        if (!comments.studentInScope(scope, memberId)) throw ApiException.notFound()
        return comments.list(scope, memberId).map { it.view(scope) }
    }

    @Transactional
    fun create(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        request: StaffCommentRequest?,
    ): StaffComment {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_NOTES)
        if (!comments.studentInScope(scope, memberId)) throw ApiException.notFound()
        val body = body(request?.body)
        // Only one of this student's assigned rounds; their own practice is never the college's.
        val sessionId = request?.sessionId
        if (sessionId != null && readiness.attemptSessionOwner(scope, memberId, sessionId) == null) throw ApiException.notFound()
        val id = comments.insert(scope, memberId, sessionId, body)
        audit.record(
            scope,
            "staff_comment.created",
            TARGET_COMMENT,
            id,
            mapOf("memberId" to memberId.toString(), "sessionId" to sessionId?.toString()),
        )
        return comments.find(scope, id)?.view(scope) ?: throw ApiException.notFound()
    }

    @Transactional
    fun update(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
        request: StaffCommentRequest?,
    ): StaffComment {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_NOTES)
        val current = comments.find(scope, id) ?: throw ApiException.notFound()
        if (current.authorMemberId == null || current.authorMemberId != scope.memberId) throw OrgScope.forbidden()
        val body = body(request?.body)
        if (body != current.body) {
            comments.updateBody(scope, id, body)
            audit.record(scope, "staff_comment.edited", TARGET_COMMENT, id, mapOf("memberId" to current.memberId.toString()))
        }
        return comments.find(scope, id)?.view(scope) ?: throw ApiException.notFound()
    }

    @Transactional
    fun delete(
        identity: SupabaseIdentity,
        orgId: UUID,
        id: UUID,
    ) {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_NOTES)
        val current = comments.find(scope, id) ?: throw ApiException.notFound()
        val mine = current.authorMemberId != null && current.authorMemberId == scope.memberId
        if (!mine && !scope.has(CampusPermission.STAFF_NOTES_MODERATE)) throw OrgScope.forbidden()
        if (comments.delete(scope, id)) {
            audit.record(
                scope,
                "staff_comment.deleted",
                TARGET_COMMENT,
                id,
                mapOf("memberId" to current.memberId.toString(), "byAuthor" to mine),
            )
        }
    }

    private fun StaffCommentRow.view(scope: OrgScope) =
        StaffComment(
            id = id,
            memberId = memberId,
            sessionId = sessionId,
            authorName = authorName,
            isMine = authorMemberId != null && authorMemberId == scope.memberId,
            body = body,
            createdAt = createdAt.toString(),
            editedAt = editedAt?.toString(),
        )

    companion object {
        const val TARGET_COMMENT = "staff_comment"
        const val MAX_BODY = 2000

        /** 1–2000 characters once trimmed; anything else is `400 invalid_comment`. */
        fun body(value: String?): String {
            val clean = value?.trim().orEmpty()
            if (clean.isEmpty()) throw ApiException.badRequest("Write a note before saving it.", code = "invalid_comment")
            if (clean.length > MAX_BODY) {
                throw ApiException.badRequest("Keep a note to $MAX_BODY characters.", code = "invalid_comment")
            }
            return clean
        }
    }
}
