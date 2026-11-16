package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.time.OffsetDateTime
import java.time.ZoneOffset
import java.util.UUID

/** A bank question with its key. Never serialised as it is: [CampusMcqService] picks the fields. */
data class McqQuestionRow(
    val id: String,
    val prompt: String,
    val code: String?,
    /** The options' JSON, `[{ "id": "a", "text": "…" }, …]`. */
    val optionsJson: String,
    val correctOptionId: String,
    val explanation: String,
)

/** An MCQ attempt as stored. [answersJson] is `{ questionId: optionId }`, null until submitted. */
data class McqAttemptRow(
    val id: UUID,
    val assignmentId: UUID,
    val assignmentTitle: String,
    val memberId: UUID,
    val seed: Long,
    val questionIds: List<String>,
    val answersJson: String?,
    val startedAt: Instant,
    val deadlineAt: Instant?,
    val submittedAt: Instant?,
    val correct: Int?,
    val total: Int?,
    val score: Int?,
    val late: Boolean,
)

/** The student's attempts at one assignment, read under the membership lock. */
data class McqAttemptCounts(
    val used: Int,
    val openAttemptId: UUID?,
)

/**
 * MCQ attempts (contract "Module 4b") and the bank questions they draw. Every statement on
 * `mcq_attempts` binds `scope.orgId`; `mcq_questions` is the shared catalogue, like the Arena's
 * scenarios, and belongs to no college. A faculty member's reads are narrowed to their batches
 * here, from the scope, as in [MemberRepository].
 */
