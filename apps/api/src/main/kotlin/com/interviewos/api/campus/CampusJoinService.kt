package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Locale

/**
 * Joining a college from an invite link (campus spec §3, plan §5). Any signed-in account
 * may open a link; accepting it links **that** account — the one in the verified token —
 * whatever email the invite went to, after an explicit confirmation when they differ. No
 * account is ever created or looked up by email here.
 */
@Service
class CampusJoinService(
    private val invites: InviteRepository,
    private val access: CampusAccess,
    private val audit: CampusAudit,
    private val users: UserRepository,
    private val me: MeCampusService,
    private val logos: OrgLogos,
    private val notifications: CampusNotifications,
) {
    @Transactional(readOnly = true)
    fun preview(
        identity: SupabaseIdentity,
        token: String,
    ): InvitePreview {
        val invite = openInvite(token, lock = false)
        val signedIn = normalised(identity.email)
        return InvitePreview(
            orgName = invite.orgName,
            logoUrl = logos.publicUrl(invite.logoPath),
            role = invite.role.dbValue,
            batchName = invite.batchName,
            invitedEmailMasked = maskEmail(invite.email),
            signedInEmail = signedIn,
            emailMatches = signedIn == invite.email,
            expiresAt = invite.expiresAt.toString(),
            consentVersion = CONSENT_VERSION,
            shared = if (invite.role == CampusRole.STUDENT) SHARED else STAFF_SHARED,
            notShared = NOT_SHARED,
            aiNotice = AI_NOTICE,
        )
    }

    /**
     * One transaction, with the invite's row lock held throughout: two accepts of the same link
     * are serialised, and the second finds it joined (404). Each refusal leaves nothing behind.
     */
    @Transactional
    fun accept(
        identity: SupabaseIdentity,
        token: String,
        request: AcceptInviteRequest,
    ): AcceptInviteResult {
        // The membership references public.users; the caller may never have loaded /me.
        users.provision(identity)
        val invite = openInvite(token, lock = true)
        val student = invite.role == CampusRole.STUDENT
        if (student) {
            if (request.agreeDataSharing != true || request.agreeAiEvaluation != true || request.consentVersion.isNullOrBlank()) {
                throw ApiException.badRequest("Agree to both statements to join as a student.", code = "consent_required")
            }
            if (request.consentVersion != CONSENT_VERSION) {
                throw ApiException.conflict("What you agreed to has changed. Reload and read it again.", code = "consent_version_stale")
            }
        }
        if (normalised(identity.email) != invite.email && request.confirmDifferentEmail != true) {
            throw ApiException.conflict(
                "This invite was sent to a different email. Confirm that you want to join with this account.",
                code = "email_mismatch_unconfirmed",
            )
        }
        if (invites.isJoinedIn(invite.orgId, identity.id)) {
            throw ApiException.conflict("You are already a member of this college.", code = "already_member")
        }
        if (student && invites.isStudentAnywhere(identity.id)) {
            throw ApiException.conflict("You are a student of another college. Leave it first.", code = "already_in_college")
        }
        // A roll number another member took since the invite went out is not the student's
        // fault: they join without it, and the college can set it.
        val rollNumber = invite.rollNumber?.takeIf { student && !invites.rollNumberHeld(invite.orgId, it) }
        val memberId = invites.insertMembership(invite, identity.id, rollNumber, if (student) CONSENT_VERSION else null)
        if (!invites.markJoined(invite, memberId)) throw inviteNotFound()
        // A student placed under a batch with open assignments hears about each of them.
        if (student) notifications.studentJoined(invite.orgId, memberId)

        val scope =
            if (student) {
                access.resolveOwnStudentMembership(identity)
            } else {
                access.resolve(identity, invite.orgId)
            } ?: throw inviteNotFound()
        audit.record(
            scope,
            "member.joined",
            CampusOrgService.TARGET_MEMBER,
            memberId,
            mapOf(
                "inviteId" to invite.id,
                "role" to invite.role.dbValue,
                "emailMatched" to (normalised(identity.email) == invite.email),
                "rollNumberDropped" to (invite.rollNumber != null && rollNumber == null && student),
            ),
        )
        val context = me.me(identity)
        return AcceptInviteResult(context.student, context.staff, invite.orgId)
    }

    /** Unknown, malformed, expired, revoked, used, or of a suspended college: all the same 404. */
    private fun openInvite(
        token: String,
        lock: Boolean,
    ): TokenInvite {
        if (!InviteTokens.isWellFormed(token)) throw inviteNotFound()
        val invite = invites.findByTokenHash(InviteTokens.hash(token), lock) ?: throw inviteNotFound()
        if (invite.status != "invited" || !invite.expiresAt.isAfter(Instant.now()) || !invite.orgActive) throw inviteNotFound()
        return invite
    }

    private fun inviteNotFound() =
        ApiException(HttpStatus.NOT_FOUND, "invite_not_found", "This invite link is not valid any more. Ask your college for a new one.")

    private fun normalised(email: String): String = email.trim().lowercase(Locale.ROOT)

    companion object {
        /** Bump when [SHARED], [NOT_SHARED] or [AI_NOTICE] change: a student agrees to a version. */
        const val CONSENT_VERSION = "campus-2026-11-13"

        /**
         * What the college sees, literally true for v1. Every item here is something a college
         * staff screen shows, or will show when the module that shows it ships (assignments and
         * their reports, modules 4 and 6). The 14-day activity flag is the member list's
         * `active` column (campus spec §3, "Active").
         */
        val SHARED: List<String> =
            listOf(
                "Your name, the email address of the account you join with, your roll number and your batch.",
                "Which of the college's assignments you have started and completed.",
                "The scores and reports of the interviews your college assigns you.",
                "Whether you have practised on Untiered in the last 14 days, but not what you practised.",
            )

        val NOT_SHARED: List<String> =
            listOf(
                "The practice interviews you start yourself, and their reports and scores.",
                "Your resume file.",
                "Your credits and payments.",
            )

        /** Staff join to manage the college. The member list shows them to other staff too. */
        val STAFF_SHARED: List<String> =
            listOf(
                "Your name and the email address of the account you join with, shown to the college's staff.",
                "Whether you have practised on Untiered in the last 14 days, but not what you practised.",
            )

        const val AI_NOTICE =
            "Your answers in interviews are evaluated by AI. The scores and feedback in your reports come from that " +
                "evaluation, not from a person reading your answers, and they can be wrong."

        /** `r***@college.edu`: the first character of the mailbox, then the domain. */
        fun maskEmail(email: String): String {
            val at = email.lastIndexOf('@')
            if (at <= 0) return "***"
            return email.take(1) + "***" + email.substring(at)
        }
    }
}
