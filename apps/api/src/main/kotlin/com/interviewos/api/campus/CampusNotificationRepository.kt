package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

/** An assignment due soon, found across colleges, then handled one college at a time. */
data class ReminderCandidate(
    val orgId: UUID,
    val assignmentId: UUID,
)

/** An active college with students, for the weekly summary. */
data class WeeklyTarget(
    val orgId: UUID,
    val name: String,
)

/** The facts a report-ready email needs, found from the session. */
data class FinishedAssignedRound(
    val orgId: UUID,
    val userId: UUID,
    val college: String,
    val title: String,
)

/**
 * Queues campus emails in the `email_deliveries` outbox, one row per recipient, in the caller's
 * transaction (campus spec section 9). Every insert is `on conflict (user_id, dedupe_key) do
 * nothing`, so the same event can fire twice, or a job can run twice, and nobody gets two
 * emails. Only active colleges are written for. Callers check the campus switch first.
 */
@Repository
class CampusNotificationRepository(
    private val jdbc: JdbcClient,
) {
    /**
     * A new assignment, to every joined student it targets, by batch or by name. Returns rows
     * queued. Nothing is sent before the assignment opens: a programme publishes all its weeks
     * on the day it starts, and each week's email goes out when that week unlocks
     * ([openedSince] finds them).
     */
    fun enqueueNewAssignment(
        orgId: UUID,
        assignmentId: UUID,
        now: Instant,
    ): Int {
        val opensAt =
            jdbc
                .sql("select opens_at from public.assignments where org_id = :orgId and id = :id")
                .param("orgId", orgId)
                .param("id", assignmentId)
                .query { rs, _ -> rs.getTimestamp("opens_at").toInstant() }
                .optional()
                .orElse(null) ?: return 0
        if (opensAt.isAfter(now)) return 0
        val head = head(orgId, assignmentId) ?: return 0
        val email = CampusEmailCopy.newAssignment(assignmentId, head.college, head.title, head.dueAt)
        return insertForRecipients(orgId, assignmentId, email, onlyUndone = false)
    }

    /** The open assignments a student has just been placed under: one email each, never a repeat. */
    fun enqueueOpenAssignmentsForMember(
        orgId: UUID,
        memberId: UUID,
        now: Instant,
    ): Int {
        val open =
            jdbc
                .sql(
                    """
                    select c.id
                      from public.assignments c
                      join public.org_members m on m.org_id = :orgId and m.id = :memberId
                           and m.role = 'student' and m.status = 'joined'
                     where c.org_id = :orgId and c.status = 'published' and c.due_at > :now
                       and c.opens_at <= :now
                       and exists (
                         select 1 from public.assignment_targets t
                          where t.org_id = :orgId and t.assignment_id = c.id
                            and (t.member_id = m.id or t.batch_id = m.batch_id))
                    """.trimIndent(),
                ).param("orgId", orgId)
                .param("memberId", memberId)
                .param("now", Timestamp.from(now))
                .query { rs, _ -> UUID.fromString(rs.getString("id")) }
                .list()
        var queued = 0
        for (assignmentId in open) {
            val head = head(orgId, assignmentId) ?: continue
            val email = CampusEmailCopy.newAssignment(assignmentId, head.college, head.title, head.dueAt)
            queued +=
                jdbc
                    .sql(
                        """
                        insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                        select m.user_id, cast(:key as text), cast(:category as text), cast(:subject as text), cast(:body as text)
                          from public.org_members m
                         where m.org_id = :orgId and m.id = :memberId and m.role = 'student' and m.status = 'joined'
                        on conflict (user_id, dedupe_key) do nothing
                        """.trimIndent(),
                    ).param("orgId", orgId)
                    .param("memberId", memberId)
                    .param("key", email.dedupeKey)
                    .param("category", email.category)
                    .param("subject", email.subject)
                    .param("body", email.body)
                    .update()
        }
        return queued
    }

    /**
     * Published assignments that opened after they were published (a programme's later weeks,
     * or any assignment scheduled ahead), across colleges, within the last two days and not yet
     * due. Their new-assignment email was held back at publish; the dedupe key makes sending it
     * again on a later tick a no-op.
     */
    fun openedSince(now: Instant): List<ReminderCandidate> =
        jdbc
            .sql(
                """
                /* unscoped: notification-discovery */
                select c.org_id, c.id
                  from public.assignments c
                  join public.organisations o on o.id = c.org_id and o.status = 'active'
                 where c.status = 'published'
                   and c.opens_at > c.published_at
                   and c.opens_at <= :now
                   and c.opens_at > cast(:now as timestamptz) - interval '2 days'
                   and c.due_at > :now
                """.trimIndent(),
            ).param("now", Timestamp.from(now))
            .query { rs, _ -> ReminderCandidate(UUID.fromString(rs.getString("org_id")), UUID.fromString(rs.getString("id"))) }
            .list()

    /**
     * Published assignments whose reminder window has opened, across colleges. The window is
     * the 48 hours before `due_at`, and only an assignment published more than 48 hours before
     * its deadline qualifies: one published inside the window has already told the student, in
     * the new-assignment email, that it is due soon.
     */
    fun dueForReminder(now: Instant): List<ReminderCandidate> =
        jdbc
            .sql(
                """
                /* unscoped: notification-discovery */
                select c.org_id, c.id
                  from public.assignments c
                  join public.organisations o on o.id = c.org_id and o.status = 'active'
                 where c.status = 'published'
                   and c.due_at > :now and c.due_at <= cast(:now as timestamptz) + interval '48 hours'
                   and c.published_at <= c.due_at - interval '48 hours'
                """.trimIndent(),
            ).param("now", Timestamp.from(now))
            .query { rs, _ -> ReminderCandidate(UUID.fromString(rs.getString("org_id")), UUID.fromString(rs.getString("id"))) }
            .list()

    /** The reminder for one assignment, to recipients who have not completed it. */
    fun enqueueDeadlineReminder(candidate: ReminderCandidate): Int {
        val head = head(candidate.orgId, candidate.assignmentId) ?: return 0
        val email = CampusEmailCopy.deadlineReminder(candidate.assignmentId, head.college, head.title, head.dueAt)
        return insertForRecipients(candidate.orgId, candidate.assignmentId, email, onlyUndone = true)
    }

    /** The student's own session, when it was a college-assigned round that completed. */
    fun finishedAssignedRound(sessionId: UUID): FinishedAssignedRound? =
        jdbc
            .sql(
                """
                /* unscoped: notification-discovery */
                select a.org_id, m.user_id, o.name as college, c.title
                  from public.assignment_attempts a
                  join public.assignments c on c.org_id = a.org_id and c.id = a.assignment_id
                  join public.organisations o on o.id = a.org_id and o.status = 'active'
                  join public.org_members m on m.org_id = a.org_id and m.id = a.member_id
                       and m.role = 'student' and m.status = 'joined'
                 where a.session_id = :sessionId and a.status = 'completed'
                """.trimIndent(),
            ).param("sessionId", sessionId)
            .query { rs, _ ->
                FinishedAssignedRound(
                    UUID.fromString(rs.getString("org_id")),
                    UUID.fromString(rs.getString("user_id")),
                    rs.getString("college"),
                    rs.getString("title"),
                )
            }.optional()
            .orElse(null)

    fun enqueueReportReady(
        sessionId: UUID,
        round: FinishedAssignedRound,
    ): Int {
        val email = CampusEmailCopy.reportReady(sessionId, round.college, round.title)
        return jdbc
            .sql(
                """
                insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                select m.user_id, cast(:key as text), cast(:category as text), cast(:subject as text), cast(:body as text)
                  from public.org_members m
                 where m.org_id = :orgId and m.user_id = :userId and m.role = 'student' and m.status = 'joined'
                on conflict (user_id, dedupe_key) do nothing
                """.trimIndent(),
            ).param("orgId", round.orgId)
            .param("userId", round.userId)
            .param("key", email.dedupeKey)
            .param("category", email.category)
            .param("subject", email.subject)
            .param("body", email.body)
            .update()
    }

    /** Active colleges with at least one joined student. */
    fun weeklyTargets(): List<WeeklyTarget> =
        jdbc
            .sql(
                """
                /* unscoped: notification-discovery */
                select o.id, o.name
                  from public.organisations o
                 where o.status = 'active'
                   and exists (select 1 from public.org_members m
                                where m.org_id = o.id and m.role = 'student' and m.status = 'joined')
                """.trimIndent(),
            ).query { rs, _ -> WeeklyTarget(UUID.fromString(rs.getString("id")), rs.getString("name")) }
            .list()

    /**
     * The week's counts for one college. Joined: students who joined in the week. Active: joined
     * students who practised in the last 14 days (the member list's definition). Due and
     * completed count student-assignment pairs for assignments whose deadline fell in the week;
     * overdue counts pairs past their deadline at [now] and not completed.
     */
    fun weeklyCounts(
        orgId: UUID,
        week: WeekWindow,
        now: Instant,
    ): WeeklyCounts {
        val membership =
            jdbc
                .sql(
                    """
                    select count(*) filter (where m.joined_at >= :weekStart and m.joined_at < :weekEnd) as joined,
                           count(*) filter (where
                             exists (select 1 from public.sessions s
                                      where s.user_id = m.user_id and s.created_at > cast(:now as timestamptz) - interval '14 days')
                             or exists (select 1 from public.user_step_answers a
                                         where a.user_id = m.user_id and a.answered_at > cast(:now as timestamptz) - interval '14 days')
                             or exists (select 1 from public.arena_cards k
                                         where k.user_id = m.user_id and k.last_review > cast(:now as timestamptz) - interval '14 days')) as active
                      from public.org_members m
                     where m.org_id = :orgId and m.role = 'student' and m.status = 'joined'
                    """.trimIndent(),
                ).param("orgId", orgId)
                .param("weekStart", Timestamp.from(week.start))
                .param("weekEnd", Timestamp.from(week.end))
                .param("now", Timestamp.from(now))
                .query { rs, _ -> rs.getInt("joined") to rs.getInt("active") }
                .single()
        val work =
            jdbc
                .sql(
                    """
                    select count(*) filter (where p.due_at >= :weekStart and p.due_at < :weekEnd) as due,
                           count(*) filter (where p.due_at >= :weekStart and p.due_at < :weekEnd and p.done) as completed,
                           count(*) filter (where p.due_at < :now and not p.done) as overdue
                      from (
                        select distinct on (c.id, m.id) c.due_at, ${doneExpression()} as done
                          from public.assignments c
                          join public.assignment_targets t on t.org_id = :orgId and t.assignment_id = c.id
                          join public.org_members m on m.org_id = :orgId and m.role = 'student' and m.status = 'joined'
                               and (t.member_id = m.id or t.batch_id = m.batch_id)
                         where c.org_id = :orgId and c.status = 'published'
                      ) p
                    """.trimIndent(),
                ).param("orgId", orgId)
                .param("weekStart", Timestamp.from(week.start))
                .param("weekEnd", Timestamp.from(week.end))
                .param("now", Timestamp.from(now))
                .query { rs, _ -> Triple(rs.getInt("due"), rs.getInt("completed"), rs.getInt("overdue")) }
                .single()
        return WeeklyCounts(membership.first, membership.second, work.second, work.first, work.third)
    }

    /** The summary for the college's admins and placement officers, one row each. */
    fun enqueueWeekly(
        orgId: UUID,
        email: CampusEmail,
    ): Int =
        jdbc
            .sql(
                """
                insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                select distinct m.user_id, cast(:key as text), cast(:category as text), cast(:subject as text), cast(:body as text)
                  from public.org_members m
                  join public.organisations o on o.id = :orgId and o.status = 'active'
                 where m.org_id = :orgId and m.role in ('college_admin', 'tpo') and m.status = 'joined'
                on conflict (user_id, dedupe_key) do nothing
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("key", email.dedupeKey)
            .param("category", email.category)
            .param("subject", email.subject)
            .param("body", email.body)
            .update()

    // -- private -------------------------------------------------------------------

    private data class Head(
        val college: String,
        val title: String,
        val dueAt: Instant,
    )

    /** The college name and the assignment's title and deadline; null unless it is published in an active college. */
    private fun head(
        orgId: UUID,
        assignmentId: UUID,
    ): Head? =
        jdbc
            .sql(
                """
                select o.name, c.title, c.due_at
                  from public.assignments c
                  join public.organisations o on o.id = :orgId and o.status = 'active'
                 where c.org_id = :orgId and c.id = :assignmentId and c.status = 'published'
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("assignmentId", assignmentId)
            .query { rs, _ -> Head(rs.getString("name"), rs.getString("title"), rs.getTimestamp("due_at").toInstant()) }
            .optional()
            .orElse(null)

    private fun insertForRecipients(
        orgId: UUID,
        assignmentId: UUID,
        email: CampusEmail,
        onlyUndone: Boolean,
    ): Int =
        jdbc
            .sql(
                """
                insert into public.email_deliveries (user_id, dedupe_key, category, subject, body)
                select distinct m.user_id, cast(:key as text), cast(:category as text), cast(:subject as text), cast(:body as text)
                  from public.assignments c
                  join public.assignment_targets t on t.org_id = :orgId and t.assignment_id = c.id
                  join public.org_members m on m.org_id = :orgId and m.role = 'student' and m.status = 'joined'
                       and (t.member_id = m.id or t.batch_id = m.batch_id)
                 where c.org_id = :orgId and c.id = :assignmentId and c.status = 'published'
                   and (not :onlyUndone or not ${doneExpression()})
                on conflict (user_id, dedupe_key) do nothing
                """.trimIndent(),
            ).param("orgId", orgId)
            .param("assignmentId", assignmentId)
            .param("key", email.dedupeKey)
            .param("category", email.category)
            .param("subject", email.subject)
            .param("body", email.body)
            .param("onlyUndone", onlyUndone)
            .update()

    /**
     * Whether student `m` has completed assignment `c`, as the progress view derives it: a
     * completed attempt for an interview, every step answered for a set of Arena scenarios, a
     * submitted attempt for an MCQ test.
     */
    private fun doneExpression(): String =
        """
        (exists (select 1 from public.assignment_attempts a
                  where a.org_id = :orgId and a.assignment_id = c.id and a.member_id = m.id and a.status = 'completed')
         or exists (select 1 from public.mcq_attempts q
                     where q.org_id = :orgId and q.assignment_id = c.id and q.member_id = m.id and q.submitted_at is not null)
         or (c.kind = 'arena_scenarios'
             and exists (select 1 from public.arena_scenario_steps s0 where s0.scenario_id = any(c.scenario_ids))
             and not exists (select 1 from public.arena_scenario_steps s
                              where s.scenario_id = any(c.scenario_ids)
                                and not exists (select 1 from public.user_step_answers ans
                                                 where ans.user_id = m.user_id and ans.step_id = s.id))))
        """.trimIndent()
}
