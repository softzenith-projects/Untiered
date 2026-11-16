package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional

/**
 * The caller's own campus context (`/me/campus`): which college they study at, and which
 * they work for. Looked up by the verified user id only. A suspended college is left out, as
 * if it were not there.
 */
@Service
class MeCampusService(
    private val access: CampusAccess,
    private val members: MemberRepository,
    private val audit: CampusAudit,
    private val logos: OrgLogos,
) {
    @Transactional(readOnly = true)
    fun me(identity: SupabaseIdentity): MeCampusView {
        val student =
            members.ownStudentMembership(identity.id)?.let {
                MeCampusStudent(it.orgId, it.orgName, logos.publicUrl(it.logoPath), it.batchId, it.batchName, it.rollNumber)
            }
        val staff =
            members.ownStaffMemberships(identity.id).map {
                MeCampusStaff(it.orgId, it.orgName, logos.publicUrl(it.logoPath), it.role)
            }
        return MeCampusView(student, staff)
    }

    /** A student leaving their college. Their account and history stay theirs. */
    @Transactional
    fun leave(identity: SupabaseIdentity) {
        val scope = access.resolveOwnStudentMembership(identity) ?: throw ApiException.notFound()
        scope.require(CampusPermission.OWN_MEMBERSHIP)
        if (!members.leave(scope)) throw ApiException.notFound()
        audit.record(scope, "member.left", CampusOrgService.TARGET_MEMBER, scope.memberId)
    }
}
