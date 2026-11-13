package com.interviewos.api.campus

import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

// Thin, like the module 1–2 controllers: identity from the verified token, then the service,
// which owns the gate, the permission check and the audit entry.

/** A college's assignments (contract "Module 4", College). Behind the campus switch's 404. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}")
class CampusAssignmentController(
    private val service: CampusAssignmentService,
) {
    @GetMapping("/arena-scenarios")
    fun scenarios(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): List<CampusScenarioOption> = service.scenarioOptions(SupabaseIdentity.from(jwt), orgId)

    @GetMapping("/assignments")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) status: String?,
    ): List<AssignmentView> = service.list(SupabaseIdentity.from(jwt), orgId, status)

    @PostMapping("/assignments")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: AssignmentRequest,
    ): AssignmentView = service.create(SupabaseIdentity.from(jwt), orgId, request)

    @GetMapping("/assignments/{assignmentId}")
    fun get(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable assignmentId: UUID,
    ): AssignmentView = service.get(SupabaseIdentity.from(jwt), orgId, assignmentId)

    @PatchMapping("/assignments/{assignmentId}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable assignmentId: UUID,
        @RequestBody request: AssignmentRequest,
    ): AssignmentView = service.update(SupabaseIdentity.from(jwt), orgId, assignmentId, request)

    @PostMapping("/assignments/{assignmentId}/publish")
    fun publish(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable assignmentId: UUID,
    ): AssignmentView = service.publish(SupabaseIdentity.from(jwt), orgId, assignmentId)

    @PostMapping("/assignments/{assignmentId}/archive")
    fun archive(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable assignmentId: UUID,
    ): AssignmentView = service.archive(SupabaseIdentity.from(jwt), orgId, assignmentId)

    @GetMapping("/assignments/{assignmentId}/progress")
    fun progress(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable assignmentId: UUID,
        @RequestParam(required = false) batchId: UUID?,
        @RequestParam(required = false) status: String?,
    ): List<RecipientProgress> = service.progress(SupabaseIdentity.from(jwt), orgId, assignmentId, batchId, status)
}

/**
 * The student's own assignments. Deliberately **not** under `/me/campus`, so the campus
 * switch's 404 does not cover it: the dashboard calls it for everyone, and with the switch off
 * the service answers `[]` (contract "Student").
 */
@RestController
@RequestMapping("/api/v1/me/assignments")
class MeAssignmentsController(
    private val service: CampusAssignmentService,
) {
    @GetMapping
    fun mine(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<AssignedItem> = service.mine(SupabaseIdentity.from(jwt))
}
