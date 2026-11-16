package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/** The MCQ draw, grading and lateness rules (contract "Module 4b", Attempts). */
class McqTestsTest {
    private val pool = (1..40).map { "mcq-dsa-chapter-q$it" }

    @Test
    fun `the same seed over the same pool draws the same questions in the same order`() {
        val first = McqDraw.draw(pool, 10, seed = 42L)
        val again = McqDraw.draw(pool.shuffled(), 10, seed = 42L)

        assertEquals(10, first.size)
        assertEquals(first, again, "the database's row order must not change the draw")
        assertEquals(first.toSet().size, first.size, "no question is drawn twice")
        assertTrue(first.all { it in pool })
    }

    @Test
    fun `different seeds draw differently`() {
        val draws = (1L..5L).map { McqDraw.draw(pool, 10, it) }.toSet()
        assertTrue(draws.size > 1, "five seeds all drew the same ten questions")
        assertNotEquals(McqDraw.draw(pool, 10, 1L), McqDraw.draw(pool, 10, 2L))
    }

    @Test
    fun `a draw never asks for more than the pool holds`() {
        assertEquals(3, McqDraw.draw(listOf("a", "b", "c"), 10, 7L).size)
        assertEquals(emptyList(), McqDraw.draw(emptyList(), 5, 7L))
        assertEquals(2, McqDraw.draw(listOf("a", "a", "b"), 5, 7L).size, "duplicates in the pool are one question")
    }

    @Test
    fun `grading counts correct answers, and an unanswered question is wrong`() {
        val ids = listOf("q1", "q2", "q3", "q4")
        val keys = ids.associateWith { McqKey("b", setOf("a", "b", "c")) }

        val grade = McqGrading.grade(ids, keys, mapOf("q1" to "b", "q2" to "a", "q3" to "b"))

        assertEquals(2, grade.correct)
        assertEquals(4, grade.total)
        assertEquals(50, grade.score)
        assertEquals(mapOf("q1" to "b", "q2" to "a", "q3" to "b"), grade.answers)
    }

    @Test
    fun `an answer to a question the attempt did not draw is ignored by grading`() {
        val keys = mapOf("q1" to McqKey("a", setOf("a", "b")))
        val grade = McqGrading.grade(listOf("q1"), keys, mapOf("q1" to "a", "elsewhere" to "a"))
        assertEquals(1, grade.correct)
        assertEquals(mapOf("q1" to "a"), grade.answers)
    }

    @Test
    fun `the score is rounded half up from correct over total`() {
        assertEquals(0, McqGrading.score(0, 10))
        assertEquals(100, McqGrading.score(10, 10))
        assertEquals(13, McqGrading.score(1, 8), "12.5 rounds up")
        assertEquals(67, McqGrading.score(2, 3))
        assertEquals(33, McqGrading.score(1, 3))
        assertEquals(0, McqGrading.score(0, 0))
    }

    @Test
    fun `the deadline is the start plus the limit, and a submission is late only past the 30 second grace`() {
        val start = Instant.parse("2026-11-14T10:00:00Z")
        val deadline = McqGrading.deadline(start, 20)

        assertEquals(Instant.parse("2026-11-14T10:20:00Z"), deadline)
        assertNull(McqGrading.deadline(start, null))
        assertFalse(McqGrading.isLate(Instant.parse("2026-11-14T10:19:59Z"), deadline))
        assertFalse(McqGrading.isLate(Instant.parse("2026-11-14T10:20:30Z"), deadline), "inside the grace")
        assertTrue(McqGrading.isLate(Instant.parse("2026-11-14T10:20:31Z"), deadline))
        assertFalse(McqGrading.isLate(Instant.parse("2027-01-01T00:00:00Z"), null), "no limit, never late")
    }
}
