package com.interviewos.api.campus

import java.time.Instant
import java.util.UUID
import kotlin.math.roundToInt

/** A readiness score's component, as `assignments.readiness_component` stores it. */
enum class ReadinessComponent(
    val wireValue: String,
    /** How a sentence names it. */
    val label: String,
) {
    CODING("coding", "coding"),
    CORE_CS("core_cs", "core CS"),
    TECHNICAL_INTERVIEW("technical_interview", "technical interview"),
    COMMUNICATION("communication", "communication"),
    APTITUDE("aptitude", "aptitude"),
    ;

    companion object {
        fun fromWireValue(value: String?): ReadinessComponent? = entries.firstOrNull { it.wireValue == value }
    }
}

/** Contract `ReadinessBand`. */
enum class ReadinessBand(
    val wireValue: String,
) {
    STRONG("strong"),
    INTERVIEW_READY("interview_ready"),
    NEEDS_IMPROVEMENT("needs_improvement"),
    NEEDS_STRUCTURED_PREP("needs_structured_prep"),
    NOT_ENOUGH_EVIDENCE("not_enough_evidence"),
    ;

    companion object {
        fun fromWireValue(value: String?): ReadinessBand? = entries.firstOrNull { it.wireValue == value }
    }
}

/** A college's weights, integers summing to 100 (the database checks it too). */
data class ReadinessWeightSet(
    val coding: Int,
    val coreCs: Int,
    val technicalInterview: Int,
    val communication: Int,
    val aptitude: Int,
) {
    fun of(component: ReadinessComponent): Int =
        when (component) {
            ReadinessComponent.CODING -> coding
            ReadinessComponent.CORE_CS -> coreCs
            ReadinessComponent.TECHNICAL_INTERVIEW -> technicalInterview
            ReadinessComponent.COMMUNICATION -> communication
            ReadinessComponent.APTITUDE -> aptitude
        }

    val sum: Int get() = coding + coreCs + technicalInterview + communication + aptitude

    companion object {
        /** Campus spec §6. */
        val DEFAULT = ReadinessWeightSet(coding = 30, coreCs = 25, technicalInterview = 25, communication = 10, aptitude = 10)
    }
}

/**
 * One piece of evidence: a completed attempt at one of the college's interview assignments
 * whose report had enough assessable turns, or one completed scenario set. [score] is already
 * an integer 0–100, as the student and staff are shown it.
 */
data class ReadinessEvidence(
    val assignmentId: UUID,
    val assignmentTitle: String,
    val component: ReadinessComponent,
    /** A `CampusTopic` value, or null. */
    val topic: String?,
    val kind: AssignmentKind,
    val sessionId: UUID?,
    val score: Int,
    val completedAt: Instant,
    /** MCQ items: the submitted attempt, which staff can open. */
    val mcqAttemptId: UUID? = null,
)

data class ReadinessSuggestion(
    val component: ReadinessComponent,
    val topic: String?,
    val reason: String,
)

data class ReadinessResult(
    /** Null when there is not enough evidence, or no weighted component has a score. */
    val overall: Int?,
    val band: ReadinessBand,
    /** Every component; null means "Not attempted", never 0. */
    val components: Map<ReadinessComponent, Int?>,
    /** Newest first. */
    val evidence: List<ReadinessEvidence>,
    val suggestions: List<ReadinessSuggestion>,
)

/**
 * Readiness (campus spec §6, contract "Module 6, How it is computed"), from evidence alone and
 * with no AI: pure, so every rule below is pinned by a unit test.
 *
 * - A component's score is the mean of its latest [LATEST_PER_COMPONENT] items. With no items
 *   it is null — "Not attempted" — and it is **never 0**: a student who has not been assessed
 *   on something has not failed it.
 * - The overall score is the weighted mean of the components that have a score, the weights
 *   rescaled over just those components.
 * - Below [MIN_EVIDENCE_ITEMS] items there is no band and no overall number: one round is not a
 *   readiness verdict on a student, and a number shown to their college must be true.
 * - Every figure is an integer, and each is computed from the integers shown beneath it (an
 *   item's score, then the component, then the overall), so anyone reading the page can
 *   reproduce it by hand.
 */
object ReadinessCalculator {
    const val LATEST_PER_COMPONENT = 3
    const val MIN_EVIDENCE_ITEMS = 2
    const val SUGGEST_BELOW = 70

    /** Topic labels for sentences, in the contract's `CampusTopic` order. */
    val TOPIC_LABELS: Map<String, String> =
        linkedMapOf(
            "dsa" to "DSA",
            "dbms" to "DBMS",
            "os" to "OS",
            "oops" to "OOPs",
            "cn" to "CN",
            "system_design" to "system design",
            "communication" to "communication",
            "aptitude" to "aptitude",
        )

