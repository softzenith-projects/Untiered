package com.interviewos.api.campus

import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull
import kotlin.test.assertTrue

/**
 * Every rule of campus readiness (contract "Module 6, How it is computed"). These numbers
 * describe real students to their college, so each rule is pinned on its own.
 */
class ReadinessCalculatorTest {
    private val weights = ReadinessWeightSet.DEFAULT
    private val start = Instant.parse("2026-11-01T10:00:00Z")

    @Test
    fun `with no evidence every component is not attempted, no overall, no band`() {
        val result = ReadinessCalculator.compute(emptyList(), weights)

        assertTrue(result.components.values.all { it == null }, result.components.toString())
        assertEquals(ReadinessComponent.entries.toSet(), result.components.keys)
        assertNull(result.overall)
        assertEquals(ReadinessBand.NOT_ENOUGH_EVIDENCE, result.band)
        assertEquals(emptyList(), result.suggestions)
    }

    @Test
    fun `a component with no items is null, never 0, and is left out of the overall`() {
        // Coding 80 and aptitude 60 only. Counting the other three as 0 would give
        // (80*30 + 60*10) / 100 = 30; rescaled over the two scored ones it is 75.
        val result =
            ReadinessCalculator.compute(
                listOf(item(ReadinessComponent.CODING, 80), item(ReadinessComponent.APTITUDE, 60, day = 1)),
                weights,
            )

        assertEquals(80, result.components[ReadinessComponent.CODING])
        assertEquals(60, result.components[ReadinessComponent.APTITUDE])
        assertNull(result.components[ReadinessComponent.CORE_CS])
        assertNull(result.components[ReadinessComponent.TECHNICAL_INTERVIEW])
        assertNull(result.components[ReadinessComponent.COMMUNICATION])
        assertEquals(75, result.overall)
        assertEquals(ReadinessBand.INTERVIEW_READY, result.band)
    }

    @Test
    fun `a component is the mean of its latest three items only`() {
        val items =
            listOf(
                item(ReadinessComponent.CODING, 10, day = 0), // oldest: dropped
                item(ReadinessComponent.CODING, 60, day = 1),
                item(ReadinessComponent.CODING, 70, day = 2),
                item(ReadinessComponent.CODING, 81, day = 3),
            )

        val result = ReadinessCalculator.compute(items, weights)

        // (60 + 70 + 81) / 3 = 70.33
        assertEquals(70, result.components[ReadinessComponent.CODING])
        assertEquals(70, result.overall)
        assertEquals(listOf(81, 70, 60, 10), result.evidence.map { it.score }, "evidence is newest first and complete")
    }

    @Test
    fun `weights are rescaled over the scored components`() {
        // Core CS 90 (weight 25) and communication 40 (weight 10): (90*25 + 40*10) / 35 = 75.71.
        val result =
            ReadinessCalculator.compute(
                listOf(item(ReadinessComponent.CORE_CS, 90), item(ReadinessComponent.COMMUNICATION, 40, day = 1)),
                weights,
            )
        assertEquals(76, result.overall)

        // A college's own weights are what is applied.
        val custom = ReadinessWeightSet(coding = 0, coreCs = 50, technicalInterview = 0, communication = 50, aptitude = 0)
        assertEquals(
            65,
            ReadinessCalculator
                .compute(
                    listOf(item(ReadinessComponent.CORE_CS, 90), item(ReadinessComponent.COMMUNICATION, 40, day = 1)),
                    custom,
                ).overall,
        )
    }

    @Test
    fun `when only zero-weight components are scored there is no overall and no band`() {
        val custom = ReadinessWeightSet(coding = 100, coreCs = 0, technicalInterview = 0, communication = 0, aptitude = 0)
        val result =
            ReadinessCalculator.compute(
                listOf(item(ReadinessComponent.APTITUDE, 90), item(ReadinessComponent.APTITUDE, 92, day = 1)),
                custom,
            )

        assertEquals(91, result.components[ReadinessComponent.APTITUDE])
        assertNull(result.overall)
        assertEquals(ReadinessBand.NOT_ENOUGH_EVIDENCE, result.band)
    }

