package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals

/**
 * The permission matrix of campus plan §3, written out longhand. Changing who may do what is
 * a product decision about other people's data, so it has to be changed here on purpose too.
 */
class CampusPermissionTest {
    private val admin = CampusRole.COLLEGE_ADMIN
    private val tpo = CampusRole.TPO
    private val faculty = CampusRole.FACULTY
    private val student = CampusRole.STUDENT

    /** permission to (college roles that hold it, whether a platform admin holds it) */
    private val expected: Map<CampusPermission, Pair<Set<CampusRole>, Boolean>> =
        mapOf(
            CampusPermission.ORGS_ADMINISTER to (emptySet<CampusRole>() to true),
            CampusPermission.FIRST_ADMIN_INVITE to (emptySet<CampusRole>() to true),
            CampusPermission.ORG_VIEW to (setOf(admin, tpo, faculty) to true),
            CampusPermission.ORG_PROFILE_EDIT to (setOf(admin) to true),
            CampusPermission.STAFF_MANAGE to (setOf(admin) to true),
            CampusPermission.STRUCTURE_MANAGE to (setOf(admin, tpo) to true),
            CampusPermission.STUDENTS_MANAGE to (setOf(admin, tpo) to false),
            CampusPermission.STUDENTS_VIEW to (setOf(admin, tpo, faculty) to true),
            CampusPermission.ASSIGNMENTS_MANAGE to (setOf(admin, tpo, faculty) to false),
            CampusPermission.ASSIGNMENT_PROGRESS_VIEW to (setOf(admin, tpo, faculty) to true),
            CampusPermission.STUDENT_REPORT_VIEW to (setOf(admin, tpo, faculty) to true),
            CampusPermission.READINESS_VIEW to (setOf(admin, tpo, faculty) to true),
            CampusPermission.READINESS_WEIGHTS_EDIT to (setOf(admin) to false),
            CampusPermission.EXPORT to (setOf(admin, tpo, faculty) to false),
            CampusPermission.STAFF_NOTES to (setOf(admin, tpo, faculty) to false),
            CampusPermission.STAFF_NOTES_MODERATE to (setOf(admin) to false),
            CampusPermission.PROGRAMMES_MANAGE to (setOf(admin, tpo) to false),
            CampusPermission.AUDIT_LOG_VIEW to (setOf(admin) to true),
            CampusPermission.OWN_MEMBERSHIP to (setOf(student) to false),
        )

    @Test
    fun `every permission is in the matrix`() {
        assertEquals(CampusPermission.entries.toSet(), expected.keys)
    }

    @Test
    fun `each role holds exactly the permissions the plan gives it`() {
        for ((permission, grant) in expected) {
            val (roles, platformAdmin) = grant
            for (role in CampusRole.entries) {
                assertEquals(role in roles, permission.allows(role, isPlatformAdmin = false), "$role / $permission")
            }
            assertEquals(platformAdmin, permission.allows(null, isPlatformAdmin = true), "platform admin / $permission")
        }
    }

    @Test
    fun `a student holds nothing but their own membership, and no role means nothing`() {
        val studentGrants = CampusPermission.entries.filter { it.allows(student, isPlatformAdmin = false) }
        assertEquals(listOf(CampusPermission.OWN_MEMBERSHIP), studentGrants)
        assertEquals(emptyList(), CampusPermission.entries.filter { it.allows(null, isPlatformAdmin = false) })
    }

    @Test
    fun `role values round-trip and only the four college roles exist`() {
        assertEquals(listOf("college_admin", "tpo", "faculty", "student"), CampusRole.entries.map { it.dbValue })
        for (role in CampusRole.entries) assertEquals(role, CampusRole.fromDbValue(role.dbValue))
        assertEquals(null, CampusRole.fromDbValue("platform_admin"))
        assertEquals(null, CampusRole.fromDbValue("COLLEGE_ADMIN"))
    }
}
