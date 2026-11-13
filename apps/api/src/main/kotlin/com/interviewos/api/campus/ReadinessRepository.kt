package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

/** Which students a readiness read covers, inside the caller's [OrgScope]. */
data class ReadinessFilter(
    val batchId: UUID? = null,
    val departmentId: UUID? = null,
    val memberId: UUID? = null,
)

/** A joined student as the readiness screens show them. */
data class ReadinessStudentRow(
    val memberId: UUID,
    val userId: UUID,
    val name: String?,
    val rollNumber: String?,
    val batchId: UUID,
    val batchName: String,
    val departmentId: UUID,
    val departmentCode: String,
    /**
     * The latest round created, scenario step answered or Arena card reviewed — the same three
     * signals module 3's `active` is derived from, so the two never disagree.
     */
    val lastActiveAt: Instant?,
)

/**
 * A completed attempt at one of this college's interview assignments that has a report. The
 * payload holds only the report's three scoring fields, not the report itself.
 */
data class InterviewEvidenceRow(
    val assignmentId: UUID,
    val memberId: UUID,
    val sessionId: UUID,
    val title: String,
    val component: String,
    val topic: String?,
    val completedAt: Instant,
    val scoringPayloadJson: String,
)

/** A published or archived assignment, with what readiness and completion read from it. */
data class ReadinessAssignmentRow(
    val id: UUID,
    val kind: AssignmentKind,
    val title: String,
    val component: String,
    val topic: String?,
    val status: String,
    val dueAt: Instant,
    val allowLate: Boolean,
    /** Null is read as already open. */
    val opensAt: Instant? = null,
)

/** A batch in scope, as the overview's per-batch rows name it. */
data class ReadinessBatchRow(
    val id: UUID,
    val name: String,
    val departmentId: UUID,
    val departmentCode: String,
)

/**
 * The reads behind campus readiness and the placement dashboard (campus spec §6–7). Each method
 * reads its rows for the whole scope in one statement, so a 600-student batch costs the same few
 * round trips as one student; the arithmetic happens in [ReadinessCalculator].
 *
 * Every statement binds `scope.orgId`, and a faculty member's reads are narrowed to their
 * batches here, from the scope, as [MemberRepository] does. Nothing here reads a student's own
 * practice: interview evidence is only ever an attempt at one of this college's assignments.
 */
