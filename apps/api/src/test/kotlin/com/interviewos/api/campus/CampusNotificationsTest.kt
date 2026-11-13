package com.interviewos.api.campus

import com.interviewos.api.config.ProductFeatureProperties
import com.interviewos.api.pool.anyArg
import com.interviewos.api.pool.eqArg
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import java.time.Clock
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID
import kotlin.test.assertEquals

/** The switch and the failure handling, with the repository mocked at the boundary. */
class CampusNotificationsTest {
    private val repository = mock(CampusNotificationRepository::class.java)
    private val orgId = UUID.randomUUID()
    private val id = UUID.randomUUID()

    private fun notifications(
        campus: Boolean,
        now: String = "2026-11-16T04:00:00Z",
    ) = CampusNotifications(repository, ProductFeatureProperties(campus = campus), Clock.fixed(Instant.parse(now), ZoneOffset.UTC))

    @Test
    fun `with the campus switch off nothing is queued or even looked up`() {
        val off = notifications(campus = false)

        off.assignmentPublished(orgId, id)
        off.studentJoined(orgId, id)
        off.roundCompleted(id)
        assertEquals(0, off.queueDeadlineReminders())
        assertEquals(0, off.queueWeeklySummaries())

        verifyNoInteractions(repository)
    }

    @Test
    fun `a personal round queues nothing`() {
        given(repository.finishedAssignedRound(id)).willReturn(null)

        notifications(campus = true).roundCompleted(id)

        verify(repository, never()).enqueueReportReady(anyArg(), anyArg())
    }

    @Test
    fun `a failure queueing the report email never fails the round`() {
        given(repository.finishedAssignedRound(id)).willThrow(IllegalStateException("db down"))

        notifications(campus = true).roundCompleted(id)
    }

    @Test
    fun `the weekly summary is only built on a Monday`() {
        notifications(campus = true, now = "2026-11-17T04:00:00Z").queueWeeklySummaries()

        verifyNoInteractions(repository)
    }

    @Test
    fun `on Monday each college gets its own counts and one failing college does not stop the rest`() {
        val bad = UUID.randomUUID()
        val good = UUID.randomUUID()
        given(repository.weeklyTargets()).willReturn(listOf(WeeklyTarget(bad, "Bad"), WeeklyTarget(good, "Good")))
        given(repository.weeklyCounts(eqArg(bad), anyArg(), anyArg())).willThrow(IllegalStateException("boom"))
        given(repository.weeklyCounts(eqArg(good), anyArg(), anyArg())).willReturn(WeeklyCounts(1, 2, 3, 4, 5))
        given(repository.enqueueWeekly(eqArg(good), anyArg())).willReturn(2)

        assertEquals(2, notifications(campus = true).queueWeeklySummaries())
    }

    @Test
    fun `reminders are asked for at the clock now`() {
        val now = Instant.parse("2026-11-16T04:00:00Z")
        given(repository.dueForReminder(now)).willReturn(listOf(ReminderCandidate(orgId, id)))
        given(repository.enqueueDeadlineReminder(ReminderCandidate(orgId, id))).willReturn(4)

        assertEquals(4, notifications(campus = true).queueDeadlineReminders())
    }
}
