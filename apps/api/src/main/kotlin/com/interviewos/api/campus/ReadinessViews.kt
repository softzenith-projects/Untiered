package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for campus modules 6, 7 and 7b. Field names and types are the contract's
// (docs/campus-api-contract.md "Module 6", "Module 7" and "Module 7b"); change both together.

data class ReadinessWeights(
    val coding: Int,
    val coreCs: Int,
    val technicalInterview: Int,
    val communication: Int,
    val aptitude: Int,
) {
    companion object {
        fun of(weights: ReadinessWeightSet) =
            ReadinessWeights(weights.coding, weights.coreCs, weights.technicalInterview, weights.communication, weights.aptitude)
    }
}

/** Null is "Not attempted", never 0. */
data class ComponentScores(
    val coding: Int?,
    val coreCs: Int?,
    val technicalInterview: Int?,
    val communication: Int?,
    val aptitude: Int?,
) {
    companion object {
        fun of(scores: Map<ReadinessComponent, Int?>) =
            ComponentScores(
                coding = scores[ReadinessComponent.CODING],
                coreCs = scores[ReadinessComponent.CORE_CS],
                technicalInterview = scores[ReadinessComponent.TECHNICAL_INTERVIEW],
                communication = scores[ReadinessComponent.COMMUNICATION],
                aptitude = scores[ReadinessComponent.APTITUDE],
            )
    }
}

data class EvidenceItem(
    val assignmentId: UUID,
    val assignmentTitle: String,
    val component: String,
    val topic: String?,
    val kind: String,
    val sessionId: UUID?,
    val score: Int,
    val completedAt: String,
    /** MCQ items: the submitted attempt (contract "Module 4b"); null for the other kinds. */
    val mcqAttemptId: UUID? = null,
)

data class SuggestedTopic(
    val component: String,
    val topic: String?,
    val reason: String,
)

data class StudentReadiness(
    val memberId: UUID,
    val name: String?,
    val rollNumber: String?,
    val batchName: String,
    val departmentCode: String,
    val overall: Int?,
    val band: String,
    val components: ComponentScores,
    val weights: ReadinessWeights,
    val evidence: List<EvidenceItem>,
    val suggestedTopics: List<SuggestedTopic>,
)

data class DashboardFilters(
    val batchId: UUID?,
    val departmentId: UUID?,
)

data class HeatmapCell(
    val topic: String,
    /** Null when fewer than three students have evidence: a cell never stands for one person. */
    val average: Int?,
    val students: Int,
)

data class HeatmapRow(
    val departmentId: UUID,
    val departmentCode: String,
    val cells: List<HeatmapCell>,
)

data class Heatmap(
    val columns: List<String>,
    val rows: List<HeatmapRow>,
)

data class DashboardView(
    val filters: DashboardFilters,
    val enrolled: Int,
    val joined: Int,
    val active: Int,
    val completionRate: Double?,
    /** Every `ReadinessBand` value, zero included. */
    val bands: Map<String, Int>,
    val heatmap: Heatmap,
    // Module 7b, the TPO overview.
    val pipeline: DashboardPipeline,
    val componentAverages: ComponentAverages,
    val topGaps: List<TopGap>,
    val trend: DashboardTrend,
    val batches: List<BatchOverviewRow>,
)

/** Students at each stage of practice (contract "Module 7b"). */
data class DashboardPipeline(
    val invited: Int,
    val joined: Int,
    val active: Int,
    val assigned: Int,
    val attempted: Int,
    val completed: Int,
    val interviewReady: Int,
)

data class ComponentAverage(
    /** Null when fewer than three students have a score for the component. */
    val average: Int?,
    val students: Int,
)

data class ComponentAverages(
    val coding: ComponentAverage,
    val coreCs: ComponentAverage,
    val technicalInterview: ComponentAverage,
    val communication: ComponentAverage,
    val aptitude: ComponentAverage,
)

data class TopGap(
    val topic: String,
    val average: Int,
    val students: Int,
)

data class WeeklyCompletions(
    /** A Monday in India time, `YYYY-MM-DD`. */
    val weekStart: String,
    val completed: Int,
)

data class DashboardTrend(
    val completedLast30: Int,
    val completedPrev30: Int,
    /** Null when fewer than three evidence items were completed in the period. */
    val averageScoreLast30: Int?,
    val averageScorePrev30: Int?,
    /** The last eight weeks, oldest first. */
    val weekly: List<WeeklyCompletions>,
)

data class BatchOverviewRow(
    val batchId: UUID,
    val name: String,
    val departmentCode: String,
    val joined: Int,
    val completionRate: Double?,
    /** Null when fewer than three of the batch's students have an overall score. */
    val averageOverall: Int?,
    val interviewReady: Int,
)

data class StudentReadinessRow(
    val memberId: UUID,
    val name: String?,
    val rollNumber: String?,
    val batchName: String,
    val departmentCode: String,
    val overall: Int?,
    val band: String,
    val components: ComponentScores,
    val assignmentsCompleted: Int,
    val assignmentsOverdue: Int,
    val lastActiveAt: String?,
)

data class BatchReportViewedRequest(
    val batchId: UUID? = null,
    val departmentId: UUID? = null,
)
