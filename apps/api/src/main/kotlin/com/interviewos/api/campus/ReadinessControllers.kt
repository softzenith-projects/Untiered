package com.interviewos.api.campus

import com.interviewos.api.interview.SessionReportView
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpHeaders
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

// Thin, like the other campus controllers: identity from the verified token, then the service,
// which owns the gate, the permission check and the audit entry. Every path here sits under the
// campus switch's 404 (`ProductFeatureInterceptor`).

/** Readiness and the placement dashboard (contract "Module 6" and "Module 7"), for staff. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}")
class CampusReadinessController(
    private val service: CampusReadinessService,
) {
    @GetMapping("/students/{memberId}/readiness")
    fun student(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
    ): StudentReadiness = service.student(SupabaseIdentity.from(jwt), orgId, memberId)

    @GetMapping("/students/{memberId}/reports/{sessionId}")
    fun report(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @PathVariable sessionId: UUID,
    ): SessionReportView = service.report(SupabaseIdentity.from(jwt), orgId, memberId, sessionId)

    @GetMapping("/readiness-weights")
    fun weights(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): ReadinessWeights = service.weights(SupabaseIdentity.from(jwt), orgId)

    /** A map rather than [ReadinessWeights], so a fractional or missing weight is `weights_invalid`, not a parse error. */
    @PutMapping("/readiness-weights")
    fun updateWeights(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody(required = false) body: Map<String, Any?>?,
    ): ReadinessWeights = service.updateWeights(SupabaseIdentity.from(jwt), orgId, body)

    @GetMapping("/dashboard")
    fun dashboard(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) batchId: UUID?,
        @RequestParam(required = false) departmentId: UUID?,
    ): DashboardView = service.dashboard(SupabaseIdentity.from(jwt), orgId, batchId, departmentId)

    @GetMapping("/students/readiness")
    fun table(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) batchId: UUID?,
        @RequestParam(required = false) departmentId: UUID?,
        @RequestParam(required = false) band: String?,
        @RequestParam(required = false) completion: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(required = false) order: String?,
        @RequestParam(required = false) cursor: String?,
    ): Page<StudentReadinessRow> =
        service.table(
            SupabaseIdentity.from(jwt),
            orgId,
            StudentTableQuery(batchId, departmentId, band, completion, sort, order),
            cursor,
        )

    @GetMapping("/exports/students.csv")
    fun exportCsv(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) batchId: UUID?,
        @RequestParam(required = false) departmentId: UUID?,
        @RequestParam(required = false) band: String?,
        @RequestParam(required = false) completion: String?,
        @RequestParam(required = false) sort: String?,
        @RequestParam(required = false) order: String?,
    ): ResponseEntity<ByteArray> {
        val bytes =
            service.exportCsv(
                SupabaseIdentity.from(jwt),
                orgId,
                StudentTableQuery(batchId, departmentId, band, completion, sort, order),
            )
        return ResponseEntity
            .ok()
            .contentType(MediaType("text", "csv", Charsets.UTF_8))
            .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"students.csv\"")
            .header(HttpHeaders.CACHE_CONTROL, "no-store")
            .body(bytes)
    }

    @PostMapping("/exports/batch-report-viewed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun batchReportViewed(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody(required = false) request: BatchReportViewedRequest?,
    ) = service.batchReportViewed(SupabaseIdentity.from(jwt), orgId, request)
}

/** The student's own readiness (contract "Module 6", `GET /me/campus/readiness`). */
@RestController
@RequestMapping("/api/v1/me/campus/readiness")
class MeCampusReadinessController(
    private val service: CampusReadinessService,
) {
    @GetMapping
    fun mine(
        @AuthenticationPrincipal jwt: Jwt,
    ): StudentReadiness = service.mine(SupabaseIdentity.from(jwt))
}
