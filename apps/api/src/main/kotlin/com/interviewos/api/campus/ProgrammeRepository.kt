package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.LocalDate
import java.util.UUID

/** A programme template as stored; [modulesJson] is the validated module list. */
data class ProgrammeTemplateRow(
    val id: UUID,
    val title: String,
    val description: String,
    val weeks: Int,
    val modulesJson: String,
    val createdAt: Instant,
)

data class ProgrammeRow(
    val id: UUID,
    val templateId: UUID?,
    val title: String,
    val startsOn: LocalDate,
    val weeks: Int,
    val status: String,
)

/** One assignment a programme was cloned into. */
data class ProgrammeAssignmentRow(
    val id: UUID,
    val programmeId: UUID,
    val week: Int,
    val kind: AssignmentKind,
)

/** What a certificate prints about the student and the college. */
data class CertificateHead(
    val studentName: String?,
    val email: String,
    val orgName: String,
    val logoPath: String?,
)

/**
 * Programme templates (global, platform-owned) and each college's programmes (campus spec §10).
 *
 * Templates are the one deliberately unscoped part of campus: they belong to no college, every
 * college reads the same catalogue, and only a platform admin writes it (the write methods need
 * a [PlatformAdmin] proof). Everything else binds `scope.orgId`, and a faculty member sees a
 * programme only when it targets one of their batches.
 */
