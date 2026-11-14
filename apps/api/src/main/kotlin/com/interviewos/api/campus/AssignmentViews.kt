package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for module 4 (docs/campus-api-contract.md, "Module 4: assignments"). A change
// here changes that file in the same commit, because the web app is built against it.

data class AssignmentTargets(
    val batchIds: List<UUID>? = null,
    val memberIds: List<UUID>? = null,
)

/** `AssignmentInput.mcq` (contract "Module 4b"): what an MCQ test draws from. */
data class AssignmentMcq(
    val courseSlugs: List<String>? = null,
    val questionCount: Int? = null,
    val timeLimitMinutes: Int? = null,
)

/**
 * `AssignmentInput`, as `POST` and `PATCH` receive it. Every field is optional here so that a
 * bad or missing value is a `400 assignment_invalid` naming the field, not a parse failure.
 */
data class AssignmentRequest(
    val kind: String? = null,
    val title: String? = null,
    val instructions: String? = null,
    val roundType: String? = null,
    val durationMinutes: Int? = null,
    val companyName: String? = null,
    val roleTitle: String? = null,
    val candidateStage: String? = null,
    val focusTopic: String? = null,
    val language: String? = null,
    val scenarioIds: List<String>? = null,
    val mcq: AssignmentMcq? = null,
    val opensAt: String? = null,
    val dueAt: String? = null,
    val allowLate: Boolean? = null,
    val attemptLimit: Int? = null,
    val interviewCap: Int? = null,
    val targets: AssignmentTargets? = null,
    val component: String? = null,
    val topic: String? = null,
)

data class AssignmentCounts(
    val recipients: Int,
    val notStarted: Int,
    val inProgress: Int,
    val completed: Int,
    val overdue: Int,
)

data class TargetBatchView(
    val id: UUID,
    val name: String,
)

data class TargetStudentView(
    val id: UUID,
    val name: String?,
    val rollNumber: String?,
)

data class AssignmentView(
    val id: UUID,
    val kind: String,
    val title: String,
    val instructions: String?,
    val roundType: String?,
    val durationMinutes: Int?,
    val companyName: String?,
    val roleTitle: String?,
    val candidateStage: String?,
    val focusTopic: String?,
    val language: String?,
    val scenarioIds: List<String>?,
    val mcq: AssignmentMcq?,
    val opensAt: String,
    val dueAt: String,
    val allowLate: Boolean,
    val attemptLimit: Int,
    val interviewCap: Int?,
    val targets: AssignmentTargets,
    val component: String,
    val topic: String?,
    val status: String,
    val createdAt: String,
    val publishedAt: String?,
    val createdByName: String?,
    val targetBatches: List<TargetBatchView>,
    val targetStudents: List<TargetStudentView>,
    val counts: AssignmentCounts,
)

data class RecipientProgress(
    val memberId: UUID,
    val name: String?,
    val email: String,
    val rollNumber: String?,
    val batchName: String,
    val status: String,
    val attemptsUsed: Int,
    val lastActivityAt: String?,
    val sessionIds: List<UUID>,
    val scenarioScore: Double?,
    /** MCQ kind: the best submitted score, 0–100; null before any submission. */
    val mcqScore: Int?,
)

data class CampusScenarioOption(
    val id: String,
    val courseTitle: String,
    val title: String,
    val tier: String,
    val estimatedMinutes: Int,
)

data class AssignedScenario(
    val id: String,
    val title: String,
    val courseSlug: String,
    val completed: Boolean,
)

data class AssignedItem(
    val id: UUID,
    val orgName: String,
    val title: String,
    val instructions: String?,
    val kind: String,
    val roundType: String?,
    val durationMinutes: Int?,
    val companyName: String?,
    val roleTitle: String?,
    val candidateStage: String?,
    val language: String?,
    val focusTopic: String?,
    val scenarios: List<AssignedScenario>,
    val opensAt: String,
    val dueAt: String,
    val allowLate: Boolean,
    val status: String,
    val attemptsUsed: Int,
    val attemptLimit: Int,
    val canStart: Boolean,
    val blockedReason: String?,
    val sessionIds: List<UUID>,
    /** MCQ kind: the test's shape; null for the other kinds. */
    val mcq: AssignmentMcq?,
    /** MCQ kind: the best submitted score, 0–100; null before any submission. */
    val mcqScore: Int?,
    /** MCQ kind: the unsubmitted attempt to resume, if there is one. */
    val mcqOpenAttemptId: UUID?,
    /** MCQ kind: the latest submitted attempt, whose result the student can review. */
    val mcqLatestAttemptId: UUID?,
)
