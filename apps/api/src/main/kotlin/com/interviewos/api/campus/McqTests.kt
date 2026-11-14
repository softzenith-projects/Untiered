package com.interviewos.api.campus

import java.time.Duration
import java.time.Instant
import java.util.Collections
import java.util.Random

/**
 * Drawing an MCQ test's questions (contract "Module 4b", Attempts). Pure and deterministic for a
 * seed: the pool is sorted first, so the same seed over the same live questions always draws
 * the same questions in the same order, whatever order the database returned them in.
 */
object McqDraw {
    fun draw(
        pool: Collection<String>,
        count: Int,
        seed: Long,
    ): List<String> {
        val shuffled = pool.distinct().sorted().toMutableList()
        Collections.shuffle(shuffled, Random(seed))
        return shuffled.take(count.coerceIn(0, shuffled.size))
    }
}

/** One question's answer key, as grading needs it. */
data class McqKey(
    val correctOptionId: String,
    val optionIds: Set<String>,
)

/** What a submission earned. [answers] holds only the questions the student answered. */
data class McqGrade(
    val correct: Int,
    val total: Int,
    val score: Int,
    val answers: Map<String, String>,
)

/**
 * Grading and lateness for an MCQ attempt, on the server only. An unanswered question is wrong;
 * the score is `round(100 × correct ÷ total)`, rounded half up, as every readiness number is.
 */
object McqGrading {
    /** A submission this long after the deadline is still on time: it covers the trip from the browser. */
    val GRACE: Duration = Duration.ofSeconds(30)

    /** The start plus the time limit, or null when the test has none. */
    fun deadline(
        startedAt: Instant,
        timeLimitMinutes: Int?,
    ): Instant? = timeLimitMinutes?.let { startedAt.plus(Duration.ofMinutes(it.toLong())) }

    fun isLate(
        submittedAt: Instant,
        deadlineAt: Instant?,
    ): Boolean = deadlineAt != null && submittedAt.isAfter(deadlineAt.plus(GRACE))

    fun score(
        correct: Int,
        total: Int,
    ): Int = if (total <= 0) 0 else (200 * correct + total) / (2 * total)

    /**
     * Grades [answers] (question id → option id) against [keys] for the [questionIds] the
     * attempt drew. The caller has already refused an answer to a question the attempt did not
     * draw, or an option the question does not have.
     */
    fun grade(
        questionIds: List<String>,
        keys: Map<String, McqKey>,
        answers: Map<String, String>,
    ): McqGrade {
        val kept = answers.filterKeys { it in questionIds }
        val correct = questionIds.count { id -> keys[id]?.correctOptionId?.let { it == kept[id] } == true }
        return McqGrade(correct, questionIds.size, score(correct, questionIds.size), kept)
    }
}
