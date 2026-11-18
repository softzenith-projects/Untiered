package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.RoundType
import org.springframework.http.HttpStatus
import java.time.Instant

/** `interview`, `arena_scenarios` or `mcq_test`, as `assignments.kind` stores it. */
enum class AssignmentKind(
    val dbValue: String,
) {
    INTERVIEW("interview"),
    ARENA_SCENARIOS("arena_scenarios"),
    MCQ_TEST("mcq_test"),
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

    /** An MCQ test (contract "Module 4b"): 5–50 questions, an optional 5–120 minute limit. */
    const val MIN_MCQ_QUESTIONS = 5
    const val MAX_MCQ_QUESTIONS = 50
    const val MIN_MCQ_MINUTES = 5
    const val MAX_MCQ_MINUTES = 120
    const val MAX_MCQ_COURSES = 10

    /** A course is offered for MCQ tests only with at least this many live questions. */
    const val MIN_MCQ_BANK = 5

    /** The Arena course whose scenarios are all coding problems. */
    const val DSA_COURSE_ID = "dsa"

    /**
     * The readiness component staff did not choose, defaulted as the contract says. For a
     * scenario set, [scenarioCourseIds] are the courses of the chosen scenarios: coding when
     * every one is DSA, core CS otherwise. An MCQ test passes its course slugs the same way.
     */
    fun defaultComponent(
        kind: AssignmentKind,
        roundType: RoundType?,
        scenarioCourseIds: Collection<String> = emptyList(),
    ): String {
        if (kind == AssignmentKind.ARENA_SCENARIOS || kind == AssignmentKind.MCQ_TEST) {
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
 * `interviewCap`; 5. the college's funding: with no issued package, its org-funded attempts
 * (not handed back) against its allowance; with one, [CollegePackages.choose] (contract
 * "Module 14"). A scenario set is only ever refused for 1 and 2: it has no attempts, and costs
 * the college nothing. An MCQ test is refused for 1, 2 and 3: each start is an attempt, but it
 * costs no AI, so neither the interview cap nor the college's allowance applies.
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
        NO_ACTIVE_PACKAGE(
            "no_active_package",
            HttpStatus.PAYMENT_REQUIRED,
            "college_package_inactive",
            "Your college does not have an active interview package right now. Ask your placement office.",
        ),
        PACKAGE_STUDENT_LIMIT(
            "package_student_limit",
            HttpStatus.CONFLICT,
            "package_student_limit",
            "You have used all the interviews your college's package allows each student. Ask your placement office.",
        ),
        ;

        fun toException(): ApiException = ApiException(status, code, message)
    }

    /**
     * @param attemptsUsed the student's attempts at this assignment that were not handed back.
     * @param orgFundedUsed the student's org-funded attempts at this assignment not handed back.
     * @param interviewCap null means the cap is [attemptLimit].
     * @param collegeUsed the college's org-funded attempts, across every assignment, not handed back.
     * @param packages the package choice for this student; null when the college has no issued
     *   package, and then [collegeUsed] against [collegeAllowance] decides, as before packages.
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
        packages: PackageChoice? = null,
    ): Blocked? {
        if (now.isBefore(opensAt)) return Blocked.NOT_OPEN
        if (!allowLate && !now.isBefore(dueAt)) return Blocked.PAST_DUE
        if (kind == AssignmentKind.ARENA_SCENARIOS) return null
        if (attemptsUsed >= attemptLimit) return Blocked.ATTEMPT_LIMIT
        if (kind == AssignmentKind.MCQ_TEST) return null
        if (orgFundedUsed >= (interviewCap ?: attemptLimit)) return Blocked.STUDENT_CAP
        if (packages != null) return packages.blocked
        if (collegeUsed >= collegeAllowance) return Blocked.COLLEGE_ALLOWANCE
        return null
    }
}
