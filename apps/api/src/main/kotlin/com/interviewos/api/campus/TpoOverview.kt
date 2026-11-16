package com.interviewos.api.campus

import java.time.DayOfWeek
import java.time.Duration
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneId
import java.time.temporal.TemporalAdjusters
import kotlin.math.roundToInt

/**
 * The TPO overview's figures (campus spec §7, contract "Module 7b"), worked out from the same
 * per-student facts as the rest of the dashboard, so the overview can never disagree with the
 * readiness table beneath it. Pure: every definition below is pinned by a unit test.
 *
 * These numbers describe real students to their college. An average is withheld (null) when it
 * would rest on fewer than [MIN_STUDENTS] students or [MIN_ITEMS] items, so it never stands for
 * one identifiable person, and nothing unknown is ever reported as 0.
 */
internal object TpoOverview {
    const val MIN_STUDENTS = 3
    const val MIN_ITEMS = 3

    /** A topic is a gap when its average is below this — the same line readiness suggestions use. */
    const val GAP_BELOW = ReadinessCalculator.SUGGEST_BELOW
    const val MAX_GAPS = 3
    const val WEEKS = 8

    val PERIOD: Duration = Duration.ofDays(30)

    /** Weeks start on Monday in India time, where the colleges are. */
    val INDIA: ZoneId = ZoneId.of("Asia/Kolkata")

    /**
     * Completed ÷ (completed + overdue + due-now) recipient-assignments, over published
     * assignments; null when there is nothing to divide by.
     */
    fun completionRate(students: List<StudentReadinessFacts>): Double? {
        val completed = students.sumOf { it.completed }
        val denominator = completed + students.sumOf { it.overdue } + students.sumOf { it.dueNow }
        return if (denominator == 0) null else completed.toDouble() / denominator
    }

    /**
     * Students at each stage. `assigned` counts a published assignment once it has opened (or
     * once the student has begun it anyway), and `attempted` and `completed` are subsets of it, so
     * the conversion from one stage to the next never passes 100%.
     */
    fun pipeline(
        students: List<StudentReadinessFacts>,
        invited: Int,
        activeSince: Instant,
    ): DashboardPipeline =
        DashboardPipeline(
            invited = invited,
            joined = students.size,
            active = students.count { it.student.lastActiveAt?.isAfter(activeSince) == true },
            assigned = students.count { it.openAssigned > 0 },
            attempted = students.count { it.openAssigned > 0 && it.attempted },
            completed = students.count { it.completed > 0 },
            interviewReady = students.count { it.result.band.isInterviewReady() },
        )

    /** The mean of the students' component scores; null below [MIN_STUDENTS] students with one. */
    fun componentAverages(students: List<StudentReadinessFacts>): ComponentAverages {
        fun of(component: ReadinessComponent): ComponentAverage {
            val scores = students.mapNotNull { it.result.components[component] }
            return ComponentAverage(average = averageOf(scores, MIN_STUDENTS), students = scores.size)
        }
        return ComponentAverages(
            coding = of(ReadinessComponent.CODING),
            coreCs = of(ReadinessComponent.CORE_CS),
            technicalInterview = of(ReadinessComponent.TECHNICAL_INTERVIEW),
            communication = of(ReadinessComponent.COMMUNICATION),
            aptitude = of(ReadinessComponent.APTITUDE),
        )
    }

    /**
     * Up to [MAX_GAPS] weakest topics, weakest first. A topic's average is over each student's
     * latest item for it, as a heatmap cell's is; a topic with fewer than [MIN_STUDENTS] students,
     * or averaging [GAP_BELOW] or more, is not a gap. Ties keep the contract's topic order.
     */
    fun topGaps(students: List<StudentReadinessFacts>): List<TopGap> =
        ReadinessCalculator.TOPIC_LABELS.keys
            .mapNotNull { topic ->
                // Evidence is newest first, so the first item with the topic is the latest.
                val latest =
                    students.mapNotNull { s ->
                        s.result.evidence
                            .firstOrNull { it.topic == topic }
                            ?.score
                    }
                val average = averageOf(latest, MIN_STUDENTS) ?: return@mapNotNull null
                if (average >= GAP_BELOW) null else TopGap(topic, average, latest.size)
            }.sortedBy { it.average }
            .take(MAX_GAPS)

    /**
     * Completions in the last 30 days and the 30 before, the mean evidence score in each (null
     * below [MIN_ITEMS] items), and completions per week for the last [WEEKS] weeks. A period is
     * half-open, `(start, end]`; nothing after [now] is counted.
     */
    fun trend(
        students: List<StudentReadinessFacts>,
        now: Instant,
    ): DashboardTrend {
        val last = now.minus(PERIOD)
        val prev = last.minus(PERIOD)
        val completions = students.flatMap { it.completionTimes }.filter { !it.isAfter(now) }
        val items = students.flatMap { it.result.evidence }.filter { !it.completedAt.isAfter(now) }

        fun inPeriod(
            at: Instant,
            start: Instant,
            end: Instant,
        ) = at.isAfter(start) && !at.isAfter(end)

        return DashboardTrend(
            completedLast30 = completions.count { inPeriod(it, last, now) },
            completedPrev30 = completions.count { inPeriod(it, prev, last) },
            averageScoreLast30 = averageOf(items.filter { inPeriod(it.completedAt, last, now) }.map { it.score }, MIN_ITEMS),
            averageScorePrev30 = averageOf(items.filter { inPeriod(it.completedAt, prev, last) }.map { it.score }, MIN_ITEMS),
            weekly = weekly(completions, now),
        )
    }

    /** The last [WEEKS] Monday-to-Sunday weeks in India time, this one included, oldest first. */
    internal fun weekly(
        completions: List<Instant>,
        now: Instant,
    ): List<WeeklyCompletions> {
        val thisMonday = LocalDate.ofInstant(now, INDIA).with(TemporalAdjusters.previousOrSame(DayOfWeek.MONDAY))
        return (WEEKS - 1 downTo 0).map { back ->
            val monday = thisMonday.minusWeeks(back.toLong())
            val start = monday.atStartOfDay(INDIA).toInstant()
            val end = monday.plusWeeks(1).atStartOfDay(INDIA).toInstant()
            WeeklyCompletions(
                weekStart = monday.toString(),
                completed = completions.count { !it.isBefore(start) && it.isBefore(end) },
            )
        }
    }

    /** One row per batch in scope, empty batches included, in the order [batches] lists them. */
    fun batches(
        students: List<StudentReadinessFacts>,
        batches: List<ReadinessBatchRow>,
    ): List<BatchOverviewRow> {
        val byBatch = students.groupBy { it.student.batchId }
        return batches.map { batch ->
            val inBatch = byBatch[batch.id].orEmpty()
            BatchOverviewRow(
                batchId = batch.id,
                name = batch.name,
                departmentCode = batch.departmentCode,
                joined = inBatch.size,
                completionRate = completionRate(inBatch),
                averageOverall = averageOf(inBatch.mapNotNull { it.result.overall }, MIN_STUDENTS),
                interviewReady = inBatch.count { it.result.band.isInterviewReady() },
            )
        }
    }

    private fun ReadinessBand.isInterviewReady() = this == ReadinessBand.STRONG || this == ReadinessBand.INTERVIEW_READY

    /** The rounded mean, or null when there are fewer than [minimum] values. */
    private fun averageOf(
        values: List<Int>,
        minimum: Int,
    ): Int? = if (values.size < minimum || values.isEmpty()) null else values.average().roundToInt()
}
