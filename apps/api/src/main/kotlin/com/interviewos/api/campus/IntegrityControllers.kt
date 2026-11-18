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

/**
 * The student's own integrity routes (contract "Module 5"). They sit under `/sessions/{id}`, so
 * the mock-interview switch closes them with the rest of the room; the campus switch is applied
 * in the service, because the room posts here for every round and must keep getting a `204`.
 */
@RestController
@RequestMapping("/api/v1/sessions/{sessionId}")
class SessionIntegrityController(
    private val service: IntegrityService,
) {
    @PostMapping("/integrity-events")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun record(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable sessionId: UUID,
        @RequestBody(required = false) batch: IntegrityEventBatch?,
    ) = service.record(SupabaseIdentity.from(jwt).id, sessionId, batch)

    @GetMapping("/integrity")
    fun summary(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable sessionId: UUID,
    ): IntegritySummary = service.mine(SupabaseIdentity.from(jwt).id, sessionId)
}

/** The counts of all of one student's assigned rounds, for the staff student page. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}/students/{memberId}/integrity")
class CampusStudentIntegrityController(
    private val service: IntegrityService,
) {
    @GetMapping
    fun totals(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
    ): StudentIntegrityTotals = service.studentTotals(SupabaseIdentity.from(jwt), orgId, memberId)
}

/** The staff view of one assigned round's signals, under the campus switch's 404. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}/students/{memberId}/reports/{sessionId}/integrity")
class CampusIntegrityController(
    private val service: IntegrityService,
) {
    @GetMapping
    fun summary(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @PathVariable sessionId: UUID,
    ): IntegritySummary = service.staff(SupabaseIdentity.from(jwt), orgId, memberId, sessionId)
}