    @Test
    fun `one item is not enough evidence for an overall score or a band`() {
        val result = ReadinessCalculator.compute(listOf(item(ReadinessComponent.CODING, 95)), weights)

        assertEquals(95, result.components[ReadinessComponent.CODING], "the component itself is still shown")
        assertNull(result.overall)
        assertEquals(ReadinessBand.NOT_ENOUGH_EVIDENCE, result.band)
        assertEquals(1, result.evidence.size)
    }

    @Test
    fun `two items are enough`() {
        val result =
            ReadinessCalculator.compute(
                listOf(item(ReadinessComponent.CODING, 95), item(ReadinessComponent.CODING, 85, day = 1)),
                weights,
            )

        assertEquals(90, result.overall)
        assertEquals(ReadinessBand.STRONG, result.band)
    }

    @Test
    fun `band edges fall on the rounded overall`() {
        assertEquals(ReadinessBand.NEEDS_STRUCTURED_PREP, ReadinessCalculator.band(0, 2))
        assertEquals(ReadinessBand.NEEDS_STRUCTURED_PREP, ReadinessCalculator.band(49, 2))
        assertEquals(ReadinessBand.NEEDS_IMPROVEMENT, ReadinessCalculator.band(50, 2))
        assertEquals(ReadinessBand.NEEDS_IMPROVEMENT, ReadinessCalculator.band(69, 2))
        assertEquals(ReadinessBand.INTERVIEW_READY, ReadinessCalculator.band(70, 2))
        assertEquals(ReadinessBand.INTERVIEW_READY, ReadinessCalculator.band(84, 2))
        assertEquals(ReadinessBand.STRONG, ReadinessCalculator.band(85, 2))
        assertEquals(ReadinessBand.STRONG, ReadinessCalculator.band(100, 2))
        assertEquals(ReadinessBand.NOT_ENOUGH_EVIDENCE, ReadinessCalculator.band(100, 1))
        assertEquals(ReadinessBand.NOT_ENOUGH_EVIDENCE, ReadinessCalculator.band(null, 5))
    }

    @Test
    fun `band edges through compute, where rounding decides the band`() {
        fun bandOf(
            a: Int,
            b: Int,
        ) = ReadinessCalculator.compute(listOf(item(ReadinessComponent.CODING, a), item(ReadinessComponent.CODING, b, day = 1)), weights)

        // 49.5 rounds to 50: needs improvement, not structured prep.
        assertEquals(50, bandOf(49, 50).overall)
        assertEquals(ReadinessBand.NEEDS_IMPROVEMENT, bandOf(49, 50).band)
        assertEquals(ReadinessBand.NEEDS_STRUCTURED_PREP, bandOf(49, 49).band)
        assertEquals(ReadinessBand.NEEDS_IMPROVEMENT, bandOf(69, 69).band)
        assertEquals(ReadinessBand.INTERVIEW_READY, bandOf(69, 70).band)
        assertEquals(ReadinessBand.INTERVIEW_READY, bandOf(84, 84).band)
        assertEquals(ReadinessBand.STRONG, bandOf(84, 85).band)
    }

    @Test
    fun `item scores round half up and stay within 0 to 100`() {
        assertEquals(70, ReadinessCalculator.itemScore(69.5))
        assertEquals(69, ReadinessCalculator.itemScore(69.49))
        assertEquals(0, ReadinessCalculator.itemScore(-3.0))
        assertEquals(100, ReadinessCalculator.itemScore(100.4))
    }

