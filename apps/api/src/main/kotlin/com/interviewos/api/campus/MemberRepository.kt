package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** A membership as the services need it: the view, plus what decides what may be done to it. */
data class MemberRow(
    val view: MemberView,
    val userId: UUID,
    val role: CampusRole,
    val joinedAt: Instant,
)

data class MemberFilter(
    val role: CampusRole? = null,
    val batchId: UUID? = null,
    val departmentId: UUID? = null,
    val query: String? = null,
)

/** Keyset position in the member list: (joined_at, id), newest first. */
data class MemberCursor(
    val joinedAt: Instant,
    val id: UUID,
)

/** The caller's own memberships, for `GET /me/campus`. Logo is a storage path here. */
data class OwnStudentMembership(
    val orgId: UUID,
    val orgName: String,
    val logoPath: String?,
    val batchId: UUID,
    val batchName: String,
    val rollNumber: String?,
)

data class OwnStaffMembership(
    val orgId: UUID,
    val orgName: String,
    val logoPath: String?,
    val role: String,
)

/**
 * Memberships of a college and faculty scopes. Only `joined` memberships are listed or
 * acted on; ended ones are history. Every statement binds `scope.orgId`, except the two
 * `/me/campus` lookups, which are by the caller's own user id and nothing else.
 */
