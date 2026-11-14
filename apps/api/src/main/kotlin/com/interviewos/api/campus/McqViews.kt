package com.interviewos.api.campus

import java.util.UUID

// Wire shapes for module 4b (docs/campus-api-contract.md, "Module 4b: MCQ tests"). A change
// here changes that file in the same commit, because the web app is built against it.

data class McqBankSummary(
    val courseSlug: String,
    val courseTitle: String,
    val topic: String?,
    val questions: Int,
)

data class McqOptionView(
    val id: String,
    val text: String,
)

/** A question as the student sees it: deliberately no field that could carry the answer key. */
data class McqQuestionView(
    val id: String,
    val prompt: String,
    val code: String?,
    val options: List<McqOptionView>,
)

data class McqReviewItem(
    val questionId: String,
    val chosenOptionId: String?,
    val correctOptionId: String,
    val explanation: String,
)

data class McqResultView(
    val correct: Int,
    val total: Int,
    val score: Int,
    val late: Boolean,
    val review: List<McqReviewItem>,
)

data class McqAttemptView(
    val attemptId: UUID,
    val assignmentId: UUID,
    val assignmentTitle: String,
    val startedAt: String,
    val deadlineAt: String?,
    val questions: List<McqQuestionView>,
    val submittedAt: String?,
    /** Null until the attempt is submitted: the only place a key or an explanation appears. */
    val result: McqResultView?,
)

data class McqAnswer(
    val questionId: String? = null,
    val optionId: String? = null,
)

data class McqSubmitRequest(
    val answers: List<McqAnswer>? = null,
)