@Repository
class ReadinessRepository(
    private val jdbc: JdbcClient,
) {
    // -- weights ---------------------------------------------------------------------

    fun weights(scope: OrgScope): ReadinessWeightSet =
        jdbc
            .sql(
                """
                select readiness_weight_coding, readiness_weight_core_cs, readiness_weight_technical_interview,
                       readiness_weight_communication, readiness_weight_aptitude
                  from public.organisations
                 where id = :orgId
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .query { rs, _ ->
                ReadinessWeightSet(
                    coding = rs.getInt("readiness_weight_coding"),
                    coreCs = rs.getInt("readiness_weight_core_cs"),
                    technicalInterview = rs.getInt("readiness_weight_technical_interview"),
                    communication = rs.getInt("readiness_weight_communication"),
                    aptitude = rs.getInt("readiness_weight_aptitude"),
                )
            }.optional()
            .orElse(ReadinessWeightSet.DEFAULT)

    fun updateWeights(
        scope: OrgScope,
        weights: ReadinessWeightSet,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.organisations
                   set readiness_weight_coding = :coding, readiness_weight_core_cs = :coreCs,
                       readiness_weight_technical_interview = :technicalInterview,
                       readiness_weight_communication = :communication, readiness_weight_aptitude = :aptitude
                 where id = :orgId
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("coding", weights.coding)
            .param("coreCs", weights.coreCs)
            .param("technicalInterview", weights.technicalInterview)
            .param("communication", weights.communication)
            .param("aptitude", weights.aptitude)
            .update() == 1

    // -- filters -----------------------------------------------------------------------

    /** The department of a batch of this college, or null when the batch is not this college's. */
    fun batchDepartment(
        scope: OrgScope,
        batchId: UUID,
    ): UUID? =
        jdbc
            .sql("select department_id from public.org_batches where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", batchId)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    fun departmentExists(
        scope: OrgScope,
        departmentId: UUID,
    ): Boolean =
        jdbc
            .sql("select count(*) from public.org_departments where org_id = :orgId and id = :id")
            .param("orgId", scope.orgId)
            .param("id", departmentId)
            .query(Long::class.java)
            .single() > 0

    // -- students ----------------------------------------------------------------------

    /** Joined students in scope, in a stable order (batch, roll number, name, id). */
    fun students(
        scope: OrgScope,
        filter: ReadinessFilter,
    ): List<ReadinessStudentRow> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val statement =
            jdbc
                .sql(
                    """
                    select m.id, m.user_id, u.display_name, m.roll_number, b.id as batch_id, b.name as batch_name,
                           d.id as department_id, d.code as department_code,
                           greatest(
                               (select max(s.created_at) from public.sessions s where s.user_id = m.user_id),
                               (select max(a.answered_at) from public.user_step_answers a where a.user_id = m.user_id),
                               (select max(c.last_review) from public.arena_cards c where c.user_id = m.user_id)
                           ) as last_active_at
                      from public.org_members m
                      join public.users u on u.id = m.user_id
                      join public.org_batches b on b.org_id = m.org_id and b.id = m.batch_id
                      join public.org_departments d on d.org_id = b.org_id and d.id = b.department_id
                     where m.org_id = :orgId and m.role = 'student' and m.status = 'joined'${memberFilters(visible, filter)}
                     order by b.name, m.roll_number nulls last, u.display_name nulls last, m.id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        bindFilters(statement, visible, filter)
        return statement
            .query { rs, _ ->
                ReadinessStudentRow(
                    memberId = UUID.fromString(rs.getString("id")),
                    userId = UUID.fromString(rs.getString("user_id")),
                    name = rs.getString("display_name"),
                    rollNumber = rs.getString("roll_number"),
                    batchId = UUID.fromString(rs.getString("batch_id")),
                    batchName = rs.getString("batch_name"),
                    departmentId = UUID.fromString(rs.getString("department_id")),
                    departmentCode = rs.getString("department_code"),
                    lastActiveAt = rs.getTimestamp("last_active_at")?.toInstant(),
                )
            }.list()
    }

    /**
     * Student invites still open (not accepted, revoked or lapsed) for batches in scope: the
     * part of "enrolled" that has not joined yet.
     */
    fun openStudentInvites(
        scope: OrgScope,
        filter: ReadinessFilter,
    ): Int {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return 0
        val statement =
            jdbc
                .sql(
                    """
                    select count(*)
                      from public.campus_invites i
                      join public.org_batches b on b.org_id = i.org_id and b.id = i.batch_id
                     where i.org_id = :orgId and i.role = 'student' and i.status = 'invited'
                       and i.expires_at > now()${inviteFilters(visible, filter)}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        bindInviteFilters(statement, visible, filter)
        return statement.query(Int::class.java).single()
    }

    /**
     * People ever invited as students to batches in scope — open, joined or lapsed, not revoked —
     * counted once per email address, so an invite that was renewed is still one person.
     */
    fun invitedStudents(
        scope: OrgScope,
        filter: ReadinessFilter,
    ): Int {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return 0
        val statement =
            jdbc
                .sql(
                    """
                    select count(distinct i.email)
                      from public.campus_invites i
                      join public.org_batches b on b.org_id = i.org_id and b.id = i.batch_id
                     where i.org_id = :orgId and i.role = 'student'
                       and i.status in ('invited', 'joined', 'expired')${inviteFilters(visible, filter)}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        bindInviteFilters(statement, visible, filter)
        return statement.query(Int::class.java).single()
    }

    /** Every batch in scope, empty ones included, by department code then name. */
    fun batches(
        scope: OrgScope,
        filter: ReadinessFilter,
    ): List<ReadinessBatchRow> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val filters =
            buildString {
                if (visible != null) append(" and b.id in (:visible)")
                if (filter.batchId != null) append(" and b.id = :batchId")
                if (filter.departmentId != null) append(" and b.department_id = :departmentId")
            }
        val statement =
            jdbc
                .sql(
                    """
                    select b.id, b.name, d.id as department_id, d.code as department_code
                      from public.org_batches b
                      join public.org_departments d on d.org_id = b.org_id and d.id = b.department_id
                     where b.org_id = :orgId$filters
                     order by d.code, b.name, b.id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        if (visible != null) statement.param("visible", visible.toList())
        filter.batchId?.let { statement.param("batchId", it) }
        filter.departmentId?.let { statement.param("departmentId", it) }
        return statement
            .query { rs, _ ->
                ReadinessBatchRow(
                    id = UUID.fromString(rs.getString("id")),
                    name = rs.getString("name"),
                    departmentId = UUID.fromString(rs.getString("department_id")),
                    departmentCode = rs.getString("department_code"),
                )
            }.list()
    }

    // -- assignments and evidence --------------------------------------------------------

    /**
     * Every published or archived assignment of the college, whoever created it and whatever it
     * targets: which of them reach a student is decided by the recipients, so a student's
     * readiness reads the same to a faculty member as to the TPO. Drafts are never evidence.
     */
    fun assignments(scope: OrgScope): List<ReadinessAssignmentRow> =
        jdbc
            .sql(
                """
                select x.id, x.kind, x.title, x.readiness_component, x.topic, x.status, x.due_at, x.allow_late, x.opens_at
                  from public.assignments x
                 where x.org_id = :orgId and x.status in ('published', 'archived')
                 order by x.due_at, x.id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .query { rs, _ ->
                ReadinessAssignmentRow(
                    id = UUID.fromString(rs.getString("id")),
                    kind = AssignmentKind.fromDbValue(rs.getString("kind")) ?: error("Unknown assignment kind"),
                    title = rs.getString("title"),
                    component = rs.getString("readiness_component"),
                    topic = rs.getString("topic"),
                    status = rs.getString("status"),
                    dueAt = rs.getTimestamp("due_at").toInstant(),
                    allowLate = rs.getBoolean("allow_late"),
                    opensAt = rs.getTimestamp("opens_at")?.toInstant(),
                )
            }.list()

    /**
     * Completed attempts at this college's interview assignments, by students in scope, whose
     * session completed and has a report. The attempt is read directly, not through the
     * assignment's current recipients, so a student moved to another batch keeps the evidence
     * of the work they did.
     *
     * Only the report's scoring fields leave the database; the evidence threshold and the
     * score are applied by `ReportScore`, the same code the candidate's own readiness uses.
     */
    fun interviewEvidence(
        scope: OrgScope,
        filter: ReadinessFilter,
    ): List<InterviewEvidenceRow> {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val statement =
            jdbc
                .sql(
                    """
                    select a.assignment_id, a.member_id, a.session_id, x.title, x.readiness_component, x.topic,
                           coalesce(a.ended_at, s.ended_at) as completed_at,
                           jsonb_build_object(
                               'assessableTurns', r.payload -> 'assessableTurns',
                               'answeredTurns', r.payload -> 'answeredTurns',
                               'competencies', r.payload -> 'competencies'
                           )::text as scoring
                      from public.assignment_attempts a
                      join public.assignments x on x.org_id = a.org_id and x.id = a.assignment_id
                      join public.org_members m on m.org_id = a.org_id and m.id = a.member_id
                      join public.org_batches b on b.org_id = m.org_id and b.id = m.batch_id
                      join public.sessions s on s.id = a.session_id and s.user_id = m.user_id
                      join public.session_reports r on r.session_id = s.id and r.user_id = m.user_id
                     where a.org_id = :orgId and a.status = 'completed' and s.status = 'completed'
                       and x.kind = 'interview' and x.status in ('published', 'archived')
                       and m.role = 'student' and m.status = 'joined'${memberFilters(visible, filter)}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        bindFilters(statement, visible, filter)
        return statement.query { rs, _ -> rs.toEvidence() }.list()
    }

    /**
     * The student's user id when [sessionId] is the session of an attempt by [memberId] at one
     * of this college's assignments, and the student is in scope; null otherwise. A student's
     * personal round is never an attempt, so it can never be opened through here.
     */
    fun attemptSessionOwner(
        scope: OrgScope,
        memberId: UUID,
        sessionId: UUID,
    ): UUID? {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return null
        val statement =
            jdbc
                .sql(
                    """
                    select m.user_id
                      from public.assignment_attempts a
                      join public.assignments x on x.org_id = a.org_id and x.id = a.assignment_id
                      join public.org_members m on m.org_id = a.org_id and m.id = a.member_id
                      join public.sessions s on s.id = a.session_id and s.user_id = m.user_id
                     where a.org_id = :orgId and a.member_id = :memberId and a.session_id = :sessionId
                       and m.role = 'student' and m.status = 'joined'${if (visible != null) " and m.batch_id in (:visible)" else ""}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("memberId", memberId)
                .param("sessionId", sessionId)
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query(UUID::class.java).optional().orElse(null)
    }

    // -- helpers -------------------------------------------------------------------------

    private fun memberFilters(
        visible: Set<UUID>?,
        filter: ReadinessFilter,
    ): String =
        buildString {
            if (visible != null) append(" and m.batch_id in (:visible)")
            if (filter.batchId != null) append(" and m.batch_id = :batchId")
            if (filter.departmentId != null) append(" and b.department_id = :departmentId")
            if (filter.memberId != null) append(" and m.id = :memberId")
        }

    private fun inviteFilters(
        visible: Set<UUID>?,
        filter: ReadinessFilter,
    ): String =
        buildString {
            if (visible != null) append(" and i.batch_id in (:visible)")
            if (filter.batchId != null) append(" and i.batch_id = :batchId")
            if (filter.departmentId != null) append(" and b.department_id = :departmentId")
        }

    private fun bindInviteFilters(
        statement: JdbcClient.StatementSpec,
        visible: Set<UUID>?,
        filter: ReadinessFilter,
    ) {
        if (visible != null) statement.param("visible", visible.toList())
        filter.batchId?.let { statement.param("batchId", it) }
        filter.departmentId?.let { statement.param("departmentId", it) }
    }

    private fun bindFilters(
        statement: JdbcClient.StatementSpec,
        visible: Set<UUID>?,
        filter: ReadinessFilter,
    ) {
        if (visible != null) statement.param("visible", visible.toList())
        filter.batchId?.let { statement.param("batchId", it) }
        filter.departmentId?.let { statement.param("departmentId", it) }
        filter.memberId?.let { statement.param("memberId", it) }
    }

    private fun ResultSet.toEvidence(): InterviewEvidenceRow =
        InterviewEvidenceRow(
            assignmentId = UUID.fromString(getString("assignment_id")),
            memberId = UUID.fromString(getString("member_id")),
            sessionId = UUID.fromString(getString("session_id")),
            title = getString("title"),
            component = getString("readiness_component"),
            topic = getString("topic"),
            completedAt = getTimestamp("completed_at").toInstant(),
            scoringPayloadJson = getString("scoring"),
        )
}