@Repository
class MemberRepository(
    private val jdbc: JdbcClient,
) {
    fun list(
        scope: OrgScope,
        filter: MemberFilter,
        after: MemberCursor?,
        limit: Int,
    ): List<MemberRow> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val pattern = filter.query?.let { "%" + escapeLike(it) + "%" }
        val filters =
            buildString {
                // A faculty member sees the students of their batches, and no staff.
                if (visible != null) append(" and m.role = 'student' and m.batch_id in (:visible)")
                if (filter.role != null) append(" and m.role = :role")
                if (filter.batchId != null) append(" and m.batch_id = :batchId")
                if (filter.departmentId != null) append(" and b.department_id = :departmentId")
                if (pattern != null) {
                    append(" and (u.display_name ilike :q escape '\\' or u.email ilike :q escape '\\'")
                    append(" or m.roll_number ilike :q escape '\\')")
                }
                if (after != null) append(" and (m.joined_at, m.id) < (:afterAt, :afterId)")
            }
        val statement =
            jdbc
                .sql(
                    """
                    $MEMBER_SELECT
                     where m.org_id = :orgId and m.status = 'joined'$filters
                     order by m.joined_at desc, m.id desc
                     limit :limit
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("limit", limit)
        if (visible != null) statement.param("visible", visible.toList())
        filter.role?.let { statement.param("role", it.dbValue) }
        filter.batchId?.let { statement.param("batchId", it) }
        filter.departmentId?.let { statement.param("departmentId", it) }
        pattern?.let { statement.param("q", it) }
        if (after != null) {
            statement.param("afterAt", OffsetDateTime.ofInstant(after.joinedAt, ZoneOffset.UTC))
            statement.param("afterId", after.id)
        }
        return statement.query { rs, _ -> rs.toMember() }.list()
    }

    /** A joined membership of this college that the scope may see; null otherwise. */
    fun find(
        scope: OrgScope,
        id: UUID,
    ): MemberRow? {
        val row =
            jdbc
                .sql(
                    """
                    $MEMBER_SELECT
                     where m.org_id = :orgId and m.id = :id and m.status = 'joined'
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("id", id)
                .query { rs, _ -> rs.toMember() }
                .optional()
                .orElse(null) ?: return null
        if (scope.isNarrowed) {
            val batch = row.view.batchId
            if (row.role != CampusRole.STUDENT || batch == null || !scope.canSeeBatch(batch)) return null
        }
        return row
    }

    fun rollNumberTaken(
        scope: OrgScope,
        rollNumber: String,
        exceptId: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                select count(*) from public.org_members
                 where org_id = :orgId and roll_number = :roll and status = 'joined' and id <> :id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("roll", rollNumber)
            .param("id", exceptId)
            .query(Long::class.java)
            .single() > 0

    fun updateStudent(
        scope: OrgScope,
        id: UUID,
        batchId: UUID,
        rollNumber: String?,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.org_members set batch_id = :batchId, roll_number = :roll
                 where org_id = :orgId and id = :id and status = 'joined' and role = 'student'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .param("batchId", batchId)
            .param("roll", rollNumber)
            .update() > 0

    /** Ends the membership as `removed`; the person's account is untouched. */
    fun remove(
        scope: OrgScope,
        id: UUID,
    ): Boolean {
        deleteFacultyScopes(scope, id)
        return jdbc
            .sql(
                """
                update public.org_members set status = 'removed', ended_at = now()
                 where org_id = :orgId and id = :id and status = 'joined'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .update() > 0
    }

    /** The caller leaving on their own. Only their own joined student membership matches. */
    fun leave(scope: OrgScope): Boolean {
        val memberId = scope.memberId ?: return false
        return jdbc
            .sql(
                """
                update public.org_members set status = 'left', ended_at = now()
                 where org_id = :orgId and id = :id and user_id = :userId
                   and status = 'joined' and role = 'student'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", memberId)
            .param("userId", scope.actorUserId)
            .update() > 0
    }

    fun changeStaffRole(
        scope: OrgScope,
        id: UUID,
        role: CampusRole,
    ): Boolean {
        require(role.isStaff) { "Only staff roles change here" }
        if (role != CampusRole.FACULTY) deleteFacultyScopes(scope, id)
        return jdbc
            .sql(
                """
                update public.org_members set role = :role
                 where org_id = :orgId and id = :id and status = 'joined' and role <> 'student'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .param("role", role.dbValue)
            .update() > 0
    }

    fun countCollegeAdmins(scope: OrgScope): Long =
        jdbc
            .sql(
                """
                select count(*) from public.org_members
                 where org_id = :orgId and status = 'joined' and role = 'college_admin'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .query(Long::class.java)
            .single()

    // -- faculty scopes --------------------------------------------------------

    fun facultyScopes(
        scope: OrgScope,
        memberId: UUID,
    ): FacultyScopesView {
        val rows =
            jdbc
                .sql(
                    """
                    select department_id, batch_id from public.org_faculty_scopes
                     where org_id = :orgId and member_id = :memberId
                     order by created_at, coalesce(department_id, batch_id)
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("memberId", memberId)
                .query { rs, _ -> rs.getString("department_id") to rs.getString("batch_id") }
                .list()
        return FacultyScopesView(
            departmentIds = rows.mapNotNull { it.first?.let(UUID::fromString) },
            batchIds = rows.mapNotNull { it.second?.let(UUID::fromString) },
        )
    }

    /** How many of [ids] are departments of this college. */
    fun countDepartments(
        scope: OrgScope,
        ids: Set<UUID>,
    ): Int {
        if (ids.isEmpty()) return 0
        return jdbc
            .sql("select count(*) from public.org_departments where org_id = :orgId and id in (:ids)")
            .param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query(Int::class.java)
            .single()
    }

    /** How many of [ids] are batches of this college. */
    fun countBatches(
        scope: OrgScope,
        ids: Set<UUID>,
    ): Int {
        if (ids.isEmpty()) return 0
        return jdbc
            .sql("select count(*) from public.org_batches where org_id = :orgId and id in (:ids)")
            .param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query(Int::class.java)
            .single()
    }

    fun replaceFacultyScopes(
        scope: OrgScope,
        memberId: UUID,
        departmentIds: Set<UUID>,
        batchIds: Set<UUID>,
    ) {
        deleteFacultyScopes(scope, memberId)
        for (departmentId in departmentIds) {
            jdbc
                .sql(
                    """
                    insert into public.org_faculty_scopes (org_id, member_id, department_id)
                    values (:orgId, :memberId, :departmentId)
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("memberId", memberId)
                .param("departmentId", departmentId)
                .update()
        }
        for (batchId in batchIds) {
            jdbc
                .sql(
                    """
                    insert into public.org_faculty_scopes (org_id, member_id, batch_id)
                    values (:orgId, :memberId, :batchId)
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("memberId", memberId)
                .param("batchId", batchId)
                .update()
        }
    }

    private fun deleteFacultyScopes(
        scope: OrgScope,
        memberId: UUID,
    ) {
        jdbc
            .sql("delete from public.org_faculty_scopes where org_id = :orgId and member_id = :memberId")
            .param("orgId", scope.orgId)
            .param("memberId", memberId)
            .update()
    }

    // -- the caller's own memberships -------------------------------------------

    fun ownStudentMembership(userId: UUID): OwnStudentMembership? =
        jdbc
            .sql(
                """
                /* unscoped: own-membership */
                select o.id as org_id, o.name as org_name, o.logo_path, b.id as batch_id, b.name as batch_name, m.roll_number
                  from public.org_members m
                  join public.organisations o on o.id = m.org_id
                  join public.org_batches b on b.org_id = m.org_id and b.id = m.batch_id
                 where m.user_id = :userId and m.role = 'student' and m.status = 'joined' and o.status = 'active'
                """.trimIndent(),
            ).param("userId", userId)
            .query { rs, _ ->
                OwnStudentMembership(
                    orgId = UUID.fromString(rs.getString("org_id")),
                    orgName = rs.getString("org_name"),
                    logoPath = rs.getString("logo_path"),
                    batchId = UUID.fromString(rs.getString("batch_id")),
                    batchName = rs.getString("batch_name"),
                    rollNumber = rs.getString("roll_number"),
                )
            }.optional()
            .orElse(null)

    fun ownStaffMemberships(userId: UUID): List<OwnStaffMembership> =
        jdbc
            .sql(
                """
                /* unscoped: own-membership */
                select o.id as org_id, o.name as org_name, o.logo_path, m.role
                  from public.org_members m
                  join public.organisations o on o.id = m.org_id
                 where m.user_id = :userId and m.role <> 'student' and m.status = 'joined' and o.status = 'active'
                 order by o.name, o.id
                """.trimIndent(),
            ).param("userId", userId)
            .query { rs, _ ->
                OwnStaffMembership(
                    orgId = UUID.fromString(rs.getString("org_id")),
                    orgName = rs.getString("org_name"),
                    logoPath = rs.getString("logo_path"),
                    role = rs.getString("role"),
                )
            }.list()

    private fun ResultSet.toMember(): MemberRow {
        val role = CampusRole.fromDbValue(getString("role")) ?: error("Unknown campus role in org_members")
        val joinedAt = getTimestamp("joined_at").toInstant()
        return MemberRow(
            view =
                MemberView(
                    id = UUID.fromString(getString("id")),
                    name = getString("display_name"),
                    email = getString("email"),
                    role = role.dbValue,
                    batchId = getString("batch_id")?.let(UUID::fromString),
                    batchName = getString("batch_name"),
                    departmentCode = getString("department_code"),
                    rollNumber = getString("roll_number"),
                    joinedAt = joinedAt.toString(),
                    active = getBoolean("active"),
                ),
            userId = UUID.fromString(getString("user_id")),
            role = role,
            joinedAt = joinedAt,
        )
    }

    private fun escapeLike(value: String): String = value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")

    private companion object {
        /**
         * Active is derived, never stored (campus spec §3): a round created, a scenario step
         * answered, or an Arena card reviewed in the last 14 days.
         */
        const val MEMBER_SELECT = """select m.id, m.user_id, u.display_name, u.email, m.role, m.batch_id,
                   b.name as batch_name, d.code as department_code, m.roll_number, m.joined_at,
                   (exists (select 1 from public.sessions s
                             where s.user_id = m.user_id and s.created_at > now() - interval '14 days')
                    or exists (select 1 from public.user_step_answers a
                                where a.user_id = m.user_id and a.answered_at > now() - interval '14 days')
                    or exists (select 1 from public.arena_cards c
                                where c.user_id = m.user_id and c.last_review > now() - interval '14 days')) as active
              from public.org_members m
              join public.users u on u.id = m.user_id
              left join public.org_batches b on b.org_id = m.org_id and b.id = m.batch_id
              left join public.org_departments d on d.org_id = b.org_id and d.id = b.department_id"""
    }
}
