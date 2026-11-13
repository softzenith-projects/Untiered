package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.sources.AdminProperties
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Component
import java.util.UUID

/**
 * The one gate into a college's data (campus plan §2). Every campus route resolves an
 * [OrgScope] here first; nothing else constructs one.
 *
 * - A caller on the platform-admin allow-list ([AdminProperties]) gets a platform-admin
 *   scope for any college that exists, suspended or not. The allow-list wins over a
 *   membership the same person might also hold, so an operator's actions are always
 *   recorded as an operator's.
 * - Anyone else needs a `joined` **staff** membership of an **active** college. A student
 *   membership is not enough for a college route.
 * - Everything else is a 404, never a 403: the response must not confirm that a college
 *   exists to somebody who is not in it (as [AdminAccess] does for its routes).
 */
@Component
class CampusAccess(
    private val jdbc: JdbcClient,
    private val adminProperties: AdminProperties,
    private val adminAccess: AdminAccess,
    private val userRepository: UserRepository,
) {
    fun isPlatformAdmin(identity: SupabaseIdentity): Boolean = adminProperties.allows(identity)

    /**
     * For the platform-admin routes that act on no single college (listing, creating). 404 for
     * anyone off the allow-list, through [AdminAccess]. The returned proof is what the
     * repository's few unscoped, admin-only methods require.
     */
    fun requirePlatformAdmin(identity: SupabaseIdentity): PlatformAdmin {
        adminAccess.require(identity)
        userRepository.provision(identity)
        return PlatformAdmin(identity.id)
    }

    /** For `/campus/orgs/{org}/…`: a staff member of the college, or a platform admin. */
    fun resolve(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): OrgScope {
        if (isPlatformAdmin(identity)) return platformAdminScope(identity, orgId)

        val membership =
            jdbc
                .sql(
                    """
                    select m.id, m.role
                      from public.org_members m
                      join public.organisations o on o.id = m.org_id
                     where m.org_id = :orgId
                       and m.user_id = :userId
                       and m.status = 'joined'
                       and m.role <> 'student'
                       and o.status = 'active'
                    """.trimIndent(),
                ).param("orgId", orgId)
                .param("userId", identity.id)
                .query { rs, _ -> UUID.fromString(rs.getString("id")) to rs.getString("role") }
                .optional()
                .orElseThrow { ApiException.notFound() }
        val (memberId, roleValue) = membership
        val role = CampusRole.fromDbValue(roleValue) ?: throw ApiException.notFound()

        if (role != CampusRole.FACULTY) {
            return OrgScope(orgId, identity.id, role, memberId, platformAdmin = false)
        }
        val batches = facultyBatches(orgId, memberId)
        val departments = facultyDepartments(orgId, memberId)
        return OrgScope(orgId, identity.id, role, memberId, platformAdmin = false, batches, departments)
    }

    /**
     * For `/admin/campus/orgs/{org}/…`: the allow-list only (404 for everyone else, through
     * [AdminAccess]), and the college must exist in any status.
     */
    fun resolveAsPlatformAdmin(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): OrgScope {
        adminAccess.require(identity)
        return platformAdminScope(identity, orgId)
    }

    /**
     * The caller's own joined student membership, for `/me/campus/leave`. Deliberately not
     * gated on the college being active: leaving shares less, and must never be trapped.
     */
    fun resolveOwnStudentMembership(identity: SupabaseIdentity): OrgScope? =
        jdbc
            .sql(
                """
                /* unscoped: own-membership */
                select m.id, m.org_id
                  from public.org_members m
                 where m.user_id = :userId
                   and m.role = 'student'
                   and m.status = 'joined'
                """.trimIndent(),
            ).param("userId", identity.id)
            .query { rs, _ ->
                OrgScope(
                    orgId = UUID.fromString(rs.getString("org_id")),
                    actorUserId = identity.id,
                    role = CampusRole.STUDENT,
                    memberId = UUID.fromString(rs.getString("id")),
                    platformAdmin = false,
                )
            }.optional()
            .orElse(null)

    private fun platformAdminScope(
        identity: SupabaseIdentity,
        orgId: UUID,
    ): OrgScope {
        val exists =
            jdbc
                .sql("select count(*) from public.organisations where id = :orgId")
                .param("orgId", orgId)
                .query(Long::class.java)
                .single() > 0
        if (!exists) throw ApiException.notFound()
        // The audit log names the operator by user id, which must exist as a row to be referenced.
        userRepository.provision(identity)
        return OrgScope(orgId, identity.id, role = null, memberId = null, platformAdmin = true)
    }

    /** Batches granted directly, plus every batch of a granted department. */
    private fun facultyBatches(
        orgId: UUID,
        memberId: UUID,
    ): Set<UUID> =
        jdbc
            .sql(
                """
                select b.id
                  from public.org_batches b
                 where b.org_id = :orgId
                   and (b.id in (select s.batch_id from public.org_faculty_scopes s
                                  where s.org_id = :orgId and s.member_id = :memberId and s.batch_id is not null)
                        or b.department_id in (select s.department_id from public.org_faculty_scopes s
                                                where s.org_id = :orgId and s.member_id = :memberId
                                                  and s.department_id is not null))
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("memberId", memberId)
            .query(UUID::class.java)
            .list()
            .filterNotNull()
            .toSet()

    /**
     * Departments granted directly, plus the department of every granted batch — a faculty
     * member who teaches "CSE 2027" sees CSE in the department list, but only that batch in it.
     */
    private fun facultyDepartments(
        orgId: UUID,
        memberId: UUID,
    ): Set<UUID> =
        jdbc
            .sql(
                """
                select d.id
                  from public.org_departments d
                 where d.org_id = :orgId
                   and (d.id in (select s.department_id from public.org_faculty_scopes s
                                  where s.org_id = :orgId and s.member_id = :memberId and s.department_id is not null)
                        or d.id in (select b.department_id
                                      from public.org_faculty_scopes s
                                      join public.org_batches b on b.org_id = s.org_id and b.id = s.batch_id
                                     where s.org_id = :orgId and s.member_id = :memberId))
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("memberId", memberId)
            .query(UUID::class.java)
            .list()
            .filterNotNull()
            .toSet()
}

/**
 * Proof that the caller is on the platform-admin allow-list, for the handful of repository
 * methods that are not about one college (listing every college, creating one). Like
 * [OrgScope], only [CampusAccess] makes one.
 */
class PlatformAdmin internal constructor(
    val userId: UUID,
)
