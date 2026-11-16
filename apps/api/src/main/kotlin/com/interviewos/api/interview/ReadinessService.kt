package com.interviewos.api.interview

import org.springframework.stereotype.Service
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * Readiness, derived by grouping completed sessions by (company, role) after the fact.
 *
 * There is deliberately no stored target list — the candidate never declares who they
 * are preparing for, and there is no entity for them to create, edit or clean up
 * (PRD §05, "why there is no stored target list"). If this view ever seems to need one,
 * it does not.
 */
@Service
class ReadinessService(
    private val repository: SessionRepository,
    private val objectMapper: ObjectMapper,
) {
    fun readiness(userId: UUID): List<ReadinessGroup> =
        repository
            .listReportsForReadiness(userId)
            .groupBy { it.companyName to it.roleTitle }
            .map { (key, rows) -> groupOf(key.first, key.second, rows) }
            .sortedByDescending { it.latestAttemptAt }

    /**
     * This candidate's completed sessions for exactly this company and role, case aside.
     * Used by the prep plan to tie a practice round to a pattern the candidate's own past
     * reports actually show, rather than inventing one.
     */
    fun readinessFor(
        userId: UUID,
        companyName: String,
        roleTitle: String,
    ): ReadinessGroup? =
        readiness(userId).firstOrNull {
            it.companyName.equals(companyName, ignoreCase = true) && it.roleTitle.equals(roleTitle, ignoreCase = true)
        }

    private fun groupOf(
        company: String,
        role: String,
        rows: List<ReadinessRow>,
    ): ReadinessGroup {
        val ordered = rows.sortedBy { it.endedAt }
        val evidence = ordered.map { evidenceOf(it.payloadJson) }

        return ReadinessGroup(
            companyName = company,
            roleTitle = role,
            sessionsCompleted = ordered.size,
            firstAttemptAt = ordered.firstOrNull()?.endedAt,
            latestAttemptAt = ordered.lastOrNull()?.endedAt,
            firstAverageScore = evidence.firstOrNull { it.averageScore != null }?.averageScore,
            latestAverageScore = evidence.lastOrNull { it.averageScore != null }?.averageScore,
            recurringWeaknesses = recurringWeaknesses(evidence),
        )
    }

    private fun evidenceOf(payloadJson: String): ReportEvidence {
        val payload =
            try {
                objectMapper.readValue(payloadJson, Map::class.java)
            } catch (_: Exception) {
                return ReportEvidence(null, emptyList())
            }
        if (!ReportScore.hasEnoughEvidence(payload)) return ReportEvidence(null, emptyList())

        val competencies = ReportScore.competencies(payload)
        val averageScore = ReportScore.averageCompetencyPercentage(payload)?.let { Math.round(it * 10) / 10.0 }
        val weakCompetencies =
            competencies
                .mapNotNull { competency ->
                    val name = competency["competency"] as? String ?: return@mapNotNull null
                    val score = (competency["score"] as? Number)?.toDouble() ?: return@mapNotNull null
                    val max = (competency["maxScore"] as? Number)?.toDouble() ?: return@mapNotNull null
                    name.takeIf { max > 0 && score / max < WEAK_THRESHOLD }
                }.distinct()
        return ReportEvidence(averageScore, weakCompetencies)
    }

    /**
     * A competency counts as recurring only if it scored below half in **more than one**
     * completed session. One weak answer is a bad day; twice is a pattern worth naming.
     */
    private fun recurringWeaknesses(evidence: List<ReportEvidence>): List<String> {
        if (evidence.size < 2) return emptyList()

        val weakCounts = mutableMapOf<String, Int>()
        evidence.forEach { report ->
            report.weakCompetencies.forEach { weakCounts.merge(it, 1, Int::plus) }
        }

        return weakCounts.filterValues { it > 1 }.keys.sorted()
    }

    private data class ReportEvidence(
        val averageScore: Double?,
        val weakCompetencies: List<String>,
    )

    companion object {
        private const val WEAK_THRESHOLD = 0.5

        /** The evidence threshold; campus readiness applies the same one ([ReportScore]). */
        const val MIN_ASSESSABLE_TURNS = ReportScore.MIN_ASSESSABLE_TURNS
    }
}
