package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** An assignment as stored. */
data class AssignmentRow(
    val id: UUID,
    val kind: AssignmentKind,
    val title: String,
    val instructions: String?,
    val roundType: String?,
    val durationMinutes: Int?,
    val companyName: String?,
    val roleTitle: String?,
    val candidateStage: String?,
    val language: String,
    val focusTopic: String?,
    val scenarioIds: List<String>?,
    val opensAt: Instant,
    val dueAt: Instant,
    val allowLate: Boolean,
    val attemptLimit: Int,
    val interviewCap: Int?,
    val component: String,
    val topic: String?,
    val status: String,
    val createdAt: Instant,
    val publishedAt: Instant?,
    val createdByMemberId: UUID?,
    val createdByName: String?,
)

/** The writable columns, written together once the service has validated them. */
data class AssignmentFields(
    val kind: AssignmentKind,
    val title: String,
    val instructions: String?,
    val roundType: String?,
    val durationMinutes: Int?,
    val companyName: String?,
    val roleTitle: String?,
    val candidateStage: String?,
    val language: String,
    val focusTopic: String?,
    val scenarioIds: List<String>?,
    val opensAt: Instant,
    val dueAt: Instant,
    val allowLate: Boolean,
    val attemptLimit: Int,
    val interviewCap: Int?,
    val component: String,
    val topic: String?,
)

/** The targets of one assignment, with what the staff screens show for them. */
data class AssignmentTargetRows(
    val batches: List<TargetBatchView>,
    val students: List<TargetStudentView>,
)

/**
 * Everything one recipient's progress on one assignment is derived from, in one row. Read for
 * every recipient of a set of assignments in a single statement (no per-student queries), so
 * a 600-student batch is one round trip.
 *
 * Interview kind: the attempt counts and flags. Scenario kind: the answered, correct and
 * total step counts over the set's steps.
 */
data class RecipientFacts(
    val assignmentId: UUID,
    val memberId: UUID,
    val userId: UUID,
    val name: String?,
    val email: String,
    val rollNumber: String?,
    val batchId: UUID,
    val batchName: String,
    /** Attempts not handed back (not `failed`). */
    val attemptsUsed: Int,
    /** Org-funded attempts not handed back. */
    val orgFundedUsed: Int,
    /** Some attempt's session completed. */
    val attemptCompleted: Boolean,
    /** Some attempt is under way: in progress, and its round not deleted. */
    val attemptInProgress: Boolean,
    /** Sessions started from this assignment, oldest first. Deleted rounds are left out. */
    val sessionIds: List<UUID>,
    /** Completed attempts' sessions, oldest first — the evidence module 6 reads. */
    val completedSessionIds: List<UUID>,
    val stepsAnswered: Int,
    val stepsCorrect: Int,
    val stepsTotal: Int,
    val lastActivityAt: Instant?,
) {
    fun completed(kind: AssignmentKind): Boolean =
        when (kind) {
            AssignmentKind.INTERVIEW -> attemptCompleted
            AssignmentKind.ARENA_SCENARIOS -> stepsTotal > 0 && stepsAnswered >= stepsTotal
        }

    fun inProgress(kind: AssignmentKind): Boolean =
        when (kind) {
            AssignmentKind.INTERVIEW -> attemptInProgress
            AssignmentKind.ARENA_SCENARIOS -> stepsAnswered > 0
        }

    /** Correct over answered, 0–1; null when nothing is answered or this is an interview. */
    fun scenarioScore(kind: AssignmentKind): Double? =
        if (kind == AssignmentKind.ARENA_SCENARIOS && stepsAnswered > 0) stepsCorrect.toDouble() / stepsAnswered else null
}

/** A live Arena scenario as the builder needs it, plus its course for the component default. */
data class ScenarioRow(
    val id: String,
    val courseId: String,
    val courseSlug: String,
    val courseTitle: String,
    val title: String,
    val tier: String,
    val estimatedMinutes: Int,
)