@Repository
class McqRepository(
    private val jdbc: JdbcClient,
) {
    // -- the bank ---------------------------------------------------------------------

    /** Ids of the live questions of [courseSlugs]: the pool an attempt draws from. */
    fun liveQuestionIds(courseSlugs: Collection<String>): List<String> {
        if (courseSlugs.isEmpty()) return emptyList()
        return jdbc
            .sql("select id from public.mcq_questions where status = 'live' and course_slug in (:slugs) order by id")
            .param("slugs", courseSlugs.toList())
            .query(String::class.java)
            .list()
            .filterNotNull()
    }

    /** Questions by id, live or retired, so an old attempt can still be shown and graded. */
    fun questions(ids: Collection<String>): Map<String, McqQuestionRow> {
        if (ids.isEmpty()) return emptyMap()
        return jdbc
            .sql(
                """
                select id, prompt, code, options::text as options, correct_option_id, explanation
                  from public.mcq_questions
                 where id in (:ids)
                """.trimIndent(),
            ).param("ids", ids.toList())
            .query { rs, _ ->
                McqQuestionRow(
                    id = rs.getString("id"),
                    prompt = rs.getString("prompt"),
                    code = rs.getString("code"),
                    optionsJson = rs.getString("options"),
                    correctOptionId = rs.getString("correct_option_id"),
                    explanation = rs.getString("explanation"),
                )
            }.list()
            .associateBy { it.id }
    }

    // -- attempts ---------------------------------------------------------------------

    /**
     * Locks the student's membership row until the calling transaction ends, so two starts by
     * the same student queue: the attempt limit and the one-open-attempt rule are read after it.
     * `for no key update`, so the foreign keys other writes take on the row are not blocked.
     */
    fun lockMember(
        scope: OrgScope,
        memberId: UUID,
    ): Boolean =
        jdbc
            .sql("select id from public.org_members where org_id = :orgId and id = :memberId for no key update")
            .param("orgId", scope.orgId)
            .param("memberId", memberId)
            .query(UUID::class.java)
            .optional()
            .isPresent

    fun counts(
        scope: OrgScope,
        assignmentId: UUID,
        memberId: UUID,
    ): McqAttemptCounts =
        jdbc
            .sql(
                """
                select count(*) as used,
                       (array_agg(q.id order by q.started_at) filter (where q.submitted_at is null))[1] as open_id
                  from public.mcq_attempts q
                 where q.org_id = :orgId and q.assignment_id = :assignmentId and q.member_id = :memberId
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("assignmentId", assignmentId)
            .param("memberId", memberId)
            .query { rs, _ -> McqAttemptCounts(rs.getInt("used"), rs.getString("open_id")?.let(UUID::fromString)) }
            .single()

    fun insert(
        scope: OrgScope,
        assignmentId: UUID,
        memberId: UUID,
        seed: Long,
        questionIds: List<String>,
        startedAt: Instant,
        deadlineAt: Instant?,
    ): UUID =
        jdbc
            .sql(
                """
                insert into public.mcq_attempts (org_id, assignment_id, member_id, seed, question_ids, started_at, deadline_at)
                values (:orgId, :assignmentId, :memberId, :seed, cast(array[:questionIds] as text[]), :startedAt, :deadlineAt)
                returning id
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("assignmentId", assignmentId)
            .param("memberId", memberId)
            .param("seed", seed)
            .param("questionIds", questionIds)
            .param("startedAt", OffsetDateTime.ofInstant(startedAt, ZoneOffset.UTC))
            .param("deadlineAt", deadlineAt?.let { OffsetDateTime.ofInstant(it, ZoneOffset.UTC) })
            .query(UUID::class.java)
            .single()

    /**
     * The caller's own attempt: [memberId] is the verified student's membership, never a value
     * from the request. With [lock], the row is locked until the transaction ends, so a second
     * submission waits and then sees the first one's grade.
     */
    fun findOwn(
        scope: OrgScope,
        memberId: UUID,
        attemptId: UUID,
        lock: Boolean = false,
    ): McqAttemptRow? =
        jdbc
            .sql(
                """
                $ATTEMPT_SELECT
                 where q.org_id = :orgId and q.id = :attemptId and q.member_id = :memberId${if (lock) " for update of q" else ""}
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("attemptId", attemptId)
            .param("memberId", memberId)
            .query { rs, _ -> rs.toAttempt() }
            .optional()
            .orElse(null)

    /**
     * An attempt by [memberId], a joined student of this college inside the caller's scope (a
     * faculty member's batches); null otherwise, including for another college's attempt.
     */
    fun findForStaff(
        scope: OrgScope,
        memberId: UUID,
        attemptId: UUID,
    ): McqAttemptRow? {
        val visible = scope.visibleBatchIds
        if (visible != null && visible.isEmpty()) return null
        val statement =
            jdbc
                .sql(
                    """
                    $ATTEMPT_SELECT
                      join public.org_members m on m.org_id = q.org_id and m.id = q.member_id
                     where q.org_id = :orgId and q.id = :attemptId and q.member_id = :memberId
                       and m.role = 'student' and m.status = 'joined'${if (visible != null) " and m.batch_id in (:visible)" else ""}
                    """.trimIndent(),
                ).param("orgId", scope.orgId)
                .param("attemptId", attemptId)
                .param("memberId", memberId)
        if (visible != null) statement.param("visible", visible.toList())
        return statement.query { rs, _ -> rs.toAttempt() }.optional().orElse(null)
    }

    /** Writes the grade. Only an unsubmitted attempt changes; returns whether this one did. */
    fun submit(
        scope: OrgScope,
        attemptId: UUID,
        answersJson: String,
        submittedAt: Instant,
        grade: McqGrade,
        late: Boolean,
    ): Boolean =
        jdbc
            .sql(
                """
                update public.mcq_attempts
                   set answers = cast(:answers as jsonb), submitted_at = :submittedAt, correct = :correct, total = :total,
                       score = :score, late = :late
                 where org_id = :orgId and id = :attemptId and submitted_at is null
                """.trimIndent(),
            ).param("orgId", scope.orgId)
            .param("attemptId", attemptId)
            .param("answers", answersJson)
            .param("submittedAt", OffsetDateTime.ofInstant(submittedAt, ZoneOffset.UTC))
            .param("correct", grade.correct)
            .param("total", grade.total)
            .param("score", grade.score)
            .param("late", late)
            .update() == 1

    private fun ResultSet.toAttempt(): McqAttemptRow =
        McqAttemptRow(
            id = UUID.fromString(getString("id")),
            assignmentId = UUID.fromString(getString("assignment_id")),
            assignmentTitle = getString("title"),
            memberId = UUID.fromString(getString("member_id")),
            seed = getLong("seed"),
            questionIds = (getArray("question_ids").array as Array<*>).map { it.toString() },
            answersJson = getString("answers"),
            startedAt = getTimestamp("started_at").toInstant(),
            deadlineAt = getTimestamp("deadline_at")?.toInstant(),
            submittedAt = getTimestamp("submitted_at")?.toInstant(),
            correct = getObject("correct")?.let { (it as Number).toInt() },
            total = getObject("total")?.let { (it as Number).toInt() },
            score = getObject("score")?.let { (it as Number).toInt() },
            late = getBoolean("late"),
        )

    private companion object {
        /** Completed by every caller with `q.org_id = :orgId`. */
        const val ATTEMPT_SELECT = """select q.id, q.assignment_id, x.title, q.member_id, q.seed, q.question_ids,
                   q.answers::text as answers, q.started_at, q.deadline_at, q.submitted_at, q.correct, q.total,
                   q.score, q.late
              from public.mcq_attempts q
              join public.assignments x on x.org_id = q.org_id and x.id = q.assignment_id"""
    }
}