@Repository
class ProgrammeRepository(
    private val jdbc: JdbcClient,
) {
    // -- templates --------------------------------------------------------------------

    fun templates(): List<ProgrammeTemplateRow> =
        jdbc
            .sql(
                """
                /* unscoped: programme-templates */
                select id, title, description, weeks, modules::text as modules, created_at
                  from public.programme_templates
                 order by title, created_at, id
                """.trimIndent(),
            ).query { rs, _ -> rs.toTemplate() }
            .list()

    fun template(id: UUID): ProgrammeTemplateRow? =
        jdbc
            .sql(
                """
                /* unscoped: programme-templates */
                select id, title, description, weeks, modules::text as modules, created_at
                  from public.programme_templates
                 where id = :id
                """.trimIndent(),
            ).param("id", id)
            .query { rs, _ -> rs.toTemplate() }
            .optional()
            .orElse(null)

    fun insertTemplate(
        admin: PlatformAdmin,
        title: String,
        description: String,
        weeks: Int,
        modulesJson: String,
    ): UUID =
        jdbc
            .sql(
                """
                /* unscoped: programme-templates */
                insert into public.programme_templates (title, description, weeks, modules, created_by)
                values (:title, :description, :weeks, cast(:modules as jsonb), :createdBy)
                returning id
                """.trimIndent(),
            ).param("title", title)
            .param("description", description)
            .param("weeks", weeks)
            .param("modules", modulesJson)
            .param("createdBy", admin.userId)
            .query(UUID::class.java)
            .single()

    @Suppress("UNUSED_PARAMETER")
    fun updateTemplate(
        admin: PlatformAdmin,
        id: UUID,
        title: String,
        description: String,
        weeks: Int,
        modulesJson: String,
    ): Boolean =
        jdbc
            .sql(
                """
                /* unscoped: programme-templates */
                update public.programme_templates
                   set title = :title, description = :description, weeks = :weeks, modules = cast(:modules as jsonb)
                 where id = :id
                """.trimIndent(),
            ).param("id", id)
            .param("title", title)
            .param("description", description)
            .param("weeks", weeks)
            .param("modules", modulesJson)
            .update() == 1

    @Suppress("UNUSED_PARAMETER")
    fun deleteTemplate(
        admin: PlatformAdmin,
        id: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                /* unscoped: programme-templates */
                delete from public.programme_templates where id = :id
                """.trimIndent(),
            ).param("id", id)
            .update() == 1

    // -- programmes -----------------------------------------------------------------------

    fun insertProgramme(
        scope: OrgScope,
        templateId: UUID,
        title: String,
        startsOn: LocalDate,
        weeks: Int,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.programmes (org_id, template_id, title, starts_on, weeks, created_by_member_id)
                values (:orgId, :templateId, :title, :startsOn, :weeks, :createdBy)
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("templateId", templateId)
            .param("title", title)
            .param("startsOn", startsOn)
            .param("weeks", weeks)
            .param("createdBy", scope.memberId)
            .query(UUID::class.java)
            .single()

    fun insertTargets(
        scope: OrgScope,
        programmeId: UUID,
        batchIds: Collection<UUID>,
    ) {
        for (batchId in batchIds) {
            jdbc
                .sql("insert into public.programme_targets (org_id, programme_id, batch_id) values (:orgId, :programmeId, :batchId)")
                .param("orgId", scope.orgId)
                .param("programmeId", programmeId)
                .param("batchId", batchId)
                .update()
        }
    }

    /** The college's programmes, newest start first; a faculty member's only when they target their batches. */
    fun list(scope: OrgScope): List<ProgrammeRow> = select(scope, null)

    fun find(
        scope: OrgScope,
        id: UUID,
    ): ProgrammeRow? = select(scope, id).singleOrNull()

    /** Serialises writes to one programme, so two archives cannot interleave. */
    fun lock(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql("select id from public.programmes where org_id = :orgId and id = :id for update")
            .param("orgId", scope.orgId)
            .param("id", id)
            .query(UUID::class.java)
            .optional()
            .isPresent

    fun archive(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.programmes set status = 'archived', archived_at = now()
                 where org_id = :orgId and id = :id and status <> 'archived'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .update() == 1

    /** Targets of [ids], narrowed to the batches the caller may see. */
    fun targets(
        scope: OrgScope,
        ids: Collection<UUID>,
    ): Map<UUID, List<TargetBatchView>> {
        if (ids.isEmpty()) return emptyMap()
        val found = mutableMapOf<UUID, MutableList<TargetBatchView>>()
        jdbc
            .sql(
                """
                select t.programme_id, b.id, b.name
                  from public.programme_targets t
                  join public.org_batches b on b.org_id = t.org_id and b.id = t.batch_id
                 where t.org_id = :orgId and t.programme_id in (:ids)
                 order by b.name, b.id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query { rs, _ ->
                val batchId = UUID.fromString(rs.getString("id"))
                if (scope.canSeeBatch(batchId)) {
                    found.getOrPut(UUID.fromString(rs.getString("programme_id")), ::mutableListOf) +=
                        TargetBatchView(batchId, rs.getString("name"))
                }
            }.list()
        return ids.associateWith { found[it].orEmpty() }
    }

    /** Every assignment of [ids], by week. Archived ones included: a module is a module. */
    fun assignments(
        scope: OrgScope,
        ids: Collection<UUID>,
    ): Map<UUID, List<ProgrammeAssignmentRow>> {
        if (ids.isEmpty()) return emptyMap()
        return jdbc
            .sql(
                """
                select x.id, x.programme_id, x.programme_week, x.kind
                  from public.assignments x
                 where x.org_id = :orgId and x.programme_id in (:ids)
                 order by x.programme_week, x.opens_at, x.id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query { rs, _ ->
                ProgrammeAssignmentRow(
                    id = UUID.fromString(rs.getString("id")),
                    programmeId = UUID.fromString(rs.getString("programme_id")),
                    week = rs.getInt("programme_week"),
                    kind = AssignmentKind.fromDbValue(rs.getString("kind")) ?: error("Unknown assignment kind"),
                )
            }.list()
            .groupBy { it.programmeId }
    }

    /** Programmes that target this joined student's batch. */
    fun forStudent(
        scope: OrgScope,
        memberId: UUID,
    ): List<ProgrammeRow> =
        jdbc
            .sql(
                """
                select p.id, p.template_id, p.title, p.starts_on, p.weeks, p.status
                  from public.programmes p
                  join public.org_members m
                    on m.org_id = p.org_id and m.id = :memberId and m.role = 'student' and m.status = 'joined'
                 where p.org_id = :orgId
                   and exists (select 1 from public.programme_targets t
                                where t.org_id = p.org_id and t.programme_id = p.id and t.batch_id = m.batch_id)
                 order by p.starts_on desc, p.id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("memberId", memberId)
            .query { rs, _ -> rs.toProgramme() }
            .list()

    /**
     * When the student completed each of [assignmentIds]: an interview at its first completed
     * attempt's end, a scenario set at its last answer. A certificate's date is the latest of
     * these, so it never moves once earned.
     */
    fun completionTimes(
        scope: OrgScope,
        memberId: UUID,
        userId: UUID,
        assignmentIds: Collection<UUID>,
    ): Map<UUID, Instant> {
        if (assignmentIds.isEmpty()) return emptyMap()
        return jdbc
            .sql(
                """
                select a.assignment_id as id, min(a.ended_at) as at
                  from public.assignment_attempts a
                 where a.org_id = :orgId and a.member_id = :memberId and a.assignment_id in (:ids) and a.status = 'completed'
                 group by a.assignment_id
                union all
                select x.id, max(ans.answered_at)
                  from public.assignments x
                  join public.arena_scenario_steps st on st.scenario_id = any(x.scenario_ids)
                  join public.user_step_answers ans on ans.step_id = st.id and ans.user_id = :userId
                 where x.org_id = :orgId and x.id in (:ids) and x.kind = 'arena_scenarios'
                 group by x.id
                union all
                select q.assignment_id, min(q.submitted_at)
                  from public.mcq_attempts q
                 where q.org_id = :orgId and q.member_id = :memberId and q.assignment_id in (:ids) and q.submitted_at is not null
                 group by q.assignment_id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("memberId", memberId)
            .param("userId", userId)
            .param("ids", assignmentIds.toList())
            .query { rs, _ -> UUID.fromString(rs.getString("id")) to rs.getTimestamp("at")?.toInstant() }
            .list()
            .mapNotNull { (id, at) -> at?.let { id to it } }
            .toMap()
    }

    fun certificateHead(
        scope: OrgScope,
        memberId: UUID,
    ): CertificateHead? =
        jdbc
            .sql(
                """
                select u.display_name, u.email, o.name as org_name, o.logo_path
                  from public.org_members m
                  join public.users u on u.id = m.user_id
                  join public.organisations o on o.id = m.org_id
                 where m.org_id = :orgId and m.id = :memberId and m.role = 'student' and m.status = 'joined'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("memberId", memberId)
            .query { rs, _ ->
                CertificateHead(rs.getString("display_name"), rs.getString("email"), rs.getString("org_name"), rs.getString("logo_path"))
            }.optional()
            .orElse(null)

    private fun select(
        scope: OrgScope,
        id: UUID?,
    ): List<ProgrammeRow> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val narrow =
            if (visible == null) {
                ""
            } else {
                " and exists (select 1 from public.programme_targets t where t.org_id = :orgId" +
                    " and t.programme_id = p.id and t.batch_id in (:visible))"
            }
        val statement =
            jdbc
                .sql(
                    """
                    select p.id, p.template_id, p.title, p.starts_on, p.weeks, p.status
                      from public.programmes p
                     where p.org_id = :orgId${if (id != null) " and p.id = :id" else ""}$narrow
                     order by p.starts_on desc, p.created_at desc, p.id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        id?.let { statement.param("id", it) }
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query { rs, _ -> rs.toProgramme() }.list()
    }

    private fun ResultSet.toTemplate() =
        ProgrammeTemplateRow(
            id = UUID.fromString(getString("id")),
            title = getString("title"),
            description = getString("description"),
            weeks = getInt("weeks"),
            modulesJson = getString("modules"),
            createdAt = getTimestamp("created_at").toInstant(),
        )

    private fun ResultSet.toProgramme() =
        ProgrammeRow(
            id = UUID.fromString(getString("id")),
            templateId = getString("template_id")?.let(UUID::fromString),
            title = getString("title"),
            startsOn = getDate("starts_on").toLocalDate(),
            weeks = getInt("weeks"),
            status = getString("status"),
        )
}
