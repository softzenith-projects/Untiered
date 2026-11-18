package com.interviewos.api.campus

import java.time.Instant
import java.time.LocalDate

/**
 * The week-by-week view of a programme (contract "Module 10"). Pure, so the unlock dates and the
 * per-week completion are tested without a database. The numbers come from the same recipient facts
 * as module 10's progress, which the repository has already narrowed to a faculty member's batches,
 * so a week never counts a student the caller may not see.
 */
internal object ProgrammeWeeks {
    fun rows(
        startsOn: LocalDate,
        modules: List<ProgrammeAssignmentRow>,
        facts: List<RecipientFacts>,
        now: Instant,
    ): List<ProgrammeWeekView> {
        val factsByAssignment = facts.groupBy { it.assignmentId }
        return modules
            .groupBy { it.week }
            .toSortedMap()
            .map { (week, inWeek) ->
                val opensAt = ProgrammeSchedule.opensAt(startsOn, week)
                val opened = !now.isBefore(opensAt)
                // A student is "set" the week when any of its assignments reached them, and
                // "completed" it when every one of them did.
                val perStudent =
                    inWeek
                        .flatMap { module -> factsByAssignment[module.id].orEmpty().map { it.memberId to it.completed(module.kind) } }
                        .groupBy({ it.first }, { it.second })
                val students = perStudent.size
                val finished = perStudent.values.count { done -> done.size == inWeek.size && done.all { it } }
                ProgrammeWeekView(
                    week = week,
                    opensAt = opensAt.toString(),
                    dueAt = ProgrammeSchedule.dueAt(startsOn, week).toString(),
                    opened = opened,
                    assignments = inWeek.map { ProgrammeWeekAssignment(it.id, it.title) },
                    students = students,
                    completedStudents = finished,
                    completionRate = if (opened && students > 0) finished.toDouble() / students else null,
                )
            }
    }
}