/** How far one user is through one scenario. */
data class ScenarioProgressRow(
    val scenarioId: String,
    val answered: Int,
    val total: Int,
)

data class ActiveOrg(
    val name: String,
    val interviewAllowance: Int,
)

/** The student's own counts on one assignment, and the college's usage, read under the org lock. */
data class AdmissionCounts(
    val attemptsUsed: Int,
    val orgFundedUsed: Int,
    val collegeUsed: Int,
)

/**
 * Assignments, their targets and attempts (campus spec §4). Every statement binds
 * `scope.orgId`. Faculty narrowing is applied here, from the scope, as in [MemberRepository]:
 * a faculty member sees an assignment when one of its targets sits in their batches (or they
 * created it), and only the recipients in their batches.
 */
@Repository
class AssignmentRepository(
    private val jdbc: JdbcClient,
) {
    // -- assignments -------------------------------------------------------------

    fun list(
        scope: OrgScope,
        status: String?,
    ): List<AssignmentRow> {
        val visible = scope.visibleBatchIds
        val statement =
            jdbc
                .sql(
                    """
                    $ASSIGNMENT_SELECT
                     where x.org_id = :orgId${if (status != null) " and x.status = :status" else ""}${facultyFilter(visible)}
                     order by x.due_at, x.id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
        status?.let { statement.param("status", it) }
        bindFaculty(statement, scope)
        return statement.query { rs, _ -> rs.toAssignment() }.list()
    }

    fun find(
        scope: OrgScope,
        id: UUID,
    ): AssignmentRow? {
        val statement =
            jdbc
                .sql(
                    """
                    $ASSIGNMENT_SELECT
                     where x.org_id = :orgId and x.id = :id${facultyFilter(scope.visibleBatchIds)}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("id", id)
        bindFaculty(statement, scope)
        return statement
            .query { rs, _ -> rs.toAssignment() }
            .optional()
            .orElse(null)
    }

    /** Serialises writes to one assignment, so a publish and a PATCH cannot interleave. */
    fun lock(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql("select id from public.assignments where org_id = :orgId and id = :id for update")
            .param("orgId", scope.orgId)
            .param("id", id)
            .query(UUID::class.java)
            .optional()
            .isPresent

    /** A draft set by hand. */
    fun create(
        scope: OrgScope,
        fields: AssignmentFields,
    ): UUID = insert(scope, fields, programmeId = null, programmeWeek = null)

    /** A draft that belongs to week [programmeWeek] of a programme (module 10); published by the caller. */
    fun createForProgramme(
        scope: OrgScope,
        fields: AssignmentFields,
        programmeId: UUID,
        programmeWeek: Int,
    ): UUID = insert(scope, fields, programmeId, programmeWeek)

    private fun insert(
        scope: OrgScope,
        fields: AssignmentFields,
        programmeId: UUID?,
        programmeWeek: Int?,
    ): UUID {
        val statement =
            jdbc
                .sql(
                    """
                    insert into public.assignments (
                        org_id, created_by_member_id, kind, title, instructions, round_type, duration_minutes,
                        company_name, role_title, candidate_stage, language, focus_topic, scenario_ids,
                        opens_at, due_at, allow_late, attempt_limit, interview_cap, readiness_component, topic,
                        programme_id, programme_week
                    ) values (
                        :orgId, :createdBy, :kind, :title, :instructions, :roundType, :duration,
                        :company, :role, :stage, :language, :focusTopic, ${scenarioArray(fields.scenarioIds)},
                        :opensAt, :dueAt, :allowLate, :attemptLimit, :interviewCap, :component, :topic,
                        :programmeId, :programmeWeek
                    )
                    returning id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("createdBy", scope.memberId)
                .param("programmeId", programmeId)
                .param("programmeWeek", programmeWeek)
        bindFields(statement, fields)
        return statement.query(UUID::class.java).single()
    }

    fun update(
        scope: OrgScope,
        id: UUID,
        fields: AssignmentFields,
    ) {
        val statement =
            jdbc
                .sql(
                    """
                    update public.assignments
                       set kind = :kind, title = :title, instructions = :instructions, round_type = :roundType,
                           duration_minutes = :duration, company_name = :company, role_title = :role,
                           candidate_stage = :stage, language = :language, focus_topic = :focusTopic,
                           scenario_ids = ${scenarioArray(fields.scenarioIds)}, opens_at = :opensAt, due_at = :dueAt,
                           allow_late = :allowLate, attempt_limit = :attemptLimit, interview_cap = :interviewCap,
                           readiness_component = :component, topic = :topic
                     where org_id = :orgId and id = :id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("id", id)
        bindFields(statement, fields)
        statement.update()
    }

    fun publish(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.assignments set status = 'published', published_at = now()
                 where org_id = :orgId and id = :id and status = 'draft'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .update() == 1

    fun archive(
        scope: OrgScope,
        id: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.assignments set status = 'archived', archived_at = now()
                 where org_id = :orgId and id = :id and status <> 'archived'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", id)
            .update() == 1

    /**
     * Archives a programme's assignments that have not opened yet (module 10, archiving the
     * programme) and returns their ids. Ones already open stay, so work under way is kept.
     */
    fun archiveUnopenedOfProgramme(
        scope: OrgScope,
        programmeId: UUID,
        now: Instant,
    ): List<UUID> =
        jdbc
            .sql(
                """
                update public.assignments set status = 'archived', archived_at = now()
                 where org_id = :orgId and programme_id = :programmeId and status <> 'archived' and opens_at > :now
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("programmeId", programmeId)
            .param("now", OffsetDateTime.ofInstant(now, ZoneOffset.UTC))
            .query(UUID::class.java)
            .list()
            .filterNotNull()

    // -- targets -----------------------------------------------------------------

    /** Targets of [ids], filtered to the faculty member's batches when the scope is narrowed. */
    fun targets(
        scope: OrgScope,
        ids: Collection<UUID>,
    ): Map<UUID, AssignmentTargetRows> {
        if (ids.isEmpty()) return emptyMap()
        val batches = mutableMapOf<UUID, MutableList<TargetBatchView>>()
        val students = mutableMapOf<UUID, MutableList<TargetStudentView>>()
        jdbc
            .sql(
                """
                select t.assignment_id, t.batch_id, b.name as batch_name, t.member_id, u.display_name,
                       m.roll_number, m.batch_id as member_batch_id
                  from public.assignment_targets t
                  left join public.org_batches b on b.org_id = t.org_id and b.id = t.batch_id
                  left join public.org_members m on m.org_id = t.org_id and m.id = t.member_id
                  left join public.users u on u.id = m.user_id
                 where t.org_id = :orgId and t.assignment_id in (:ids)
                 order by b.name nulls last, u.display_name nulls last, m.roll_number nulls last, t.member_id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query { rs, _ ->
                val assignmentId = UUID.fromString(rs.getString("assignment_id"))
                val batchId = rs.getString("batch_id")?.let(UUID::fromString)
                if (batchId != null) {
                    if (scope.canSeeBatch(batchId)) {
                        batches.getOrPut(assignmentId, ::mutableListOf) += TargetBatchView(batchId, rs.getString("batch_name"))
                    }
                } else {
                    val memberBatch = rs.getString("member_batch_id")?.let(UUID::fromString)
                    if (!scope.isNarrowed || (memberBatch != null && scope.canSeeBatch(memberBatch))) {
                        students.getOrPut(assignmentId, ::mutableListOf) +=
                            TargetStudentView(
                                UUID.fromString(rs.getString("member_id")),
                                rs.getString("display_name"),
                                rs.getString("roll_number"),
                            )
                    }
                }
            }.list()
        return ids.associateWith { AssignmentTargetRows(batches[it].orEmpty(), students[it].orEmpty()) }
    }

    fun replaceTargets(
        scope: OrgScope,
        id: UUID,
        batchIds: Collection<UUID>,
        memberIds: Collection<UUID>,
    ) {
        jdbc
            .sql("delete from public.assignment_targets where org_id = :orgId and assignment_id = :id")
            .param("orgId", scope.orgId)
            .param("id", id)
            .update()
        for (batchId in batchIds) {
            jdbc
                .sql("insert into public.assignment_targets (org_id, assignment_id, batch_id) values (:orgId, :id, :batchId)")
                .param("orgId", scope.orgId)
                .param("id", id)
                .param("batchId", batchId)
                .update()
        }
        for (memberId in memberIds) {
            jdbc
                .sql("insert into public.assignment_targets (org_id, assignment_id, member_id) values (:orgId, :id, :memberId)")
                .param("orgId", scope.orgId)
                .param("id", id)
                .param("memberId", memberId)
                .update()
        }
    }

    /** Which of [ids] are batches of this college. */
    fun existingBatches(
        scope: OrgScope,
        ids: Collection<UUID>,
    ): Set<UUID> {
        if (ids.isEmpty()) return emptySet()
        return jdbc
            .sql("select id from public.org_batches where org_id = :orgId and id in (:ids)")
            .param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query(UUID::class.java)
            .list()
            .filterNotNull()
            .toSet()
    }

    /** Joined students of this college among [ids], with their batch. */
    fun joinedStudents(
        scope: OrgScope,
        ids: Collection<UUID>,
    ): Map<UUID, UUID> {
        if (ids.isEmpty()) return emptyMap()
        return jdbc
            .sql(
                """
                select id, batch_id from public.org_members
                 where org_id = :orgId and id in (:ids) and role = 'student' and status = 'joined'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("ids", ids.toList())
            .query { rs, _ -> UUID.fromString(rs.getString("id")) to UUID.fromString(rs.getString("batch_id")) }
            .list()
            .toMap()
    }

    // -- progress ------------------------------------------------------------------

    /**
     * One row per recipient per assignment in [assignmentIds]: every joined student in a
     * targeted batch, plus every targeted student (once, if both). Narrowed to the faculty
     * member's batches, and optionally to [batchId] or one [memberId].
     */
    fun recipientFacts(
        scope: OrgScope,
        assignmentIds: Collection<UUID>,
        batchId: UUID? = null,
        memberId: UUID? = null,
    ): List<RecipientFacts> {
        if (assignmentIds.isEmpty()) return emptyList()
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return emptyList()
        val filters =
            buildString {
                if (visible != null) append(" and m.batch_id in (:visible)")
                if (batchId != null) append(" and m.batch_id = :batchId")
                if (memberId != null) append(" and m.id = :memberId")
            }
        val statement =
            jdbc
                .sql(
                    """
                    with chosen as (
                        select x.id, x.kind, x.scenario_ids
                          from public.assignments x
                         where x.org_id = :orgId and x.id in (:ids)
                    ), recipients as (
                        select c.id as assignment_id, m.id as member_id, m.user_id
                          from chosen c
                          join public.assignment_targets t
                            on t.org_id = :orgId and t.assignment_id = c.id and t.batch_id is not null
                          join public.org_members m
                            on m.org_id = :orgId and m.batch_id = t.batch_id and m.role = 'student' and m.status = 'joined'
                        union
                        select c.id, m.id, m.user_id
                          from chosen c
                          join public.assignment_targets t
                            on t.org_id = :orgId and t.assignment_id = c.id and t.member_id is not null
                          join public.org_members m
                            on m.org_id = :orgId and m.id = t.member_id and m.role = 'student' and m.status = 'joined'
                    ), attempts as (
                        select r.assignment_id, r.member_id,
                               count(*) filter (where a.status <> 'failed') as attempts_used,
                               count(*) filter (where a.status <> 'failed' and a.org_funded) as org_funded_used,
                               coalesce(bool_or(a.status = 'completed'), false) as completed,
                               coalesce(bool_or(a.status = 'in_progress' and a.session_id is not null), false) as in_progress,
                               max(coalesce(a.ended_at, a.started_at)) as last_at,
                               array_remove(array_agg(a.session_id order by a.started_at, a.id), null) as session_ids,
                               array_remove(array_agg(case when a.status = 'completed' then a.session_id end
                                                      order by a.started_at, a.id), null) as completed_session_ids
                          from recipients r
                          join public.assignment_attempts a
                            on a.org_id = :orgId and a.assignment_id = r.assignment_id and a.member_id = r.member_id
                         group by r.assignment_id, r.member_id
                    ), steps as (
                        select c.id as assignment_id, st.id as step_id
                          from chosen c
                          join public.arena_scenario_steps st on st.scenario_id = any(c.scenario_ids)
                         where c.kind = 'arena_scenarios'
                    ), totals as (
                        select assignment_id, count(*) as total from steps group by assignment_id
                    ), answers as (
                        select r.assignment_id, r.member_id, count(*) as answered,
                               count(*) filter (where ans.is_correct) as correct, max(ans.answered_at) as last_at
                          from recipients r
                          join steps s on s.assignment_id = r.assignment_id
                          join public.user_step_answers ans on ans.user_id = r.user_id and ans.step_id = s.step_id
                         group by r.assignment_id, r.member_id
                    )
                    select r.assignment_id, r.member_id, m.user_id, u.display_name, u.email, m.roll_number,
                           b.id as batch_id, b.name as batch_name,
                           coalesce(at.attempts_used, 0) as attempts_used,
                           coalesce(at.org_funded_used, 0) as org_funded_used,
                           coalesce(at.completed, false) as attempt_completed,
                           coalesce(at.in_progress, false) as attempt_in_progress,
                           coalesce(at.session_ids, '{}') as session_ids,
                           coalesce(at.completed_session_ids, '{}') as completed_session_ids,
                           coalesce(an.answered, 0) as steps_answered,
                           coalesce(an.correct, 0) as steps_correct,
                           coalesce(tt.total, 0) as steps_total,
                           greatest(at.last_at, an.last_at) as last_activity_at
                      from recipients r
                      join public.org_members m on m.org_id = :orgId and m.id = r.member_id
                      join public.users u on u.id = m.user_id
                      join public.org_batches b on b.org_id = :orgId and b.id = m.batch_id
                      left join attempts at on at.assignment_id = r.assignment_id and at.member_id = r.member_id
                      left join answers an on an.assignment_id = r.assignment_id and an.member_id = r.member_id
                      left join totals tt on tt.assignment_id = r.assignment_id
                     where true$filters
                     order by r.assignment_id, b.name, m.roll_number nulls last, u.display_name nulls last, m.id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("ids", assignmentIds.toList())
        if (visible != null) statement.param("visible", visible.toList())
        batchId?.let { statement.param("batchId", it) }
        memberId?.let { statement.param("memberId", it) }
        return statement.query { rs, _ -> rs.toFacts() }.list()
    }

    // -- admission -----------------------------------------------------------------

    /**
     * Published assignments targeting this joined student (their batch, or them by name),
     * soonest due first; one assignment when [id] is given. A membership that is not joined,
     * or not this college's, matches nothing.
     */
    fun publishedFor(
        scope: OrgScope,
        memberId: UUID,
        id: UUID? = null,
    ): List<AssignmentRow> {
        val statement =
            jdbc
                .sql(
                    """
                    $ASSIGNMENT_SELECT
                     where x.org_id = :orgId and x.status = 'published'${if (id != null) " and x.id = :id" else ""}
                       and exists (
                           select 1
                             from public.assignment_targets t
                             join public.org_members sm
                               on sm.org_id = t.org_id and sm.id = :memberId and sm.role = 'student' and sm.status = 'joined'
                            where t.org_id = :orgId and t.assignment_id = x.id
                              and (t.member_id = sm.id or t.batch_id = sm.batch_id))
                     order by x.due_at, x.id
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("memberId", memberId)
        id?.let { statement.param("id", it) }
        return statement.query { rs, _ -> rs.toAssignment() }.list()
    }

    /** The organisation's name and allowance, when it is active; null when it is suspended. Not locked. */
    fun activeOrg(scope: OrgScope): ActiveOrg? =
        jdbc
            .sql("select name, interview_allowance from public.organisations where id = :orgId and status = 'active'")
            .param("orgId", scope.orgId)
            .query { rs, _ -> ActiveOrg(rs.getString("name"), rs.getInt("interview_allowance")) }
            .optional()
            .orElse(null)

    /**
     * Locks the organisation row until the calling transaction ends and returns its interview
     * allowance; null when the college is not active. Every assigned-interview start in one
     * college serialises here, so the allowance cannot be overspent by a race.
     *
     * `for no key update` rather than `for update`: it conflicts with itself and with every
     * update of the row (an allowance change waits for, and is waited on by, admissions), but
     * not with the `for key share` that foreign keys to the organisation take, so the
     * college's other writes — an audit entry, a new batch — are not queued behind a start.
     */
    fun lockOrgForAdmission(scope: OrgScope): Int? =
        jdbc
            .sql("select interview_allowance from public.organisations where id = :orgId and status = 'active' for no key update")
            .param("orgId", scope.orgId)
            .query(Int::class.java)
            .optional()
            .orElse(null)

    fun admissionCounts(
        scope: OrgScope,
        assignmentId: UUID,
        memberId: UUID,
    ): AdmissionCounts =
        jdbc
            .sql(
                """
                select count(*) filter (where a.assignment_id = :id and a.member_id = :memberId and a.status <> 'failed')
                         as attempts_used,
                       count(*) filter (where a.assignment_id = :id and a.member_id = :memberId and a.status <> 'failed'
                                          and a.org_funded) as org_funded_used,
                       count(*) filter (where a.org_funded and a.status <> 'failed') as college_used
                  from public.assignment_attempts a
                 where a.org_id = :orgId
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", assignmentId)
            .param("memberId", memberId)
            .query { rs, _ -> AdmissionCounts(rs.getInt("attempts_used"), rs.getInt("org_funded_used"), rs.getInt("college_used")) }
            .single()

    /** The college's org-funded interviews not handed back: what its allowance has spent. */
    fun collegeUsage(scope: OrgScope): Int =
        jdbc
            .sql(
                """
                select count(*) from public.assignment_attempts
                 where org_id = :orgId and org_funded and status <> 'failed'
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .query(Int::class.java)
            .single()

    fun insertAttempt(
        scope: OrgScope,
        assignmentId: UUID,
        memberId: UUID,
        sessionId: UUID,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.assignment_attempts (org_id, assignment_id, member_id, session_id, org_funded)
                values (:orgId, :id, :memberId, :sessionId, true)
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("id", assignmentId)
            .param("memberId", memberId)
            .param("sessionId", sessionId)
            .query(UUID::class.java)
            .single()

    // -- Arena scenarios (not college data: the shared catalogue) ----------------------

    fun liveScenarios(ids: Collection<String>? = null): List<ScenarioRow> {
        if (ids != null && ids.isEmpty()) return emptyList()
        val statement =
            jdbc
                .sql(
                    """
                    select s.id, s.course_id, c.slug as course_slug, c.title as course_title, s.title, s.tier,
                           s.estimated_minutes
                      from public.arena_scenarios s
                      join public.arena_courses c on c.id = s.course_id
                     where s.status = 'live'${if (ids != null) " and s.id in (:ids)" else ""}
                     order by c.title, s.title, s.id
                    """.trimIndent(),
                )
        ids?.let { statement.param("ids", it.toList()) }
        return statement
            .query { rs, _ ->
                ScenarioRow(
                    id = rs.getString("id"),
                    courseId = rs.getString("course_id"),
                    courseSlug = rs.getString("course_slug"),
                    courseTitle = rs.getString("course_title"),
                    title = rs.getString("title"),
                    tier = rs.getString("tier"),
                    estimatedMinutes = rs.getInt("estimated_minutes"),
                )
            }.list()
    }

    /** Scenarios by id whatever their status, for showing an assignment set after a scenario was withdrawn. */
    fun scenarios(ids: Collection<String>): List<ScenarioRow> {
        if (ids.isEmpty()) return emptyList()
        return jdbc
            .sql(
                """
                select s.id, s.course_id, c.slug as course_slug, c.title as course_title, s.title, s.tier,
                       s.estimated_minutes
                  from public.arena_scenarios s
                  join public.arena_courses c on c.id = s.course_id
                 where s.id in (:ids)
                """.trimIndent(),
            ).param("ids", ids.toList())
            .query { rs, _ ->
                ScenarioRow(
                    id = rs.getString("id"),
                    courseId = rs.getString("course_id"),
                    courseSlug = rs.getString("course_slug"),
                    courseTitle = rs.getString("course_title"),
                    title = rs.getString("title"),
                    tier = rs.getString("tier"),
                    estimatedMinutes = rs.getInt("estimated_minutes"),
                )
            }.list()
    }

    /** Steps answered and total, per scenario, for one user. */
    fun scenarioProgress(
        userId: UUID,
        scenarioIds: Collection<String>,
    ): Map<String, ScenarioProgressRow> {
        if (scenarioIds.isEmpty()) return emptyMap()
        return jdbc
            .sql(
                """
                select st.scenario_id, count(*) as total, count(ans.step_id) as answered
                  from public.arena_scenario_steps st
                  left join public.user_step_answers ans on ans.user_id = :userId and ans.step_id = st.id
                 where st.scenario_id in (:ids)
                 group by st.scenario_id
                """.trimIndent(),
            ).param("userId", userId)
            .param("ids", scenarioIds.toList())
            .query { rs, _ -> ScenarioProgressRow(rs.getString("scenario_id"), rs.getInt("answered"), rs.getInt("total")) }
            .list()
            .associateBy { it.scenarioId }
    }

    // -- mapping -----------------------------------------------------------------

    private fun facultyFilter(visible: Set<UUID>?): String {
        if (visible == null) return ""
        if (visible.isEmpty()) return " and x.created_by_member_id = :callerMemberId"
        return """
             and (x.created_by_member_id = :callerMemberId
                  or exists (select 1
                               from public.assignment_targets ft
                               left join public.org_members fm on fm.org_id = ft.org_id and fm.id = ft.member_id
                              where ft.org_id = :orgId and ft.assignment_id = x.id
                                and (ft.batch_id in (:visible) or fm.batch_id in (:visible))))"""
    }

    private fun bindFaculty(
        statement: JdbcClient.StatementSpec,
        scope: OrgScope,
    ) {
        val visible = scope.visibleBatchIds ?: return
        statement.param("callerMemberId", scope.memberId)
        if (visible.isNotEmpty()) statement.param("visible", visible.toList())
    }

    private fun scenarioArray(ids: List<String>?): String = if (ids == null) "null" else "cast(array[:scenarioIds] as text[])"

    private fun bindFields(
        statement: JdbcClient.StatementSpec,
        fields: AssignmentFields,
    ) {
        statement
            .param("kind", fields.kind.dbValue)
            .param("title", fields.title)
            .param("instructions", fields.instructions)
            .param("roundType", fields.roundType)
            .param("duration", fields.durationMinutes)
            .param("company", fields.companyName)
            .param("role", fields.roleTitle)
            .param("stage", fields.candidateStage)
            .param("language", fields.language)
            .param("focusTopic", fields.focusTopic)
            .param("opensAt", OffsetDateTime.ofInstant(fields.opensAt, ZoneOffset.UTC))
            .param("dueAt", OffsetDateTime.ofInstant(fields.dueAt, ZoneOffset.UTC))
            .param("allowLate", fields.allowLate)
            .param("attemptLimit", fields.attemptLimit)
            .param("interviewCap", fields.interviewCap)
            .param("component", fields.component)
            .param("topic", fields.topic)
        // A list, so the placeholder expands to array[?, ?, …], one element per id.
        fields.scenarioIds?.let { statement.param("scenarioIds", it) }
    }

    private fun ResultSet.toAssignment(): AssignmentRow =
        AssignmentRow(
            id = UUID.fromString(getString("id")),
            kind = AssignmentKind.fromDbValue(getString("kind")) ?: error("Unknown assignment kind"),
            title = getString("title"),
            instructions = getString("instructions"),
            roundType = getString("round_type"),
            durationMinutes = getObject("duration_minutes")?.let { (it as Number).toInt() },
            companyName = getString("company_name"),
            roleTitle = getString("role_title"),
            candidateStage = getString("candidate_stage"),
            language = getString("language"),
            focusTopic = getString("focus_topic"),
            scenarioIds = getArray("scenario_ids")?.let { array -> (array.array as Array<*>).map { it.toString() } },
            opensAt = getTimestamp("opens_at").toInstant(),
            dueAt = getTimestamp("due_at").toInstant(),
            allowLate = getBoolean("allow_late"),
            attemptLimit = getInt("attempt_limit"),
            interviewCap = getObject("interview_cap")?.let { (it as Number).toInt() },
            component = getString("readiness_component"),
            topic = getString("topic"),
            status = getString("status"),
            createdAt = getTimestamp("created_at").toInstant(),
            publishedAt = getTimestamp("published_at")?.toInstant(),
            createdByMemberId = getString("created_by_member_id")?.let(UUID::fromString),
            createdByName = getString("created_by_name"),
        )

    private fun ResultSet.toFacts(): RecipientFacts =
        RecipientFacts(
            assignmentId = UUID.fromString(getString("assignment_id")),
            memberId = UUID.fromString(getString("member_id")),
            userId = UUID.fromString(getString("user_id")),
            name = getString("display_name"),
            email = getString("email"),
            rollNumber = getString("roll_number"),
            batchId = UUID.fromString(getString("batch_id")),
            batchName = getString("batch_name"),
            attemptsUsed = getInt("attempts_used"),
            orgFundedUsed = getInt("org_funded_used"),
            attemptCompleted = getBoolean("attempt_completed"),
            attemptInProgress = getBoolean("attempt_in_progress"),
            sessionIds = uuids("session_ids"),
            completedSessionIds = uuids("completed_session_ids"),
            stepsAnswered = getInt("steps_answered"),
            stepsCorrect = getInt("steps_correct"),
            stepsTotal = getInt("steps_total"),
            lastActivityAt = getTimestamp("last_activity_at")?.toInstant(),
        )

    private fun ResultSet.uuids(column: String): List<UUID> =
        getArray(column)?.let { array -> (array.array as Array<*>).mapNotNull { it?.toString()?.let(UUID::fromString) } }.orEmpty()

    private companion object {
        /** Completed by every caller with `x.org_id = :orgId`, as [MemberRepository]'s select list is. */
        const val ASSIGNMENT_SELECT = """select x.id, x.kind, x.title, x.instructions, x.round_type, x.duration_minutes,
                   x.company_name, x.role_title, x.candidate_stage, x.language, x.focus_topic, x.scenario_ids,
                   x.opens_at, x.due_at, x.allow_late, x.attempt_limit, x.interview_cap, x.readiness_component,
                   x.topic, x.status, x.created_at, x.published_at, x.created_by_member_id,
                   cu.display_name as created_by_name
              from public.assignments x
              left join public.org_members cm on cm.org_id = x.org_id and cm.id = x.created_by_member_id
              left join public.users cu on cu.id = cm.user_id"""
    }
}
