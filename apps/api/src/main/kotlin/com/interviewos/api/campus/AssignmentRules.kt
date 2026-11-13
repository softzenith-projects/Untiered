package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.RoundType
import org.springframework.http.HttpStatus
import java.time.Instant

/** `interview` or `arena_scenarios`, as `assignments.kind` stores it. */
enum class AssignmentKind(
    val dbValue: String,
) {
    INTERVIEW("interview"),
    ARENA_SCENARIOS("arena_scenarios"),
    ;

    companion object {
        fun fromDbValue(value: String?): AssignmentKind? = entries.firstOrNull { it.dbValue == value }
    }
}

/** What `CompletionStatus` a recipient is at, worked out on read (contract, "How completion is derived"). */
enum class CompletionStatus(
    val wireValue: String,
) {
    NOT_STARTED("not_started"),
    IN_PROGRESS("in_progress"),
    COMPLETED("completed"),
    OVERDUE("overdue"),
    ;

    companion object {
        fun fromWireValue(value: String?): CompletionStatus? = entries.firstOrNull { it.wireValue == value }
    }
}

/**
 * Which assignments a college may set, and what each feeds. Pure, so the web's defaults and
 * the server's agree by test rather than by hope.
 */
object AssignmentRules {
    /** Round types a college may assign (contract `AssignableRoundType`). */
    val ASSIGNABLE_ROUND_TYPES: List<RoundType> =
        listOf(
            RoundType.TECHNICAL_FUNDAMENTALS,
            RoundType.PROJECT_DEEP_DIVE,
            RoundType.CODING_PRACTICAL,
            RoundType.APTITUDE,
            RoundType.HR_FIT_CLOSING,
            RoundType.BEHAVIOURAL_COMPETENCY,
            RoundType.CUSTOM_TOPIC,
        )

    val READINESS_COMPONENTS: Set<String> = setOf("coding", "core_cs", "technical_interview", "communication", "aptitude")

    val TOPICS: Set<String> = setOf("dsa", "dbms", "os", "oops", "cn", "system_design", "communication", "aptitude")

    val CANDIDATE_STAGES: Set<String> = setOf("student", "recent_graduate")

    val LANGUAGES: Set<String> = setOf("english", "hindi_english")

    const val MAX_TITLE = 140
    const val MAX_INSTRUCTIONS = 2000
    const val MAX_COMPANY = 120
    const val MAX_ROLE = 120
    const val MAX_FOCUS_TOPIC = 120
    const val MAX_ATTEMPTS = 10
    const val MAX_SCENARIOS = 20

    /** The Arena course whose scenarios are all coding problems. */
    const val DSA_COURSE_ID = "dsa"

    /**
     * The readiness component staff did not choose, defaulted as the contract says. For a
     * scenario set, [scenarioCourseIds] are the courses of the chosen scenarios: coding when
     * every one is DSA, core CS otherwise.
     */
    fun defaultComponent(
        kind: AssignmentKind,
        roundType: RoundType?,
        scenarioCourseIds: Collection<String> = emptyList(),
    ): String {
        if (kind == AssignmentKind.ARENA_SCENARIOS) {
            val allDsa = scenarioCourseIds.isNotEmpty() && scenarioCourseIds.all { it == DSA_COURSE_ID }
            return if (allDsa) "coding" else "core_cs"
        }
        return when (roundType) {
            RoundType.CODING_PRACTICAL -> "coding"
            RoundType.APTITUDE -> "aptitude"
            RoundType.HR_FIT_CLOSING, RoundType.BEHAVIOURAL_COMPETENCY -> "communication"
            RoundType.TECHNICAL_FUNDAMENTALS, RoundType.PROJECT_DEEP_DIVE -> "technical_interview"
            else -> "core_cs"
        }
    }

    /**
     * A recipient's status, in the contract's order: completed wins; then overdue (not
     * completed, past the deadline, no late attempts); then in progress; else not started.
     */
    fun completion(
        completed: Boolean,
        inProgress: Boolean,
        dueAt: Instant,
        allowLate: Boolean,
        now: Instant,
    ): CompletionStatus =
        when {
            completed -> CompletionStatus.COMPLETED
            !allowLate && !now.isBefore(dueAt) -> CompletionStatus.OVERDUE
            inProgress -> CompletionStatus.IN_PROGRESS
            else -> CompletionStatus.NOT_STARTED
        }
}

/**
 * Whether a student may start an assignment now, and if not, why (contract "Admission").
 *
 * The one decision both `GET /me/assignments` (`canStart` / `blockedReason`) and admission in
 * `POST /sessions` use, so a student is never shown a Start button the server then refuses
 * for a reason the list did not mention. Like `Entitlement`, it is derived from rows — the
 * attempts and the college's allowance — never from a stored flag.
 *
 * Checked in this order, and the order is the reason the student is given:
 * 1. not yet open; 2. past the deadline with no late attempts; 3. the student's attempts
 * (not handed back) against `attemptLimit`; 4. the student's org-funded attempts against
 * `interviewCap`; 5. the college's org-funded attempts (not handed back) against its
 * allowance. A scenario set is only ever refused for 1 and 2: it has no attempts, and costs
 * the college nothing.
 */
object AssignmentGate {
    enum class Blocked(
        val wireValue: String,
        val status: HttpStatus,
        val code: String,
        val message: String,
    ) {
        NOT_OPEN("not_open", HttpStatus.CONFLICT, "assignment_not_open", "This assignment is not open yet."),
        PAST_DUE(
            "past_due",
            HttpStatus.CONFLICT,
            "assignment_past_due",
            "The deadline has passed and your college is not accepting late attempts.",
        ),
        ATTEMPT_LIMIT(
            "attempt_limit",
            HttpStatus.CONFLICT,
            "assignment_attempt_limit",
            "You have used all the attempts allowed for this assignment.",
        ),
        STUDENT_CAP(
            "student_cap",
            HttpStatus.CONFLICT,
            "assignment_student_cap",
            "You have reached the number of interviews your college allows you for this assignment.",
        ),
        COLLEGE_ALLOWANCE(
            "college_allowance",
            HttpStatus.PAYMENT_REQUIRED,
            "college_allowance_exhausted",
            "Your college has used up its interview allowance for now. Ask your placement office.",
        ),
        ;

        fun toException(): ApiException = ApiException(status, code, message)
    }

    /**
     * @param attemptsUsed the student's attempts at this assignment that were not handed back.
     * @param orgFundedUsed the student's org-funded attempts at this assignment not handed back.
     * @param interviewCap null means the cap is [attemptLimit].
     * @param collegeUsed the college's org-funded attempts, across every assignment, not handed back.
     */
    fun evaluate(
        kind: AssignmentKind,
        now: Instant,
        opensAt: Instant,
        dueAt: Instant,
        allowLate: Boolean,
        attemptsUsed: Int,
        attemptLimit: Int,
        orgFundedUsed: Int,
        interviewCap: Int?,
        collegeUsed: Int,
        collegeAllowance: Int,
    ): Blocked? {
        if (now.isBefore(opensAt)) return Blocked.NOT_OPEN
        if (!allowLate && !now.isBefore(dueAt)) return Blocked.PAST_DUE
        if (kind != AssignmentKind.INTERVIEW) return null
        if (attemptsUsed >= attemptLimit) return Blocked.ATTEMPT_LIMIT
        if (orgFundedUsed >= (interviewCap ?: attemptLimit)) return Blocked.STUDENT_CAP
        if (collegeUsed >= collegeAllowance) return Blocked.COLLEGE_ALLOWANCE
        return null
    }
}
