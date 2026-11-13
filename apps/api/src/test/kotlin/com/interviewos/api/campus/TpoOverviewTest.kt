package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Duration
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

/**
 * Every definition of the TPO overview (contract "Module 7b"). These figures describe real
 * students to their college, so each is pinned on its own, and so is the rule that an average
 * resting on fewer than three students (or items) is null rather than a number.
 */
class TpoOverviewTest {
    // A Friday, 11:30 India time.
    private val now = Instant.parse("2026-11-13T06:00:00Z")
    private val activeSince = now.minus(Duration.ofDays(14))

    // -- pipeline ---------------------------------------------------------------------

    @Test
    fun `each pipeline stage counts students, and attempted is a subset of assigned`() {
        val students =
            listOf(
                // Joined only, never active, nothing set.
                facts(lastActiveAt = null),
                // Active, set work that has opened, has not touched it.
                facts(lastActiveAt = now.minus(Duration.ofDays(1)), openAssigned = 1),
                // Attempted but not completed.
                facts(lastActiveAt = now.minus(Duration.ofDays(20)), openAssigned = 2, attempted = true),
                // Completed one, and interview ready.
                facts(openAssigned = 1, attempted = true, completed = 1, band = ReadinessBand.INTERVIEW_READY),
                // Completed, and strong.
                facts(openAssigned = 1, attempted = true, completed = 1, band = ReadinessBand.STRONG),
                // An attempt flag without anything assigned (an assignment not open yet) is not counted.
                facts(openAssigned = 0, attempted = true),
            )

        val pipeline = TpoOverview.pipeline(students, invited = 9, activeSince = activeSince)

        assertEquals(9, pipeline.invited)
        assertEquals(6, pipeline.joined)
        // The default lastActiveAt is two days ago, so four students are active.
        assertEquals(4, pipeline.active)
        assertEquals(4, pipeline.assigned)
        assertEquals(3, pipeline.attempted)
        assertEquals(2, pipeline.completed)
        assertEquals(2, pipeline.interviewReady, "strong and interview_ready both count")
    }

    @Test
    fun `needs improvement and not enough evidence are not interview ready`() {
        val students =
            listOf(
                facts(band = ReadinessBand.NEEDS_IMPROVEMENT),
                facts(band = ReadinessBand.NEEDS_STRUCTURED_PREP),
                facts(band = ReadinessBand.NOT_ENOUGH_EVIDENCE),
            )

        assertEquals(0, TpoOverview.pipeline(students, 0, activeSince).interviewReady)
    }

    // -- component averages -------------------------------------------------------------

    @Test
    fun `a component average needs three students with a score, and a student without one is not counted as 0`() {
        val two = listOf(facts(coding = 80), facts(coding = 60), facts(coding = null))
        val twoAverages = TpoOverview.componentAverages(two)
        assertNull(twoAverages.coding.average)
        assertEquals(2, twoAverages.coding.students)

        val three = two + facts(coding = 71)
        val averages = TpoOverview.componentAverages(three)
        assertEquals(70, averages.coding.average, "(80 + 60 + 71) / 3 = 70.33, the null student left out")
        assertEquals(3, averages.coding.students)
        assertNull(averages.aptitude.average)
        assertEquals(0, averages.aptitude.students)
    }

    // -- top gaps -----------------------------------------------------------------------

    @Test
    fun `gaps are the weakest topics below 70 with three students, weakest first, at most three`() {
        val students =
            listOf(
                facts(topics = mapOf("dsa" to 50, "dbms" to 40, "os" to 90, "cn" to 30, "oops" to 65, "aptitude" to 20)),
                facts(topics = mapOf("dsa" to 60, "dbms" to 50, "os" to 80, "cn" to 40, "oops" to 64)),
                facts(topics = mapOf("dsa" to 70, "dbms" to 60, "os" to 70, "cn" to 50, "oops" to 66, "aptitude" to 10)),
            )

        val gaps = TpoOverview.topGaps(students)

        // cn 40, dbms 50, dsa 60, oops 65; os (80) is no gap; aptitude has only two students.
        assertEquals(listOf("cn", "dbms", "dsa"), gaps.map { it.topic })
        assertEquals(listOf(40, 50, 60), gaps.map { it.average })
        assertEquals(listOf(3, 3, 3), gaps.map { it.students })
    }

