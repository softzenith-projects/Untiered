package com.interviewos.api.interview

/**
 * The one way a stored report becomes a number. Shared by the candidate's own readiness
 * ([ReadinessService]) and a college's readiness (campus module 6), so the two can never
 * disagree about what a report scored or how much evidence it needs before it scores at all.
 *
 * Works on the report payload already parsed into a map (the stored `session_reports.payload`
 * JSON), so a caller parses each payload once.
 */
object ReportScore {
    /** Below this many assessable turns, a report is not evidence of anything. */
    const val MIN_ASSESSABLE_TURNS = 2

    /**
     * Assessable turns, falling back to answered turns for reports written before the field
     * existed.
     */
    fun assessableTurns(payload: Map<*, *>): Int =
        (payload["assessableTurns"] as? Number)?.toInt()
            ?: (payload["answeredTurns"] as? Number)?.toInt()
            ?: 0

    fun hasEnoughEvidence(payload: Map<*, *>): Boolean = assessableTurns(payload) >= MIN_ASSESSABLE_TURNS

    /**
     * The mean of each competency's score as a percentage of its maximum, unrounded; null when
     * the report has too few assessable turns or no competency with a usable score.
     */
    fun averageCompetencyPercentage(payload: Map<*, *>): Double? {
        if (!hasEnoughEvidence(payload)) return null
        val ratios =
            competencies(payload).mapNotNull { competency ->
                val score = (competency["score"] as? Number)?.toDouble()
                val max = (competency["maxScore"] as? Number)?.toDouble()
                if (score != null && max != null && max > 0) score / max * 100 else null
            }
        return ratios.takeIf { it.isNotEmpty() }?.average()
    }

    fun competencies(payload: Map<*, *>): List<Map<*, *>> = (payload["competencies"] as? List<*>)?.filterIsInstance<Map<*, *>>().orEmpty()
}
