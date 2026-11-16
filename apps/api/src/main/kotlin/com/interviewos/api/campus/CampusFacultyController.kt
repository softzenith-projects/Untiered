package com.interviewos.api.campus

import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
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

/**
 * The faculty view (contract "Module 8"), for staff only. Thin, like the other campus
 * controllers; every path sits under the campus switch's 404. There is deliberately no student
 * route here: staff notes are never shown to the student they are about.
 */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}")
class CampusFacultyController(
    private val service: CampusFacultyService,
) {
    @GetMapping("/attention")
    fun attention(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) reason: String?,
    ): List<AttentionRow> = service.attention(SupabaseIdentity.from(jwt), orgId, reason)

    @GetMapping("/students/{memberId}/comments")
    fun comments(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
    ): List<StaffComment> = service.comments(SupabaseIdentity.from(jwt), orgId, memberId)

    @PostMapping("/students/{memberId}/comments")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @RequestBody(required = false) request: StaffCommentRequest?,
    ): StaffComment = service.create(SupabaseIdentity.from(jwt), orgId, memberId, request)

    @PatchMapping("/comments/{id}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable id: UUID,
        @RequestBody(required = false) request: StaffCommentRequest?,
    ): StaffComment = service.update(SupabaseIdentity.from(jwt), orgId, id, request)

    @DeleteMapping("/comments/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable id: UUID,
    ) = service.delete(SupabaseIdentity.from(jwt), orgId, id)
}