    @Test
    fun `a gap averages each student's latest item for the topic, and 70 is not a gap`() {
        val student = UUID.randomUUID()
        val older = evidence(ReadinessComponent.CORE_CS, "dbms", 10, now.minus(Duration.ofDays(5)))
        val newer = evidence(ReadinessComponent.CORE_CS, "dbms", 70, now.minus(Duration.ofDays(1)))
        val students =
            listOf(
                facts(memberId = student, evidence = listOf(older, newer)),
                facts(topics = mapOf("dbms" to 70)),
                facts(topics = mapOf("dbms" to 70)),
            )

        assertEquals(emptyList(), TpoOverview.topGaps(students), "the latest items average exactly 70")
        assertEquals(emptyList(), TpoOverview.topGaps(emptyList()))
    }

    // -- trend --------------------------------------------------------------------------

    @Test
    fun `completions are counted in the last 30 days and the 30 before, and nothing after now`() {
        val students =
            listOf(
                facts(
                    completionTimes =
                        listOf(
                            now.minus(Duration.ofDays(1)),
                            now.minus(Duration.ofDays(30)).plusSeconds(1), // just inside the last 30
                            now.minus(Duration.ofDays(30)), // the edge: a period is (start, end], so the previous 30
                            now.minus(Duration.ofDays(59)),
                            now.minus(Duration.ofDays(61)), // in neither
                            now.plusSeconds(60), // clock skew: in neither
                        ),
                ),
                facts(completionTimes = listOf(now.minus(Duration.ofDays(3)))),
            )

        val trend = TpoOverview.trend(students, now)

        assertEquals(3, trend.completedLast30)
        assertEquals(2, trend.completedPrev30)
    }

    @Test
    fun `an average score needs three items in its period`() {
        val recent = now.minus(Duration.ofDays(2))
        val earlier = now.minus(Duration.ofDays(40))
        val students =
            listOf(
                facts(
                    evidence =
                        listOf(
                            evidence(ReadinessComponent.CODING, "dsa", 80, recent),
                            evidence(ReadinessComponent.CODING, "dsa", 61, recent.minusSeconds(60)),
                            evidence(ReadinessComponent.CODING, "dsa", 50, earlier),
                        ),
                ),
                facts(
                    evidence =
                        listOf(
                            evidence(ReadinessComponent.APTITUDE, "aptitude", 70, recent),
                            evidence(ReadinessComponent.APTITUDE, "aptitude", 90, earlier),
                        ),
                ),
            )

        val trend = TpoOverview.trend(students, now)

        assertEquals(70, trend.averageScoreLast30, "(80 + 61 + 70) / 3 = 70.33")
        assertNull(trend.averageScorePrev30, "only two items in the previous 30 days")
    }

    @Test
    fun `the weekly series is the last eight Monday weeks in India time, oldest first`() {
        // Monday 16 November 2026, 00:10 in India is Sunday 15 November 18:40 UTC.
        val mondayMorning = Instant.parse("2026-11-15T18:40:00Z")
        val sundayNight = Instant.parse("2026-11-15T18:20:00Z") // 23:50 Sunday in India
        val weekly =
            TpoOverview.weekly(
                listOf(mondayMorning, sundayNight, sundayNight, Instant.parse("2026-09-28T00:00:00Z")),
                mondayMorning.plusSeconds(60),
            )

        assertEquals(8, weekly.size)
        assertEquals("2026-09-28", weekly.first().weekStart)
        assertEquals("2026-11-16", weekly.last().weekStart)
        assertEquals(1, weekly.last().completed, "00:10 Monday belongs to the new week")
        assertEquals(2, weekly[6].completed, "23:50 Sunday belongs to the week before")
        // 28 September 00:00 UTC is 05:30 that Monday in India: the first week.
        assertEquals(1, weekly.first().completed)
        assertEquals(4, weekly.sumOf { it.completed })
    }

    // -- batches and completion -----------------------------------------------------------

