package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.http.HttpStatus
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNull
import kotlin.test.assertTrue

class OrgScopeTest {
    private val org = UUID.randomUUID()
    private val user = UUID.randomUUID()
    private val member = UUID.randomUUID()
    private val batchX = UUID.randomUUID()
    private val batchY = UUID.randomUUID()
    private val department = UUID.randomUUID()

    @Test
    fun `faculty see only the batches and departments they are scoped to`() {
        val scope = OrgScope(org, user, CampusRole.FACULTY, member, false, setOf(batchX), setOf(department))

        assertTrue(scope.isNarrowed)
        assertEquals(setOf(batchX), scope.visibleBatchIds)
        assertEquals(setOf(department), scope.visibleDepartmentIds)
        assertTrue(scope.canSeeBatch(batchX))
        assertFalse(scope.canSeeBatch(batchY))
        assertTrue(scope.canSeeDepartment(department))
        assertFalse(scope.canSeeDepartment(UUID.randomUUID()))
    }

    @Test
    fun `unscoped faculty see nothing`() {
        val scope = OrgScope(org, user, CampusRole.FACULTY, member, false)

        assertEquals(emptySet(), scope.visibleBatchIds)
        assertEquals(emptySet(), scope.visibleDepartmentIds)
        assertFalse(scope.canSeeBatch(batchX))
    }

    @Test
    fun `admins, TPOs and platform admins are not narrowed, whatever ids are passed`() {
        val scopes =
            listOf(
                OrgScope(org, user, CampusRole.COLLEGE_ADMIN, member, false, setOf(batchX), emptySet()),
                OrgScope(org, user, CampusRole.TPO, member, false),
                OrgScope(org, user, null, null, true),
            )
        for (scope in scopes) {
            assertFalse(scope.isNarrowed)
            assertNull(scope.visibleBatchIds)
            assertNull(scope.visibleDepartmentIds)
            assertTrue(scope.canSeeBatch(batchY))
        }
    }

    @Test
    fun `require answers 403 campus_forbidden when the role lacks the permission`() {
        val faculty = OrgScope(org, user, CampusRole.FACULTY, member, false)

        faculty.require(CampusPermission.STUDENTS_VIEW)
        val error = assertThrows<ApiException> { faculty.require(CampusPermission.STRUCTURE_MANAGE) }
        assertEquals(HttpStatus.FORBIDDEN, error.status)
        assertEquals("campus_forbidden", error.code)
    }

    @Test
    fun `actor kind follows the platform admin flag`() {
        assertEquals("platform_admin", OrgScope(org, user, null, null, true).actorKind)
        assertEquals("member", OrgScope(org, user, CampusRole.TPO, member, false).actorKind)
    }

    @Test
    fun `a scope is either a member's or a platform admin's, never half of each`() {
        assertThrows<IllegalArgumentException> { OrgScope(org, user, CampusRole.TPO, null, false) }
        assertThrows<IllegalArgumentException> { OrgScope(org, user, null, member, true) }
        assertThrows<IllegalArgumentException> { OrgScope(org, user, CampusRole.TPO, member, true) }
    }
}
