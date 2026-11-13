package com.interviewos.api.campus

/**
 * A role a person holds inside one college. `PLATFORM_ADMIN` is deliberately not one: it is
 * the `interviewos.admin` allow-list (campus spec §2), never a row anybody could be granted.
 */
enum class CampusRole(
    val dbValue: String,
) {
    COLLEGE_ADMIN("college_admin"),
    TPO("tpo"),
    FACULTY("faculty"),
    STUDENT("student"),
    ;

    val isStaff: Boolean get() = this != STUDENT

    companion object {
        fun fromDbValue(value: String): CampusRole? = entries.firstOrNull { it.dbValue == value }

        val STAFF: Set<CampusRole> = setOf(COLLEGE_ADMIN, TPO, FACULTY)
    }
}

/**
 * What a caller may do in a college, checked by name in services (`scope.require(...)`),
 * never by comparing role strings in a controller.
 *
 * This enum *is* the permission matrix of campus plan §3: each entry lists the college roles
 * that hold it and whether a platform admin does. "Scoped" in the plan — faculty limited to
 * their departments and batches — is not a separate permission: a faculty member holds the
 * permission, and [OrgScope] narrows what the query can see.
 */
enum class CampusPermission(
    val roles: Set<CampusRole>,
    val platformAdmin: Boolean,
) {
    /** Create or suspend a college, set its interview allowance. */
    ORGS_ADMINISTER(emptySet(), platformAdmin = true),

    /** Invite a college's first admin (module 3). */
    FIRST_ADMIN_INVITE(emptySet(), platformAdmin = true),

    /** Read the college's profile, departments and batches. Every staff role. */
    ORG_VIEW(CampusRole.STAFF, platformAdmin = true),

    /** Edit the college's profile and contact. */
    ORG_PROFILE_EDIT(setOf(CampusRole.COLLEGE_ADMIN), platformAdmin = true),

    /** Invite or remove staff, change a staff role, set faculty scopes. */
    STAFF_MANAGE(setOf(CampusRole.COLLEGE_ADMIN), platformAdmin = true),

    /** Create, rename and delete departments and batches. */
    STRUCTURE_MANAGE(setOf(CampusRole.COLLEGE_ADMIN, CampusRole.TPO), platformAdmin = true),

    /** Import, invite, move and remove students; resend and revoke invites. Not a platform admin's job. */
    STUDENTS_MANAGE(setOf(CampusRole.COLLEGE_ADMIN, CampusRole.TPO), platformAdmin = false),

    /** See students and their invite status. Faculty: scoped. Platform admin: audited. */
    STUDENTS_VIEW(CampusRole.STAFF, platformAdmin = true),

    /** Create and publish assignments (module 4). Faculty: for scoped batches and their students. */
    ASSIGNMENTS_MANAGE(CampusRole.STAFF, platformAdmin = false),

    /** View assignment progress (module 4). Faculty: scoped. Platform admin: audited. */
    ASSIGNMENT_PROGRESS_VIEW(CampusRole.STAFF, platformAdmin = true),

    /** View a student's assignment report (module 6). Faculty: scoped. Platform admin: audited. */
    STUDENT_REPORT_VIEW(CampusRole.STAFF, platformAdmin = true),

    /** Export CSV / PDF (module 7). Faculty: scoped. */
    EXPORT(CampusRole.STAFF, platformAdmin = false),

    /** Read the college's audit log. */
    AUDIT_LOG_VIEW(setOf(CampusRole.COLLEGE_ADMIN), platformAdmin = true),

    /** See and start one's own assignments, and leave the college. */
    OWN_MEMBERSHIP(setOf(CampusRole.STUDENT), platformAdmin = false),
    ;

    fun allows(
        role: CampusRole?,
        isPlatformAdmin: Boolean,
    ): Boolean = if (isPlatformAdmin) platformAdmin else role != null && role in roles
}
