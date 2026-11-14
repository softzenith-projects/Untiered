package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.http.HttpStatus
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.security.SecureRandom
import java.time.Clock
import java.util.UUID

/**
 * MCQ tests graded on the server (campus spec §4b, contract "Module 4b").
 *
 * The answer key never leaves the server before a submission: a question is turned into a
 * [McqQuestionView], which has no field that could carry it, and [McqAttemptView.result] — the
 * only place a correct option or an explanation appears — is built only for a submitted attempt.
 *
 * A start draws its questions from the live bank with a fresh random seed, stored with the
 * attempt. Starts by one student queue on their membership row, so the attempt limit and the
 * one-open-attempt rule cannot be raced (a partial unique index backs the second). A submission
 * locks its attempt, so a double submit grades once and the second is `409 mcq_attempt_submitted`.
 *
 * The student routes resolve the caller's own joined student membership from the verified token;
 * an attempt or assignment that is not theirs is a 404 exactly like one that does not exist.
 */
@Service
class CampusMcqService internal constructor(
    private val access: CampusAccess,
    private val assignments: AssignmentRepository,
    private val mcq: McqRepository,
    private val audit: CampusAudit,
    private val features: ProductFeatureProperties,
    private val objectMapper: ObjectMapper,
    private val clock: Clock,
    private val seeds: () -> Long,
) {
    @Autowired
    constructor(
        access: CampusAccess,
        assignments: AssignmentRepository,
        mcq: McqRepository,
        audit: CampusAudit,
        features: ProductFeatureProperties,
        objectMapper: ObjectMapper,
    ) : this(access, assignments, mcq, audit, features, objectMapper, Clock.systemUTC(), SECURE_SEEDS::nextLong)

    // -- the student -------------------------------------------------------------------

    @Transactional
    fun start(
        identity: SupabaseIdentity,
        assignmentId: UUID,
    ): McqAttemptView {
        val scope = ownScope(identity)
        val memberId = checkNotNull(scope.memberId)
        val row =
            assignments
                .publishedFor(scope, memberId, assignmentId)
                .singleOrNull()
                ?.takeIf { it.kind == AssignmentKind.MCQ_TEST }
                ?: throw AssignedRoundAdmission.notFound()
        if (!mcq.lockMember(scope, memberId)) throw AssignedRoundAdmission.notFound()
        val counts = mcq.counts(scope, row.id, memberId)
        if (counts.openAttemptId != null) {
            throw ApiException(
                HttpStatus.CONFLICT,
                "mcq_attempt_open",
                "You have an unfinished attempt at this test. Resume it instead.",
            )
        }
        val now = clock.instant()
        AssignmentGate
            .evaluate(
                kind = AssignmentKind.MCQ_TEST,
                now = now,
                opensAt = row.opensAt,
                dueAt = row.dueAt,
                allowLate = row.allowLate,
                attemptsUsed = counts.used,
                attemptLimit = row.attemptLimit,
                orgFundedUsed = 0,
                interviewCap = null,
                collegeUsed = 0,
                collegeAllowance = 0,
            )?.let { throw it.toException() }

        val pool = mcq.liveQuestionIds(row.mcqCourseSlugs.orEmpty())
        if (pool.isEmpty()) {
            throw ApiException(
                HttpStatus.CONFLICT,
                "mcq_bank_unavailable",
                "The questions for this test are no longer available. Ask your placement office.",
            )
        }
        val seed = seeds()
        val drawn = McqDraw.draw(pool, row.mcqQuestionCount ?: AssignmentRules.MIN_MCQ_QUESTIONS, seed)
        val deadline = McqGrading.deadline(now, row.mcqTimeLimitMinutes)
        val attemptId = mcq.insert(scope, row.id, memberId, seed, drawn, now, deadline)
        val attempt = mcq.findOwn(scope, memberId, attemptId) ?: error("The attempt just written is missing")
        return view(attempt)
    }

    @Transactional(readOnly = true)
    fun get(
        identity: SupabaseIdentity,
        attemptId: UUID,
    ): McqAttemptView {
        val scope = ownScope(identity)
        val attempt = mcq.findOwn(scope, checkNotNull(scope.memberId), attemptId) ?: throw attemptNotFound()
        return view(attempt)
    }

    @Transactional
    fun submit(
        identity: SupabaseIdentity,
        attemptId: UUID,
        request: McqSubmitRequest?,
    ): McqAttemptView {
        val scope = ownScope(identity)
        val memberId = checkNotNull(scope.memberId)
        val attempt = mcq.findOwn(scope, memberId, attemptId, lock = true) ?: throw attemptNotFound()
        if (attempt.submittedAt != null) {
            throw ApiException(HttpStatus.CONFLICT, "mcq_attempt_submitted", "This attempt has already been submitted.")
        }
        val questions = mcq.questions(attempt.questionIds)
        val keys = questions.mapValues { (_, q) -> McqKey(q.correctOptionId, options(q).map { it.id }.toSet()) }
        val answers = answersFrom(request, attempt.questionIds.toSet(), keys)
        val grade = McqGrading.grade(attempt.questionIds, keys, answers)
        val now = clock.instant()
        val late = McqGrading.isLate(now, attempt.deadlineAt)
        if (!mcq.submit(scope, attempt.id, objectMapper.writeValueAsString(grade.answers), now, grade, late)) {
            throw ApiException(HttpStatus.CONFLICT, "mcq_attempt_submitted", "This attempt has already been submitted.")
        }
        val graded = mcq.findOwn(scope, memberId, attempt.id) ?: throw attemptNotFound()
        return view(graded, questions)
    }

    // -- staff -------------------------------------------------------------------------

    /** One of a student's attempts, for staff who may see that student. Audited as `mcq.viewed`. */
    @Transactional
    fun staffView(
        identity: SupabaseIdentity,
        orgId: UUID,
        memberId: UUID,
        attemptId: UUID,
    ): McqAttemptView {
        val scope = access.resolve(identity, orgId)
        scope.require(CampusPermission.STUDENT_REPORT_VIEW)
        val attempt = mcq.findForStaff(scope, memberId, attemptId) ?: throw ApiException.notFound()
        audit.record(scope, "mcq.viewed", TARGET_MCQ_ATTEMPT, attempt.id, mapOf("memberId" to memberId.toString()))
        return view(attempt)
    }

    // -- helpers -----------------------------------------------------------------------

    /** The caller's joined student membership at an active college, or a 404. */
    private fun ownScope(identity: SupabaseIdentity): OrgScope {
        if (!features.campus) throw ApiException.notFound()
        val scope = access.resolveOwnStudentMembership(identity) ?: throw ApiException.notFound()
        scope.require(CampusPermission.OWN_MEMBERSHIP)
        assignments.activeOrg(scope) ?: throw ApiException.notFound()
        return scope
    }

    /**
     * `{ questionId → optionId }` from the body. An answer to a question the attempt did not
     * draw, a second answer to one question, or an option the question does not have is a
     * `400 mcq_answers_invalid`: the web client never sends one, so it is not a slip to forgive.
     * An omitted question, or one with a null option, is unanswered — and wrong.
     */
    private fun answersFrom(
        request: McqSubmitRequest?,
        drawn: Set<String>,
        keys: Map<String, McqKey>,
    ): Map<String, String> {
        val result = linkedMapOf<String, String>()
        val seen = mutableSetOf<String>()
        for (answer in request?.answers.orEmpty()) {
            val questionId = answer.questionId?.trim().orEmpty()
            if (questionId !in drawn) throw answersInvalid("$questionId is not a question in this attempt.")
            if (!seen.add(questionId)) throw answersInvalid("$questionId is answered twice.")
            val optionId = answer.optionId?.trim()?.takeIf { it.isNotEmpty() } ?: continue
            if (optionId !in keys[questionId]?.optionIds.orEmpty()) throw answersInvalid("$optionId is not an option of $questionId.")
            result[questionId] = optionId
        }
        return result
    }

    private fun view(
        attempt: McqAttemptRow,
        loaded: Map<String, McqQuestionRow>? = null,
    ): McqAttemptView {
        val questions = loaded ?: mcq.questions(attempt.questionIds)
        val ordered = attempt.questionIds.mapNotNull { questions[it] }
        val result =
            if (attempt.submittedAt == null) {
                null
            } else {
                val chosen = attempt.answersJson?.let(::answersOf).orEmpty()
                McqResultView(
                    correct = attempt.correct ?: 0,
                    total = attempt.total ?: attempt.questionIds.size,
                    score = attempt.score ?: 0,
                    late = attempt.late,
                    review =
                        ordered.map { q ->
                            McqReviewItem(q.id, chosen[q.id], q.correctOptionId, q.explanation)
                        },
                )
            }
        return McqAttemptView(
            attemptId = attempt.id,
            assignmentId = attempt.assignmentId,
            assignmentTitle = attempt.assignmentTitle,
            startedAt = attempt.startedAt.toString(),
            deadlineAt = attempt.deadlineAt?.toString(),
            questions = ordered.map { q -> McqQuestionView(q.id, q.prompt, q.code, options(q)) },
            submittedAt = attempt.submittedAt?.toString(),
            result = result,
        )
    }

    private fun options(question: McqQuestionRow): List<McqOptionView> =
        (objectMapper.readValue(question.optionsJson, List::class.java) as List<*>).mapNotNull { raw ->
            val option = raw as? Map<*, *> ?: return@mapNotNull null
            val id = option["id"] as? String ?: return@mapNotNull null
            McqOptionView(id, option["text"] as? String ?: "")
        }

    private fun answersOf(json: String): Map<String, String> =
        (objectMapper.readValue(json, Map::class.java) as Map<*, *>)
            .mapNotNull { (k, v) -> (k as? String)?.let { key -> (v as? String)?.let { key to it } } }
            .toMap()

    private fun attemptNotFound() =
        ApiException(HttpStatus.NOT_FOUND, "mcq_attempt_not_found", "That test attempt is not available to you.")

    private fun answersInvalid(message: String) = ApiException(HttpStatus.BAD_REQUEST, "mcq_answers_invalid", message)

    companion object {
        const val TARGET_MCQ_ATTEMPT = "mcq_attempt"
        private val SECURE_SEEDS = SecureRandom()
    }
}
