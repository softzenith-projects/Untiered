package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

/**
 * The college routes (`/campus/orgs/{org}/…`, contract "Module 1–2"). Every method starts by
 * resolving the caller's [OrgScope] (404 if they are not staff there), then checks the
 * permission by name (403 `campus_forbidden`), and only then looks anything up or validates
 * the body. Writes are audit-logged in the same transaction; a platform admin's reads are
 * too.
 */
@Service
class CampusOrgService(
    private val access: CampusAccess,
    private val orgs: OrganisationRepository,
    private val structure: StructureRepository,
    private val members: MemberRepository,
    private val audit: CampusAudit,
    private val logos: OrgLogos,
) {
    // -- the college -----------------------------------------------------------

    @Transactional
    fun org(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): OrgView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ORG_VIEW)
        val row = orgs.find(scope) ?: throw ApiException.notFound()
        audit.recordPlatformAdminRead(scope, "org.viewed", TARGET_ORG, orgId)
        return logos.view(row)
    }

    @Transactional
    fun updateProfile(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: UpdateOrgProfileRequest,
    ): OrgView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ORG_PROFILE_EDIT)
        orgs.lock(scope)
        val row = orgs.find(scope) ?: throw ApiException.notFound()
        val changed = mutableListOf<String>()
        val fields =
            OrgFields(
                name = row.name,
                city = patchText(request.city, row.city, "city", changed) { CampusValidation.optionalText(it, "city", 120) },
                state = patchText(request.state, row.state, "state", changed) { CampusValidation.optionalText(it, "state", 120) },
                contactName =
                    patchText(request.contactName, row.contactName, "contactName", changed) {
                        CampusValidation.optionalText(it, "contactName", 200)
                    },
                contactEmail =
                    patchText(request.contactEmail, row.contactEmail, "contactEmail", changed) {
                        CampusValidation.optionalEmail(it)
                    },
                contactPhone =
                    patchText(request.contactPhone, row.contactPhone, "contactPhone", changed) {
                        CampusValidation.optionalPhone(it)
                    },
                interviewAllowance = row.interviewAllowance,
                status = row.status,
            )
        if (changed.isNotEmpty()) {
            orgs.update(scope, fields)
            audit.record(scope, "org.updated", TARGET_ORG, orgId, mapOf("fields" to changed))
        }
        return logos.view(orgs.find(scope) ?: throw ApiException.notFound())
    }

    // -- departments -----------------------------------------------------------

    @Transactional
    fun departments(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): List<DepartmentView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ORG_VIEW)
        val result = structure.listDepartments(scope)
        audit.recordPlatformAdminRead(scope, "departments.viewed", TARGET_ORG, orgId)
        return result
    }

    @Transactional
    fun createDepartment(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: CreateDepartmentRequest,
    ): DepartmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STRUCTURE_MANAGE)
        val code = CampusValidation.departmentCode(request.code)
        val name = CampusValidation.departmentName(request.name)
        val id = structure.createDepartment(scope, code, name) ?: throw departmentCodeTaken()
        audit.record(scope, "department.created", TARGET_DEPARTMENT, id)
        return structure.findDepartment(scope, id) ?: throw ApiException.notFound()
    }

    @Transactional
    fun updateDepartment(
        identity: SupabaseIdentity,
        orgId: UUID,
        departmentId: UUID,
        request: UpdateDepartmentRequest,
    ): DepartmentView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STRUCTURE_MANAGE)
        val current = structure.findDepartment(scope, departmentId) ?: throw ApiException.notFound()
        val code = request.code?.let { CampusValidation.departmentCode(it) } ?: current.code
        val name = request.name?.let { CampusValidation.departmentName(it) } ?: current.name
        val changed = listOfNotNull("code".takeIf { code != current.code }, "name".takeIf { name != current.name })
        if (changed.isEmpty()) return current
        if (code != current.code && structure.departmentCodeTaken(scope, code, departmentId)) throw departmentCodeTaken()
        structure.updateDepartment(scope, departmentId, code, name)
        audit.record(scope, "department.updated", TARGET_DEPARTMENT, departmentId, mapOf("fields" to changed))
        return structure.findDepartment(scope, departmentId) ?: throw ApiException.notFound()
    }

    @Transactional
    fun deleteDepartment(
        identity: SupabaseIdentity,
        orgId: UUID,
        departmentId: UUID,
    ) {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STRUCTURE_MANAGE)
        val current = structure.findDepartment(scope, departmentId) ?: throw ApiException.notFound()
        if (current.batchCount > 0) {
            throw ApiException.conflict("Delete or move this department's batches first.", code = "department_has_batches")
        }
        if (!structure.deleteDepartment(scope, departmentId)) throw ApiException.notFound()
        audit.record(scope, "department.deleted", TARGET_DEPARTMENT, departmentId)
    }

    // -- batches ---------------------------------------------------------------

    @Transactional
    fun batches(
        identity: SupabaseIdentity,
        orgId: UUID,
        departmentId: UUID?,
    ): List<BatchView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.ORG_VIEW)
        val result = structure.listBatches(scope, departmentId)
        audit.recordPlatformAdminRead(scope, "batches.viewed", TARGET_ORG, orgId)
        return result
    }

    @Transactional
    fun createBatch(
        identity: SupabaseIdentity,
        orgId: UUID,
        request: CreateBatchRequest,
    ): BatchView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STRUCTURE_MANAGE)
        val departmentId =
            request.departmentId ?: throw ApiException.badRequest("departmentId is required.", code = "missing_department")
        val year = CampusValidation.graduationYear(request.graduationYear)
        val name = CampusValidation.batchName(request.name)
        structure.findDepartment(scope, departmentId) ?: throw ApiException.notFound()
        val id = structure.createBatch(scope, departmentId, year, name) ?: throw batchNameTaken()
        audit.record(scope, "batch.created", TARGET_BATCH, id, mapOf("departmentId" to departmentId))
        return structure.findBatch(scope, id) ?: throw ApiException.notFound()
    }

    @Transactional
    fun updateBatch(
        identity: SupabaseIdentity,
        orgId: UUID,
        batchId: UUID,
        request: UpdateBatchRequest,
    ): BatchView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STRUCTURE_MANAGE)
        val current = structure.findBatch(scope, batchId) ?: throw ApiException.notFound()
        val year = request.graduationYear?.let { CampusValidation.graduationYear(it) } ?: current.graduationYear
        val name = request.name?.let { CampusValidation.batchName(it) } ?: current.name
        val changed =
            listOfNotNull("graduationYear".takeIf { year != current.graduationYear }, "name".takeIf { name != current.name })
        if (changed.isEmpty()) return current
        if (name != current.name && structure.batchNameTaken(scope, name, batchId)) throw batchNameTaken()
        structure.updateBatch(scope, batchId, year, name)
        audit.record(scope, "batch.updated", TARGET_BATCH, batchId, mapOf("fields" to changed))
        return structure.findBatch(scope, batchId) ?: throw ApiException.notFound()
    }

    @Transactional
    fun deleteBatch(
        identity: SupabaseIdentity,
        orgId: UUID,
        batchId: UUID,
    ) {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STRUCTURE_MANAGE)
        structure.findBatch(scope, batchId) ?: throw ApiException.notFound()
        if (structure.batchHasMembers(scope, batchId)) {
            throw ApiException.conflict(
                "This batch has, or has had, students, so it cannot be deleted.",
                code = "batch_has_members",
            )
        }
        if (!structure.deleteBatch(scope, batchId)) throw ApiException.notFound()
        audit.record(scope, "batch.deleted", TARGET_BATCH, batchId)
    }

    // -- members ---------------------------------------------------------------

    @Transactional
    fun members(
        identity: SupabaseIdentity,
        orgId: UUID,
        role: String?,
        batchId: UUID?,
        departmentId: UUID?,
        query: String?,
        cursor: String?,
    ): Page<MemberView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_VIEW)
        val roleFilter =
            role?.trim()?.takeIf { it.isNotEmpty() }?.let {
                CampusRole.fromDbValue(it) ?: throw ApiException.badRequest("role is not a campus role.", code = "invalid_role")
            }
        val q = query?.trim()?.takeIf { it.isNotEmpty() }
        if (q != null && q.length > MAX_QUERY) throw ApiException.badRequest("Keep the search under $MAX_QUERY characters.")
        val after = CampusCursor.decodeMember(cursor)
        val rows = members.list(scope, MemberFilter(roleFilter, batchId, departmentId, q), after, CampusCursor.PAGE_SIZE + 1)
        audit.recordPlatformAdminRead(scope, "members.viewed", TARGET_ORG, orgId)
        val page = rows.take(CampusCursor.PAGE_SIZE)
        val next =
            if (rows.size > CampusCursor.PAGE_SIZE) {
                page.last().let { CampusCursor.encodeMember(MemberCursor(it.joinedAt, it.view.id)) }
            } else {
                null
            }
        return Page(page.map { it.view }, next)
    }

    /** Moves a student to another batch, or sets their roll number. Staff have neither. */
    @Transactional
    fun updateMember(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        request: UpdateMemberRequest,
    ): MemberView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENTS_MANAGE)
        val member = members.find(scope, memberId) ?: throw ApiException.notFound()
        if (member.role != CampusRole.STUDENT) {
            throw ApiException.badRequest("Only a student has a batch and roll number.", code = "not_a_student")
        }
        val currentBatch = member.view.batchId ?: throw ApiException.notFound()
        val batchId = request.batchId ?: currentBatch
        if (batchId != currentBatch) structure.findBatch(scope, batchId) ?: throw ApiException.notFound()
        val rollNumber =
            if (request.rollNumber == null) member.view.rollNumber else CampusValidation.optionalRollNumber(request.rollNumber)
        val changed =
            listOfNotNull("batchId".takeIf { batchId != currentBatch }, "rollNumber".takeIf { rollNumber != member.view.rollNumber })
        if (changed.isEmpty()) return member.view
        if (rollNumber != null && rollNumber != member.view.rollNumber && members.rollNumberTaken(scope, rollNumber, memberId)) {
            throw ApiException.conflict("Another student in this college has that roll number.", code = "roll_number_taken")
        }
        if (!members.updateStudent(scope, memberId, batchId, rollNumber)) throw ApiException.notFound()
        val detail = mutableMapOf<String, Any?>("fields" to changed)
        if (batchId != currentBatch) {
            detail["fromBatchId"] = currentBatch
            detail["toBatchId"] = batchId
        }
        audit.record(scope, "member.updated", TARGET_MEMBER, memberId, detail)
        return members.find(scope, memberId)?.view ?: throw ApiException.notFound()
    }

    /**
     * Removes someone from the college; their account is untouched. A college admin may remove
     * anyone but themselves; a TPO, students only. The last college admin cannot be removed.
     */
    @Transactional
    fun removeMember(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
    ) {
        val scope = access.resolve(identity, orgId)
        if (!scope.has(CampusPermission.STUDENTS_MANAGE) && !scope.has(CampusPermission.STAFF_MANAGE)) {
            throw OrgScope.forbidden()
        }
        orgs.lock(scope)
        val member = members.find(scope, memberId) ?: throw ApiException.notFound()
        if (member.view.id == scope.memberId) {
            throw ApiException.conflict("You cannot remove yourself from the college.", code = "cannot_remove_self")
        }
        if (member.role == CampusRole.STUDENT) {
            scope.require(CampusPermission.STUDENTS_MANAGE)
        } else {
            scope.require(CampusPermission.STAFF_MANAGE)
            if (member.role == CampusRole.COLLEGE_ADMIN && members.countCollegeAdmins(scope) <= 1) throw lastAdmin()
        }
        if (!members.remove(scope, memberId)) throw ApiException.notFound()
        audit.record(scope, "member.removed", TARGET_MEMBER, memberId, mapOf("role" to member.role.dbValue))
    }

    @Transactional
    fun changeRole(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        request: ChangeRoleRequest,
    ): MemberView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_MANAGE)
        val role =
            request.role
                ?.trim()
                ?.let(CampusRole::fromDbValue)
                ?.takeIf { it.isStaff }
                ?: throw ApiException.badRequest("role needs to be college_admin, tpo or faculty.", code = "invalid_role")
        orgs.lock(scope)
        val member = members.find(scope, memberId) ?: throw ApiException.notFound()
        if (!member.role.isStaff) {
            throw ApiException.badRequest("A student's role is not changed here.", code = "not_staff")
        }
        if (member.role == role) return member.view
        if (member.role == CampusRole.COLLEGE_ADMIN && members.countCollegeAdmins(scope) <= 1) throw lastAdmin()
        if (!members.changeStaffRole(scope, memberId, role)) throw ApiException.notFound()
        audit.record(
            scope,
            "member.role_changed",
            TARGET_MEMBER,
            memberId,
            mapOf("from" to member.role.dbValue, "to" to role.dbValue),
        )
        return members.find(scope, memberId)?.view ?: throw ApiException.notFound()
    }

    @Transactional
    fun facultyScopes(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
    ): FacultyScopesView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_MANAGE)
        members.find(scope, memberId) ?: throw ApiException.notFound()
        val result = members.facultyScopes(scope, memberId)
        audit.recordPlatformAdminRead(scope, "faculty_scopes.viewed", TARGET_MEMBER, memberId)
        return result
    }

    @Transactional
    fun replaceFacultyScopes(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        request: FacultyScopesView,
    ): FacultyScopesView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STAFF_MANAGE)
        val member = members.find(scope, memberId) ?: throw ApiException.notFound()
        if (member.role != CampusRole.FACULTY) {
            throw ApiException.badRequest("Only a faculty member is limited to departments and batches.", code = "not_faculty")
        }
        val departmentIds = request.departmentIds.toSet()
        val batchIds = request.batchIds.toSet()
        if (departmentIds.size + batchIds.size > MAX_SCOPES) {
            throw ApiException.badRequest("Choose at most $MAX_SCOPES departments and batches.", code = "too_many_scopes")
        }
        // An id of another college is not found, exactly as it would be on its own route.
        if (members.countDepartments(scope, departmentIds) != departmentIds.size) throw ApiException.notFound()
        if (members.countBatches(scope, batchIds) != batchIds.size) throw ApiException.notFound()
        members.replaceFacultyScopes(scope, memberId, departmentIds, batchIds)
        audit.record(
            scope,
            "faculty_scopes.updated",
            TARGET_MEMBER,
            memberId,
            mapOf("departmentIds" to departmentIds.sorted(), "batchIds" to batchIds.sorted()),
        )
        return members.facultyScopes(scope, memberId)
    }

    // -- audit log -------------------------------------------------------------

    @Transactional
    fun auditLog(
        identity: SupabaseIdentity,
        orgId: UUID,
        cursor: String?,
    ): Page<AuditEntryView> {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.AUDIT_LOG_VIEW)
        val before = CampusCursor.decodeAudit(cursor)
        val rows = audit.list(scope, before, CampusCursor.PAGE_SIZE + 1)
        val page = rows.take(CampusCursor.PAGE_SIZE)
        val next = if (rows.size > CampusCursor.PAGE_SIZE) CampusCursor.encodeAudit(page.last().id) else null
        // Recorded after the read, so the operator's own entry is not on the page they asked for.
        audit.recordPlatformAdminRead(scope, "audit_log.viewed", TARGET_ORG, orgId)
        return Page(page, next)
    }

    private fun departmentCodeTaken() =
        ApiException.conflict("This college already has a department with that code.", code = "department_code_taken")

    private fun batchNameTaken() = ApiException.conflict("This college already has a batch with that name.", code = "batch_name_taken")

    private fun lastAdmin() =
        ApiException.conflict("A college needs at least one college admin. Make someone else an admin first.", code = "last_admin")

    companion object {
        const val TARGET_ORG = "organisation"
        const val TARGET_DEPARTMENT = "department"
        const val TARGET_BATCH = "batch"
        const val TARGET_MEMBER = "member"
        private const val MAX_QUERY = 100
        private const val MAX_SCOPES = 200

        /**
         * A PATCH text field: null leaves [current]; anything else is normalised (blank becomes
         * null, which clears it). Records the field name in [changed] when the value moves.
         */
        internal fun patchText(
            requested: String?,
            current: String?,
            field: String,
            changed: MutableList<String>,
            normalise: (String) -> String?,
        ): String? {
            if (requested == null) return current
            val next = normalise(requested)
            if (next != current) changed += field
            return next
        }
    }
}
