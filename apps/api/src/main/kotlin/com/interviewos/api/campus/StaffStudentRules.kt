package com.interviewos.api.campus

import java.time.Instant

/**
 * What a college sees beside one student's score (contract "Module 6", `StudentReadiness.staff`).
 * Pure, so the rules are tested without a database; every input comes from
 * [CampusReadinessService.compute], never recomputed, so the reasons can never disagree with the
 * attention list ([AttentionRules]).
 */
internal object StaffStudentRules {
    fun detail(
        facts: StudentReadinessFacts,
        now: Instant,
    ): StaffStudentDetail =
        StaffStudentDetail(
            lastActiveAt = facts.student.lastActiveAt?.toString(),
            attention = AttentionRules.reasons(facts.result.band, facts.overdue, facts.student.lastActiveAt, now).map { it.wireValue },
            assignedWork =
                facts.work.map {
                    AssignedWorkRow(
                        assignmentId = it.assignmentId,
                        title = it.title,
                        kind = it.kind.dbValue,
                        status = it.status.wireValue,
                        dueAt = it.dueAt.toString(),
                        sessionId = it.sessionId,
                        mcqAttemptId = it.mcqAttemptId,
                    )
                },
        )
}