    @Test
    fun `suggestions come from components and topics below 70, with sentences built from the numbers`() {
        val dbms1 = UUID.randomUUID()
        val dbms2 = UUID.randomUUID()
        val items =
            listOf(
                item(ReadinessComponent.CORE_CS, 50, day = 0, topic = "dbms", assignment = dbms1),
                item(ReadinessComponent.CORE_CS, 66, day = 1, topic = "dbms", assignment = dbms2),
                item(ReadinessComponent.CODING, 90, day = 2, topic = "dsa"),
                item(ReadinessComponent.COMMUNICATION, 69, day = 3),
            )

        val result = ReadinessCalculator.compute(items, weights)

        assertEquals(
            listOf(
                ReadinessSuggestion(ReadinessComponent.CORE_CS, null, "Average 58 across 2 core CS assignments."),
                ReadinessSuggestion(ReadinessComponent.COMMUNICATION, null, "Scored 69 on 1 communication assignment."),
                ReadinessSuggestion(ReadinessComponent.CORE_CS, "dbms", "Average 58 across 2 DBMS assignments."),
            ),
            result.suggestions,
        )
    }

    @Test
    fun `a component at exactly 70 is not suggested, and no suggestion is invented for a component never attempted`() {
        val result =
            ReadinessCalculator.compute(
                listOf(item(ReadinessComponent.CODING, 70), item(ReadinessComponent.CODING, 70, day = 1)),
                weights,
            )

        assertEquals(emptyList(), result.suggestions)
    }

    @Test
    fun `a reason says latest when older items were left out, and attempts when one assignment was repeated`() {
        val same = UUID.randomUUID()
        val repeated =
            listOf(
                item(ReadinessComponent.APTITUDE, 40, day = 3, assignment = same),
                item(ReadinessComponent.APTITUDE, 50, day = 2, assignment = same),
            )
        assertEquals("Average 45 across 2 attempts at 1 aptitude assignment.", ReadinessCalculator.reason(45, repeated, "aptitude"))

        val many = (0..4).map { item(ReadinessComponent.CODING, 40, day = 10L - it) }
        assertEquals("Average 40 across the latest 3 coding assignments.", ReadinessCalculator.reason(40, many, "coding"))
    }

    @Test
    fun `a topic named like a suggested component is not suggested twice`() {
        val items =
            listOf(
                item(ReadinessComponent.COMMUNICATION, 64, day = 0, topic = "communication"),
                item(ReadinessComponent.CORE_CS, 60, day = 1, topic = "dbms"),
            )

        val result = ReadinessCalculator.compute(items, weights)

        assertEquals(
            listOf(
                ReadinessSuggestion(ReadinessComponent.CORE_CS, null, "Scored 60 on 1 core CS assignment."),
                ReadinessSuggestion(ReadinessComponent.COMMUNICATION, null, "Scored 64 on 1 communication assignment."),
                ReadinessSuggestion(ReadinessComponent.CORE_CS, "dbms", "Scored 60 on 1 DBMS assignment."),
            ),
            result.suggestions,
        )
    }

    @Test
    fun `a topic is averaged over its latest three items`() {
        val items =
            listOf(
                item(ReadinessComponent.CORE_CS, 10, day = 0, topic = "os"),
                item(ReadinessComponent.CORE_CS, 80, day = 1, topic = "os"),
                item(ReadinessComponent.CORE_CS, 80, day = 2, topic = "os"),
                item(ReadinessComponent.CORE_CS, 80, day = 3, topic = "os"),
            )

        val result = ReadinessCalculator.compute(items, weights)

        assertEquals(emptyList(), result.suggestions.filter { it.topic == "os" })
    }

    private fun item(
        component: ReadinessComponent,
        score: Int,
        day: Long = 0,
        topic: String? = null,
        assignment: UUID = UUID.randomUUID(),
    ) = ReadinessEvidence(
        assignmentId = assignment,
        assignmentTitle = "Assignment",
        component = component,
        topic = topic,
        kind = AssignmentKind.INTERVIEW,
        sessionId = UUID.randomUUID(),
        score = score,
        completedAt = start.plusSeconds(day * 86_400),
    )
}
