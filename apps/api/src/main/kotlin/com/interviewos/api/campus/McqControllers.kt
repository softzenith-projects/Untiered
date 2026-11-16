package com.interviewos.api.campus

import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

// Thin, like the other campus controllers: identity from the verified token, then the service.
// Every path here sits under the campus switch's 404 (`ProductFeatureInterceptor`).

/** The student's MCQ attempts (contract "Module 4b"). */
@RestController
@RequestMapping("/api/v1/me")
class MeMcqController(
    private val service: CampusMcqService,
) {
    @PostMapping("/assignments/{assignmentId}/mcq-attempts")
    @ResponseStatus(HttpStatus.CREATED)
    fun start(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable assignmentId: UUID,
    ): McqAttemptView = service.start(SupabaseIdentity.from(jwt), assignmentId)

    @GetMapping("/mcq-attempts/{attemptId}")
    fun get(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable attemptId: UUID,
    ): McqAttemptView = service.get(SupabaseIdentity.from(jwt), attemptId)

    @PostMapping("/mcq-attempts/{attemptId}/submit")
    fun submit(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable attemptId: UUID,
        @RequestBody(required = false) request: McqSubmitRequest?,
    ): McqAttemptView = service.submit(SupabaseIdentity.from(jwt), attemptId, request)
}

/** A student's MCQ attempt, for staff (contract "Module 4b"). */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}/students/{memberId}/mcq-attempts")
class CampusMcqController(
    private val service: CampusMcqService,
) {
    @GetMapping("/{attemptId}")
    fun view(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @PathVariable attemptId: UUID,
    ): McqAttemptView = service.staffView(SupabaseIdentity.from(jwt), orgId, memberId, attemptId)
}
