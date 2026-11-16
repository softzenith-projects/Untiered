package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import org.springframework.http.HttpStatus
import java.util.UUID

/**
 * Proof that the caller passed [CampusAccess] for exactly one college, and what they may see
 * there. Every campus repository method takes one and binds [orgId] into its SQL, so code
 * cannot reach a college's rows without having been through the gate.
 *
 * The constructor is `internal`: only [CampusAccess] makes a scope (tests in this module may
 * too). A controller has no way to fabricate one for an org id it read from a path.
 *
 * Faculty narrowing lives here too (campus spec §2: "faculty can be limited to specific
 * departments or batches"). Department scopes are expanded to their batches when the scope
 * is resolved, so a batch created later in a scoped department is seen on the next request.
 * A faculty member with no scopes sees nothing — deny by default.
 */
class OrgScope internal constructor(
    val orgId: UUID,
    /** The caller's user id, from the verified token. */
    val actorUserId: UUID,
    /** The caller's role in this college; null for a platform admin acting from the allow-list. */
    val role: CampusRole?,
    /** The caller's membership id; null for a platform admin. */
    val memberId: UUID?,
    val platformAdmin: Boolean,
    facultyBatchIds: Set<UUID> = emptySet(),
    facultyDepartmentIds: Set<UUID> = emptySet(),
) {
    init {
        require(platformAdmin == (role == null)) { "A scope is either a platform admin's or a member's" }
        require(platformAdmin == (memberId == null)) { "A member scope carries its membership id" }
    }

    private val narrowed: Boolean = role == CampusRole.FACULTY
    private val batches: Set<UUID> = if (narrowed) facultyBatchIds.toSet() else emptySet()
    private val departments: Set<UUID> = if (narrowed) facultyDepartmentIds.toSet() else emptySet()

    /** `member` or `platform_admin`, as `org_audit_log.actor_kind` stores it. */
    val actorKind: String get() = if (platformAdmin) "platform_admin" else "member"

    fun has(permission: CampusPermission): Boolean = permission.allows(role, platformAdmin)

    /** 403 `campus_forbidden`: the caller is a member, so the college's existence is no secret. */
    fun require(permission: CampusPermission) {
        if (!has(permission)) throw forbidden()
    }

    /** True when queries must be limited to [visibleBatchIds] / [visibleDepartmentIds]. */
    val isNarrowed: Boolean get() = narrowed

    /** The batches a faculty member may see; null means every batch in the college. */
    val visibleBatchIds: Set<UUID>? get() = if (narrowed) batches else null

    /** The departments a faculty member may see; null means every department in the college. */
    val visibleDepartmentIds: Set<UUID>? get() = if (narrowed) departments else null

    fun canSeeBatch(batchId: UUID): Boolean = !narrowed || batchId in batches

    fun canSeeDepartment(departmentId: UUID): Boolean = !narrowed || departmentId in departments

    override fun toString(): String = "OrgScope(org=$orgId, role=${role?.dbValue ?: "platform_admin"})"

    companion object {
        fun forbidden() =
            ApiException(
                HttpStatus.FORBIDDEN,
                "campus_forbidden",
                "Your role in this college does not allow that.",
            )
    }
}
