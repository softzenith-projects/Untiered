package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for campus modules 6 and 7. Field names and types are the contract's
// (docs/campus-api-contract.md "Module 6" and "Module 7"); change both together.

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
