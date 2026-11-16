package com.interviewos.api.campus

import java.util.UUID

// Wire shape for campus module 11 (docs/campus-api-contract.md "Module 11"); change both together.

data class OrgUsageRow(
    val orgId: UUID,
    val orgName: String,
    val interviewAllowance: Int,
    /** Org-funded attempts that did not fail: what the allowance has spent. */
    val interviewsUsed: Int,
    val interviewsThisMonth: Int,
    val aiCostUsd: Double,
    /** Null when no interview started in the range. */
    val aiCostPerInterviewUsd: Double?,
)

/** One college's raw figures for a range, before the cost is turned into dollars. */
data class OrgUsageFacts(
    val orgId: UUID,
    val orgName: String,
    val interviewAllowance: Int,
    val interviewsUsed: Int,
    val interviewsThisMonth: Int,
    /** Org-funded, not-failed attempts started inside the range. */
    val interviewsInRange: Int,
    val microUsd: Long,
)
