package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.util.UUID

/**
 * A college's departments and batches. Every statement binds `scope.orgId`, and an id from a
 * path is only ever looked up together with it, so another college's id is simply not found.
 * Faculty narrowing is applied here as well as in the service: a list or a lookup by a
 * narrowed scope never returns a department or batch outside it.
 */
@Repository
class StructureRepository(
    private val jdbc: JdbcClient,
) {
    // -- departments -----------------------------------------------------------

    fun listDepartments(scope: OrgScope): List<DepartmentView> {
        val visible = scope.visibleDepartmentIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val filter = if (visible != null) "and d.id in (:visible)" else ""
        val statement =
            jdbc
                .sql(
                    """
                    select d.id, d.code, d.name,
                           (select count(*) from public.org_batches b
                             where b.org_id = :orgId and b.department_id = d.id) as batch_count
                      from public.org_departments d
                     where d.org_id = :orgId $filter
                     order by d.code
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query { rs, _ -> rs.toDepartment() }.list()
    }

    fun findDepartment(
        scope: OrgScope,
        id: UUID,
    ): DepartmentView? {
        if (!scope.canSeeDepartment(id)) return null
        return jdbc
            .sql(
                """
                select d.id, d.code, d.name,
                       (select count(*) from public.org_batches b
                         where b.org_id = :orgId and b.department_id = d.id) as batch_count
                  from public.org_departments d
                 where d.org_id = :orgId and d.id = :id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .query { rs, _ -> rs.toDepartment() }
            .optional()
            .orElse(null)
    }

    /** Null when the code is already taken in this college. */
    fun createDepartment(
        scope: OrgScope,
        code: String,
        name: String,
    ): UUID? =
        jdbc
            .sql(
                """
                insert into public.org_departments (org_id, code, name)
                values (:orgId, :code, :name)
                on conflict (org_id, code) do nothing
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("code", code)
            .param("name", name)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    fun departmentCodeTaken(
        scope: OrgScope,
        code: String,
        exceptId: UUID,
    ): Boolean =
        jdbc
            .sql("select count(*) from public.org_departments where org_id = :orgId and code = :code and id <> :id")
            .param("orgId", scope.orgId)
            .param("code", code)
            .param("id", exceptId)
            .query(Long::class.java)
            .single() > 0

    fun updateDepartment(
        scope: OrgScope,
        id: UUID,
        code: String,
        name: String,
    ): Boolean =
        jdbc
            .sql("update public.org_departments set code = :code, name = :name where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .param("code", code)
            .param("name", name)
            .update() > 0

    fun deleteDepartment(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql("delete from public.org_departments where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update() > 0

    // -- batches ---------------------------------------------------------------

    fun listBatches(
        scope: OrgScope,
        departmentId: UUID?,
    ): List<BatchView> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val filters =
            buildString {
                if (departmentId != null) append(" and b.department_id = :departmentId")
                if (visible != null) append(" and b.id in (:visible)")
            }
        val statement =
            jdbc
                .sql(
                    """
                    select b.id, b.department_id, d.code as department_code, b.graduation_year, b.name,
                           (select count(*) from public.org_members m
                             where m.org_id = :orgId and m.batch_id = b.id
                               and m.status = 'joined' and m.role = 'student') as student_count
                      from public.org_batches b
                      join public.org_departments d on d.org_id = b.org_id and d.id = b.department_id
                     where b.org_id = :orgId$filters
                     order by b.graduation_year desc, b.name
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        if (departmentId != null) statement.param("departmentId", departmentId)
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query { rs, _ -> rs.toBatch() }.list()
    }

    fun findBatch(
        scope: OrgScope,
        id: UUID,
    ): BatchView? {
        if (!scope.canSeeBatch(id)) return null
        return jdbc
            .sql(
                """
                select b.id, b.department_id, d.code as department_code, b.graduation_year, b.name,
                       (select count(*) from public.org_members m
                         where m.org_id = :orgId and m.batch_id = b.id
                           and m.status = 'joined' and m.role = 'student') as student_count
                  from public.org_batches b
                  join public.org_departments d on d.org_id = b.org_id and d.id = b.department_id
                 where b.org_id = :orgId and b.id = :id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .query { rs, _ -> rs.toBatch() }
            .optional()
            .orElse(null)
    }

    /** Null when the name is already taken in this college. */
    fun createBatch(
        scope: OrgScope,
        departmentId: UUID,
        graduationYear: Int,
        name: String,
    ): UUID? =
        jdbc
            .sql(
                """
                insert into public.org_batches (org_id, department_id, graduation_year, name)
                values (:orgId, :departmentId, :year, :name)
                on conflict (org_id, name) do nothing
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("departmentId", departmentId)
            .param("year", graduationYear)
            .param("name", name)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    fun batchNameTaken(
        scope: OrgScope,
        name: String,
        exceptId: UUID,
    ): Boolean =
        jdbc
            .sql("select count(*) from public.org_batches where org_id = :orgId and name = :name and id <> :id")
            .param("orgId", scope.orgId)
            .param("name", name)
            .param("id", exceptId)
            .query(Long::class.java)
            .single() > 0

    fun updateBatch(
        scope: OrgScope,
        id: UUID,
        graduationYear: Int,
        name: String,
    ): Boolean =
        jdbc
            .sql("update public.org_batches set graduation_year = :year, name = :name where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .param("year", graduationYear)
            .param("name", name)
            .update() > 0

    /**
     * Any membership row — joined, left or removed — still names its batch, and the foreign
     * key keeps it, so a batch that ever had a student cannot be deleted. Nor can one with an
     * open invite, which would otherwise vanish with it; closed invites are deleted along.
     */
    fun batchHasMembers(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                select (select count(*) from public.org_members where org_id = :orgId and batch_id = :id)
                     + (select count(*) from public.campus_invites where org_id = :orgId and batch_id = :id and status = 'invited')
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .query(Long::class.java)
            .single() > 0

    fun deleteBatch(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql("delete from public.org_batches where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update() > 0

    private fun ResultSet.toDepartment() =
        DepartmentView(
            id = UUID.fromString(getString("id")),
            code = getString("code"),
            name = getString("name"),
            batchCount = getInt("batch_count"),
        )

    private fun ResultSet.toBatch() =
        BatchView(
            id = UUID.fromString(getString("id")),
            departmentId = UUID.fromString(getString("department_id")),
            departmentCode = getString("department_code"),
            graduationYear = getInt("graduation_year"),
            name = getString("name"),
            studentCount = getInt("student_count"),
        )
}
