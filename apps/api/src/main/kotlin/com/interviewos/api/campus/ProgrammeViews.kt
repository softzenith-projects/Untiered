package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for module 10 (docs/campus-api-contract.md, "Module 10: programmes"). A change
// here changes that file in the same commit, because the web app is built against it.

/**
 * `Omit<AssignmentInput, "opensAt" | "dueAt" | "targets">`. Every field is optional here, so a
 * bad or missing value is a `400 assignment_invalid` naming the field, not a parse failure; a
 * stored template holds the validated, normalised values.
 */
data class ProgrammeAssignmentSpec(
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
    val allowLate: Boolean? = null,
    val attemptLimit: Int? = null,
    val interviewCap: Int? = null,
    val component: String? = null,
    val topic: String? = null,
)

data class ProgrammeModule(
    val week: Int? = null,
    val assignment: ProgrammeAssignmentSpec? = null,
)

data class ProgrammeTemplateView(
    val id: UUID,
    val title: String,
    val description: String,
    val weeks: Int,
    val modules: List<ProgrammeModule>,
    val createdAt: String,
)

/** `POST` (every field) and `PATCH` (an absent field is left unchanged) of a template. */
data class ProgrammeTemplateRequest(
    val title: String? = null,
    val description: String? = null,
    val weeks: Int? = null,
    val modules: List<ProgrammeModule>? = null,
)

/** `POST /campus/orgs/{org}/programmes`. */
data class StartProgrammeRequest(
    val templateId: UUID? = null,
    val title: String? = null,
    val startsOn: String? = null,
    val batchIds: List<UUID>? = null,
)

data class ProgrammeView(
    val id: UUID,
    val templateId: UUID?,
    val title: String,
    val startsOn: String,
    val weeks: Int,
    val targetBatches: List<TargetBatchView>,
    val assignmentIds: List<UUID>,
    val status: String,
)

/** `GET /me/programmes`: a [ProgrammeView] with the student's own progress. */
data class MyProgrammeView(
    val id: UUID,
    val templateId: UUID?,
    val title: String,
    val startsOn: String,
    val weeks: Int,
    val targetBatches: List<TargetBatchView>,
    val assignmentIds: List<UUID>,
    val status: String,
    val completedModules: Int,
    val totalModules: Int,
    val certificateId: String?,
)

/** One assignment of a programme week. */
data class ProgrammeWeekAssignment(
    val id: UUID,
    val title: String,
)

/**
 * One week of a programme (contract "Module 10", `GET …/programmes/{id}/weeks`): when it opens,
 * whether it has, and how many of the students it was set for have finished all of it.
 */
data class ProgrammeWeekView(
    val week: Int,
    /** Opens at 09:00 IST on `startsOn + 7(n − 1)` days. */
    val opensAt: String,
    val dueAt: String,
    /** False while the week is still locked. */
    val opened: Boolean,
    val assignments: List<ProgrammeWeekAssignment>,
    /** Students the week's assignments were set for, inside the caller's scope. */
    val students: Int,
    /** Of those, students who completed every assignment of the week. */
    val completedStudents: Int,
    /** `completedStudents ÷ students`, 0–1; null while the week is locked or nobody is set it. */
    val completionRate: Double?,
)

data class ProgrammeProgress(
    val memberId: UUID,
    val name: String?,
    val completedModules: Int,
    val totalModules: Int,
    val certificateIssued: Boolean,
)

data class CertificateView(
    val programmeTitle: String,
    val studentName: String,
    val orgName: String,
    val orgLogoUrl: String?,
    val completedAt: String,
    val certificateId: String,
)