    /** Newest first; ties broken by ids so the order never depends on how rows arrived. */
    val NEWEST_FIRST: Comparator<ReadinessEvidence> =
        compareByDescending<ReadinessEvidence> { it.completedAt }
            .thenBy { it.assignmentId }
            .thenBy { it.sessionId }

    fun compute(
        items: List<ReadinessEvidence>,
        weights: ReadinessWeightSet,
    ): ReadinessResult {
        val newestFirst = items.sortedWith(NEWEST_FIRST)
        val byComponent = newestFirst.groupBy { it.component }
        val components =
            ReadinessComponent.entries.associateWith { component ->
                byComponent[component]?.take(LATEST_PER_COMPONENT)?.let { latest -> mean(latest) }
            }
        val enough = newestFirst.size >= MIN_EVIDENCE_ITEMS
        val overall = if (enough) overall(components, weights) else null
        return ReadinessResult(
            overall = overall,
            band = band(overall, newestFirst.size),
            components = components,
            evidence = newestFirst,
            suggestions = suggestions(newestFirst, components),
        )
    }

    /** The integer an item is shown as: a percentage rounded half up, held to 0–100. */
    fun itemScore(percentage: Double): Int = percentage.roundToInt().coerceIn(0, 100)

    /**
     * The band of an overall score that is already rounded. No band below the evidence
     * threshold, and none without an overall score to place.
     */
    fun band(
        overall: Int?,
        evidenceItems: Int,
    ): ReadinessBand =
        when {
            overall == null || evidenceItems < MIN_EVIDENCE_ITEMS -> ReadinessBand.NOT_ENOUGH_EVIDENCE
            overall >= 85 -> ReadinessBand.STRONG
            overall >= 70 -> ReadinessBand.INTERVIEW_READY
            overall >= 50 -> ReadinessBand.NEEDS_IMPROVEMENT
            else -> ReadinessBand.NEEDS_STRUCTURED_PREP
        }

    /**
     * Weighted over the scored components only, with their weights rescaled to sum to 100.
     * Null when no scored component carries any weight: the college has said those components
     * do not count, so there is nothing to put a number on.
     */
    internal fun overall(
        components: Map<ReadinessComponent, Int?>,
        weights: ReadinessWeightSet,
    ): Int? {
        val scored = components.filterValues { it != null }
        val weightSum = scored.keys.sumOf { weights.of(it) }
        if (weightSum == 0) return null
        val weighted = scored.entries.sumOf { (component, score) -> score!!.toDouble() * weights.of(component) }
        return (weighted / weightSum).roundToInt()
    }

    /**
     * One entry for each component scoring below [SUGGEST_BELOW], then one for each topic whose
     * latest items average below it — each lowest first, each with a sentence made only from
     * the numbers it rests on.
     */
    private fun suggestions(
        newestFirst: List<ReadinessEvidence>,
        components: Map<ReadinessComponent, Int?>,
    ): List<ReadinessSuggestion> {
        val byComponent = newestFirst.groupBy { it.component }
        val forComponents =
            ReadinessComponent.entries
                .mapNotNull { component ->
                    val score = components[component] ?: return@mapNotNull null
                    if (score >= SUGGEST_BELOW) return@mapNotNull null
                    val all = byComponent[component].orEmpty()
                    score to ReadinessSuggestion(component, null, reason(score, all, component.label))
                }.sortedBy { it.first }
                .map { it.second }

        val byTopic = newestFirst.filter { it.topic != null }.groupBy { it.topic!! }
        val forTopics =
            TOPIC_LABELS.keys
                .mapNotNull { topic ->
                    val all = byTopic[topic] ?: return@mapNotNull null
                    val score = mean(all.take(LATEST_PER_COMPONENT))
                    if (score >= SUGGEST_BELOW) return@mapNotNull null
                    // The topic's most recent item decides which component it is listed under.
                    score to ReadinessSuggestion(all.first().component, topic, reason(score, all, TOPIC_LABELS.getValue(topic)))
                }.sortedBy { it.first }
                .map { it.second }

        return forComponents + forTopics
    }

    /**
     * "Average 58 across 2 DBMS assignments." Names how many items the figure rests on, says
     * "latest" when older ones were left out, and says "attempts" when one assignment was
     * attempted more than once, so the sentence never overstates the evidence.
     */
    internal fun reason(
        score: Int,
        all: List<ReadinessEvidence>,
        label: String,
    ): String {
        val used = all.take(LATEST_PER_COMPONENT)
        val count = used.size
        val assignments = used.map { it.assignmentId }.distinct().size
        val latest = if (all.size > count) "the latest " else ""
        if (count == 1) return "Scored $score on 1 $label assignment."
        val what =
            if (assignments == count) {
                "$count $label assignments"
            } else {
                "$count attempts at $assignments $label ${if (assignments == 1) "assignment" else "assignments"}"
            }
        return "Average $score across $latest$what."
    }

    private fun mean(items: List<ReadinessEvidence>): Int = items.map { it.score }.average().roundToInt()
}