    @Test
    fun `every batch in scope has a row, an empty one included, with averages withheld below three students`() {
        val cse = UUID.randomUUID()
        val ece = UUID.randomUUID()
        val students =
            listOf(
                facts(batchId = cse, overall = 80, band = ReadinessBand.INTERVIEW_READY, completed = 1, overdue = 1),
                facts(batchId = cse, overall = 90, band = ReadinessBand.STRONG, completed = 2),
                facts(batchId = cse, overall = 61, band = ReadinessBand.NEEDS_IMPROVEMENT, dueNow = 1),
                facts(batchId = cse, overall = null, band = ReadinessBand.NOT_ENOUGH_EVIDENCE),
            )
        val rows =
            TpoOverview.batches(
                students,
                listOf(
                    ReadinessBatchRow(cse, "CSE 2027", UUID.randomUUID(), "CSE"),
                    ReadinessBatchRow(ece, "ECE 2027", UUID.randomUUID(), "ECE"),
                ),
            )

        val cseRow = rows[0]
        assertEquals("CSE 2027", cseRow.name)
        assertEquals(4, cseRow.joined)
        assertEquals(77, cseRow.averageOverall, "(80 + 90 + 61) / 3, the student with no overall left out")
        assertEquals(2, cseRow.interviewReady)
        assertEquals(3.0 / 5, cseRow.completionRate)

        val eceRow = rows[1]
        assertEquals(0, eceRow.joined)
        assertNull(eceRow.completionRate)
        assertNull(eceRow.averageOverall)
        assertEquals(0, eceRow.interviewReady)

        val two = TpoOverview.batches(students.take(2), listOf(ReadinessBatchRow(cse, "CSE 2027", UUID.randomUUID(), "CSE")))
        assertNull(two.single().averageOverall, "two students' overall is not an average shown to the college")
    }

    @Test
    fun `completion rate is completed over completed, overdue and due now, and null with nothing set`() {
        assertNull(TpoOverview.completionRate(emptyList()))
        assertNull(TpoOverview.completionRate(listOf(facts())))
        assertEquals(0.5, TpoOverview.completionRate(listOf(facts(completed = 1), facts(overdue = 1))))
    }

    // -- fixtures ------------------------------------------------------------------------

    private fun evidence(
        component: ReadinessComponent,
        topic: String?,
        score: Int,
        at: Instant,
    ) = ReadinessEvidence(
        assignmentId = UUID.randomUUID(),
        assignmentTitle = "Assignment",
        component = component,
        topic = topic,
        kind = AssignmentKind.INTERVIEW,
        sessionId = UUID.randomUUID(),
        score = score,
        completedAt = at,
    )

    private fun facts(
        memberId: UUID = UUID.randomUUID(),
        batchId: UUID = BATCH,
        lastActiveAt: Instant? = now.minus(Duration.ofDays(2)),
        band: ReadinessBand = ReadinessBand.NOT_ENOUGH_EVIDENCE,
        overall: Int? = null,
        coding: Int? = null,
        topics: Map<String, Int> = emptyMap(),
        evidence: List<ReadinessEvidence> =
            topics.entries.mapIndexed { index, (topic, score) ->
                evidence(ReadinessComponent.CORE_CS, topic, score, now.minus(Duration.ofHours(index + 1L)))
            },
        openAssigned: Int = 0,
        attempted: Boolean = false,
        completed: Int = 0,
        overdue: Int = 0,
        dueNow: Int = 0,
        completionTimes: List<Instant> = emptyList(),
    ) = StudentReadinessFacts(
        student =
            ReadinessStudentRow(
                memberId = memberId,
                userId = UUID.randomUUID(),
                name = "Student",
                rollNumber = null,
                batchId = batchId,
                batchName = "CSE 2027",
                departmentId = DEPARTMENT,
                departmentCode = "CSE",
                lastActiveAt = lastActiveAt,
            ),
        result =
            ReadinessResult(
                overall = overall,
                band = band,
                components = ReadinessComponent.entries.associateWith { if (it == ReadinessComponent.CODING) coding else null },
                evidence = evidence.sortedWith(ReadinessCalculator.NEWEST_FIRST),
                suggestions = emptyList(),
            ),
        assigned = openAssigned,
        completed = completed,
        overdue = overdue,
        dueNow = dueNow,
        started = attempted,
        openAssigned = openAssigned,
        attempted = attempted,
        completionTimes = completionTimes,
    )

    private companion object {
        val BATCH: UUID = UUID.randomUUID()
        val DEPARTMENT: UUID = UUID.randomUUID()
    }
}
