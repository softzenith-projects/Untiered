package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.UUID

/**
 * Student onboarding for a college (contract "Module 3"): CSV import with a stored preview,
 * single invites, resend and revoke; and the platform admin's staff invites.
 *
 * Same order as [CampusOrgService]: the gate (404), the permission by name (403), then
 * lookups and body validation. Every write is audit-logged in its transaction, ids only.
 *
 * Who may invite whom: a student invite needs [CampusPermission.STUDENTS_MANAGE] (college
 * admin, TPO); a staff invite needs [CampusPermission.STAFF_MANAGE] (college admin, platform
 * admin). Resend and revoke follow the role of the invite they act on.
 */
@Service
class CampusOnboardingService(
    private val access: CampusAccess,
    private val invites: InviteRepository,
    private val structure: StructureRepository,
    private val audit: CampusAudit,
) {
    // -- imports -----------------------------------------------------------------

    @Transactional
    fun createImport(
        identity: SupabaseIdentity,
        orgId: UUID,
        size: Long,
        bytes: () -> ByteArray,
    ): ImportPreview {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_MANAGE)
        if (size > CampusCsv.MAX_BYTES) throw CampusCsv.invalid("Keep the file under 1 MB.")
        val parsed = CampusCsv.parseStudents(bytes())
        val (emails, rolls) = ImportValidation.lookupKeys(parsed)
        val rows = ImportValidation.validate(parsed, invites.importContext(scope, emails, rolls))
        val id = invites.createImport(scope, rows)
        val valid = rows.count { it.problems.isEmpty() }
        audit.record(
            scope,
            "import.created",
            TARGET_IMPORT,
            id,
            mapOf("rows" to rows.size, "valid" to valid),
        )
        return preview(scope, id)
    }

    @Transactional
    fun getImport(
        identity: SupabaseIdentity,
        orgId: UUID,
        importId: UUID,
    ): ImportPreview {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_MANAGE)
        return preview(scope, importId)
    }

    @Transactional
    fun discardImport(
        identity: SupabaseIdentity,
        orgId: UUID,
        importId: UUID,
    ) {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_MANAGE)
        val header = invites.findImport(scope, importId, lock = true) ?: throw ApiException.notFound()
        invites.discardImport(scope, importId)
        if (header.status == IMPORT_PREVIEWED) audit.record(scope, "import.discarded", TARGET_IMPORT, importId)
    }

    /**
     * Invites the stored valid rows. The import row is locked first, so a double submit waits
     * for the first and then finds it committed: `409 import_not_open`, and no second invite.
     */
    @Transactional
    fun commitImport(
        identity: SupabaseIdentity,
        orgId: UUID,
        importId: UUID,
    ): ImportCommitResult {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_MANAGE)
        val header = invites.findImport(scope, importId, lock = true) ?: throw ApiException.notFound()
        if (header.status != IMPORT_PREVIEWED || !header.expiresAt.isAfter(Instant.now())) {
            throw ApiException.conflict("This import was already committed, discarded or has expired.", code = "import_not_open")
        }
        val total = invites.importRows(scope, importId).size
        val invited = invites.commitImport(scope, importId)
        audit.record(
            scope,
            "import.committed",
            TARGET_IMPORT,
            importId,
            mapOf("invited" to invited, "skipped" to total - invited),
        )
        return ImportCommitResult(invited = invited, skipped = total - invited)
    }

    private fun preview(
        scope: OrgScope,
        importId: UUID,
    ): ImportPreview {
        val header = invites.findImport(scope, importId) ?: throw ApiException.notFound()
        val rows = invites.importRows(scope, importId)
        val valid = rows.count { it.problems.isEmpty() }
        return ImportPreview(
            id = header.id,
            status = header.status,
            createdAt = header.createdAt.toString(),
            expiresAt = header.expiresAt.toString(),
            rows = rows,
            summary = ImportSummary(total = rows.size, valid = valid, withProblems = rows.size - valid),
        )
    }

    // -- invites -----------------------------------------------------------------

    @Transactional
    fun listInvites(
        identity: SupabaseIdentity,
        orgId: UUID,
        status: String?,
        role: String?,
        batchId: UUID?,
        query: String?,
        cursor: String?,
    ): Page<InviteView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_MANAGE)
        return page(scope, filter(status, role, batchId, query), cursor, staffOnly = false)
    }

    @Transactional
    fun createInvite(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: CreateInviteRequest,
    ): InviteView {
        val scope = access.resolve(identity, orgId)
        if (!scope.has(CampusPermission.STUDENTS_MANAGE) && !scope.has(CampusPermission.STAFF_MANAGE)) throw OrgScope.forbidden()
        val role = parseRole(request.role, CampusRole.entries.toSet())
        scope.require(if (role == CampusRole.STUDENT) CampusPermission.STUDENTS_MANAGE else CampusPermission.STAFF_MANAGE)
        val email = inviteEmail(request.email)
        val fullName = fullName(request.fullName)
        val batchId =
            if (role == CampusRole.STUDENT) {
                val id = request.batchId ?: throw ApiException.badRequest("A student invite needs a batch.", code = "batch_required")
                structure.findBatch(scope, id)?.id ?: throw ApiException.notFound()
            } else {
                null
            }
        val rollNumber = if (role == CampusRole.STUDENT) CampusValidation.optionalRollNumber(request.rollNumber) else null
        return create(scope, NewInvite(email, fullName, role, batchId, rollNumber))
    }

    /** Platform admin: a college's first admin or TPO (`/admin/campus/orgs/{org}/invites`). */
    @Transactional
    fun adminCreateInvite(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: AdminCreateInviteRequest,
    ): InviteView {
        val scope = access.resolveAsPlatformAdmin(identity, orgId)
        scope.require(CampusPermission.FIRST_ADMIN_INVITE)
        val role = parseRole(request.role, setOf(CampusRole.COLLEGE_ADMIN, CampusRole.TPO))
        return create(scope, NewInvite(inviteEmail(request.email), fullName(request.fullName), role, null, null))
    }

    @Transactional
    fun adminListInvites(
        identity: SupabaseIdentity,
        orgId: UUID,
        cursor: String?,
    ): Page<InviteView> {
        val scope = access.resolveAsPlatformAdmin(identity, orgId)
        scope.require(CampusPermission.FIRST_ADMIN_INVITE)
        val result = page(scope, InviteFilter(), cursor, staffOnly = true)
        audit.recordPlatformAdminRead(scope, "invites.viewed", CampusOrgService.TARGET_ORG, orgId)
        return result
    }

    /**
     * Sends the invite again with a new link: the old link stops working at once, the expiry
     * is reset to 14 days, and the email is queued. At most ten emails per invite.
     */
    @Transactional
    fun resend(
        identity: SupabaseIdentity,
        orgId: UUID,
        inviteId: UUID,
    ): InviteView {
        val scope = access.resolve(identity, orgId)
        val invite = lockForChange(scope, inviteId)
        if (invite.sendCount >= InviteRepository.MAX_SENDS) {
            throw ApiException(HttpStatus.TOO_MANY_REQUESTS, "resend_limit", "This invite has been sent ten times already.")
        }
        if (!invites.resend(scope, inviteId)) throw inviteNotOpen()
        audit.record(scope, "invite.resent", TARGET_INVITE, inviteId)
        return invites.findInvite(scope, inviteId)?.view ?: throw ApiException.notFound()
    }

    @Transactional
    fun revoke(
        identity: SupabaseIdentity,
        orgId: UUID,
        inviteId: UUID,
    ): InviteView {
        val scope = access.resolve(identity, orgId)
        lockForChange(scope, inviteId)
        if (!invites.revoke(scope, inviteId)) throw inviteNotOpen()
        audit.record(scope, "invite.revoked", TARGET_INVITE, inviteId)
        return invites.findInvite(scope, inviteId)?.view ?: throw ApiException.notFound()
    }

    /** 403 before anything is read for a caller who can manage no invite; then by the invite's role. */
    private fun lockForChange(
        scope: OrgScope,
        inviteId: UUID,
    ): InviteRow {
        if (!scope.has(CampusPermission.STUDENTS_MANAGE) && !scope.has(CampusPermission.STAFF_MANAGE)) throw OrgScope.forbidden()
        val invite = invites.findInvite(scope, inviteId, lock = true) ?: throw ApiException.notFound()
        scope.require(if (invite.role == CampusRole.STUDENT) CampusPermission.STUDENTS_MANAGE else CampusPermission.STAFF_MANAGE)
        if (invite.storedStatus != STATUS_INVITED) throw inviteNotOpen()
        return invite
    }

    private fun create(
        scope: OrgScope,
        invite: NewInvite,
    ): InviteView {
        if (invites.isMemberEmail(scope, invite.email)) {
            throw ApiException.conflict("Someone in this college already signs in with that email.", code = "already_member")
        }
        if (invites.hasOpenInvite(scope, invite.email)) {
            throw ApiException.conflict("That email already has an open invite. Resend it instead.", code = "already_invited")
        }
        val id =
            invites.createInvite(scope, invite)
                ?: throw ApiException.conflict("That email already has an open invite. Resend it instead.", code = "already_invited")
        audit.record(scope, "invite.created", TARGET_INVITE, id, mapOf("role" to invite.role.dbValue))
        return invites.findInvite(scope, id)?.view ?: throw ApiException.notFound()
    }

    private fun page(
        scope: OrgScope,
        filter: InviteFilter,
        cursor: String?,
        staffOnly: Boolean,
    ): Page<InviteView> {
        val after = CampusCursor.decodeInvite(cursor)
        val rows = invites.listInvites(scope, filter, after, CampusCursor.PAGE_SIZE + 1, staffOnly)
        val page = rows.take(CampusCursor.PAGE_SIZE)
        val next = if (rows.size > CampusCursor.PAGE_SIZE) page.last().let { CampusCursor.encodeInvite(it.createdAt, it.view.id) } else null
        return Page(page.map { it.view }, next)
    }

    private fun filter(
        status: String?,
        role: String?,
        batchId: UUID?,
        query: String?,
    ): InviteFilter {
        val statusFilter =
            status?.trim()?.takeIf { it.isNotEmpty() }?.also {
                if (it !in INVITE_STATUSES) throw ApiException.badRequest("status is not an invite status.", code = "invalid_status")
            }
        val roleFilter =
            role?.trim()?.takeIf { it.isNotEmpty() }?.let {
                CampusRole.fromDbValue(it) ?: throw ApiException.badRequest("role is not a campus role.", code = "invalid_role")
            }
        val q = query?.trim()?.takeIf { it.isNotEmpty() }
        if (q != null && q.length > MAX_QUERY) throw ApiException.badRequest("Keep the search under $MAX_QUERY characters.")
        return InviteFilter(statusFilter, roleFilter, batchId, q)
    }

    private fun parseRole(
        value: String?,
        allowed: Set<CampusRole>,
    ): CampusRole =
        value?.trim()?.let(CampusRole::fromDbValue)?.takeIf { it in allowed }
            ?: throw ApiException.badRequest(
                "role needs to be one of ${allowed.joinToString(", ") { it.dbValue }}.",
                code = "invalid_role",
            )

    private fun inviteEmail(value: String?): String =
        ImportValidation.normaliseEmail(value)
            ?: throw ApiException.badRequest("email needs to be an email address.", code = "invalid_email")

    private fun fullName(value: String?): String {
        val clean = value?.trim().orEmpty()
        if (clean.length !in 1..CampusCsv.MAX_NAME) {
            throw ApiException.badRequest("fullName needs 1 to ${CampusCsv.MAX_NAME} characters.", code = "invalid_full_name")
        }
        return clean
    }

    private fun inviteNotOpen() = ApiException.conflict("This invite was already joined, revoked or replaced.", code = "invite_not_open")

    companion object {
        const val TARGET_IMPORT = "import"
        const val TARGET_INVITE = "invite"
        private const val IMPORT_PREVIEWED = "previewed"
        private const val STATUS_INVITED = "invited"
        private const val MAX_QUERY = 100
        private val INVITE_STATUSES = setOf("invited", "joined", "revoked", "expired")
    }
}
