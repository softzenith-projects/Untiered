package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class CampusEmailCopyTest {
    private val assignmentId = UUID.fromString("0a000000-0000-0000-0000-0000000000a1")
    private val orgId = UUID.fromString("0a000000-0000-0000-0000-00000000000a")
    private val due = Instant.parse("2026-11-20T18:29:00Z") // 23:59 IST

    @Test
    fun `the deadline is written in India time`() {
        assertEquals("20 November 2026, 11:59 pm IST", CampusEmailCopy.deadline(due))
        assertEquals("21 November 2026, 12:00 am IST", CampusEmailCopy.deadline(Instant.parse("2026-11-20T18:30:00Z")))
    }

    @Test
    fun `new assignment names the college, the assignment and the deadline, in an essential category`() {
        val email = CampusEmailCopy.newAssignment(assignmentId, "Demo College", "Mock HR round", due)

        assertEquals(CampusEmailCopy.CATEGORY_ASSIGNMENT, email.category)
        assertFalse(email.category in CampusEmailCopy.OPTIONAL_CATEGORIES)
        assertTrue(email.subject.contains("Demo College") && email.subject.contains("Mock HR round"))
        assertTrue(email.body.contains("20 November 2026, 11:59 pm IST"))
    }

    @Test
    fun `dedupe keys are stable per event and differ between events`() {
        val one = CampusEmailCopy.newAssignment(assignmentId, "Demo College", "Mock HR round", due)
        val again = CampusEmailCopy.newAssignment(assignmentId, "Demo College", "Renamed later", due.plusSeconds(3600))
        assertEquals(one.dedupeKey, again.dedupeKey)
        assertNotEquals(one.dedupeKey, CampusEmailCopy.deadlineReminder(assignmentId, "Demo College", "x", due).dedupeKey)
        assertNotEquals(CampusEmailCopy.reportKey(assignmentId), CampusEmailCopy.reportKey(UUID.randomUUID()))
        assertTrue(one.dedupeKey.length <= 160)
    }

    @Test
    fun `no email carries a score, whatever it is about`() {
        val week = CampusEmailCopy.weekEndingBefore(Instant.parse("2026-11-16T04:00:00Z"))
        val emails =
            listOf(
                CampusEmailCopy.newAssignment(assignmentId, "Demo College", "Mock HR round", due),
                CampusEmailCopy.deadlineReminder(assignmentId, "Demo College", "Mock HR round", due),
                CampusEmailCopy.reportReady(assignmentId, "Demo College", "Mock HR round"),
                CampusEmailCopy.weeklySummary(orgId, "Demo College", week, WeeklyCounts(3, 20, 7, 10, 2)),
            )
        for (email in emails) {
            val text = (email.subject + " " + email.body).lowercase()
            assertFalse(Regex("score|rating|/ ?10|%|out of 100").containsMatchIn(text), "score language in ${email.category}: $text")
            assertFalse(Regex("seamless|revolutionis|supercharge").containsMatchIn(text))
        }
    }

    @Test
    fun `reminder and report copy say how to turn them off`() {
        assertTrue(CampusEmailCopy.deadlineReminder(assignmentId, "Demo College", "Mock HR round", due).body.contains("email preferences"))
        assertTrue(CampusEmailCopy.reportReady(assignmentId, "Demo College", "Mock HR round").body.contains("email preferences"))
    }

    @Test
    fun `the weekly summary is counts only and its key is per college per week`() {
        val week = CampusEmailCopy.weekEndingBefore(Instant.parse("2026-11-16T04:00:00Z"))
        val email = CampusEmailCopy.weeklySummary(orgId, "Demo College", week, WeeklyCounts(3, 20, 7, 10, 2))

        assertTrue(email.body.contains("Students who joined: 3"))
        assertTrue(email.body.contains("7 of 10 student assignments completed"))
        assertTrue(email.body.contains("overdue: 2"))
        assertEquals("campus-weekly-$orgId-2026-11-09", email.dedupeKey)
        assertNotEquals(email.dedupeKey, CampusEmailCopy.weeklyKey(UUID.randomUUID(), week))
    }

    @Test
    fun `the week ends at Monday midnight in India, not in UTC`() {
        // Monday 16 Nov 2026, 09:00 IST is 03:30 UTC: the week just ended is 9 to 15 Nov.
        val monday = CampusEmailCopy.weekEndingBefore(Instant.parse("2026-11-16T03:30:00Z"))
        assertEquals("2026-11-09", monday.startDate.toString())
        assertEquals(Instant.parse("2026-11-08T18:30:00Z"), monday.start)
        assertEquals(Instant.parse("2026-11-15T18:30:00Z"), monday.end)

        // Sunday 15 Nov 2026, 20:00 UTC is already Monday 01:30 IST: the same week boundary.
        assertEquals(monday, CampusEmailCopy.weekEndingBefore(Instant.parse("2026-11-15T20:00:00Z")))
        // Sunday 15 Nov, 18:00 UTC is still Sunday 23:30 IST: the week before.
        assertEquals("2026-11-02", CampusEmailCopy.weekEndingBefore(Instant.parse("2026-11-15T18:00:00Z")).startDate.toString())
        // The following Sunday belongs to the same week as the Monday before it.
        assertEquals("2026-11-09", CampusEmailCopy.weekEndingBefore(Instant.parse("2026-11-22T10:00:00Z")).startDate.toString())
    }

    @Test
    fun `summary day is Monday from 09 00 India time`() {
        assertFalse(CampusNotifications.isSummaryDay(Instant.parse("2026-11-16T03:29:00Z"))) // 08:59 IST
        assertTrue(CampusNotifications.isSummaryDay(Instant.parse("2026-11-16T03:30:00Z"))) // 09:00 IST
        assertTrue(CampusNotifications.isSummaryDay(Instant.parse("2026-11-16T18:00:00Z"))) // 23:30 IST
        assertFalse(CampusNotifications.isSummaryDay(Instant.parse("2026-11-16T19:00:00Z"))) // Tuesday 00:30 IST
        assertFalse(CampusNotifications.isSummaryDay(Instant.parse("2026-11-17T05:00:00Z")))
    }
}
