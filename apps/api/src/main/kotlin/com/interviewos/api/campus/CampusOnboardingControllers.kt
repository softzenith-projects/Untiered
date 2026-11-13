package com.interviewos.api.campus

import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

// Module 3 (contract "Module 3: student onboarding"). Thin, like the module 1–2 controllers:
// identity from the verified token, then the service.

/** A college's imports and invites. College admin and TPO; the service checks which. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}")
class CampusOnboardingController(
    private val service: CampusOnboardingService,
) {
    @PostMapping("/imports")
    @ResponseStatus(HttpStatus.CREATED)
    fun createImport(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam file: MultipartFile,
    ): ImportPreview = service.createImport(SupabaseIdentity.from(jwt), orgId, file.size) { file.bytes }

    @GetMapping("/imports/{importId}")
    fun getImport(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable importId: UUID,
    ): ImportPreview = service.getImport(SupabaseIdentity.from(jwt), orgId, importId)

    @DeleteMapping("/imports/{importId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun discardImport(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable importId: UUID,
    ) = service.discardImport(SupabaseIdentity.from(jwt), orgId, importId)

    @PostMapping("/imports/{importId}/commit")
    fun commitImport(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable importId: UUID,
    ): ImportCommitResult = service.commitImport(SupabaseIdentity.from(jwt), orgId, importId)

    @GetMapping("/invites")
    fun invites(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) role: String?,
        @RequestParam(required = false) batchId: UUID?,
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) cursor: String?,
    ): Page<InviteView> = service.listInvites(SupabaseIdentity.from(jwt), orgId, status, role, batchId, q, cursor)

    @PostMapping("/invites")
    @ResponseStatus(HttpStatus.CREATED)
    fun createInvite(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: CreateInviteRequest,
    ): InviteView = service.createInvite(SupabaseIdentity.from(jwt), orgId, request)

    @PostMapping("/invites/{inviteId}/resend")
    fun resend(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable inviteId: UUID,
    ): InviteView = service.resend(SupabaseIdentity.from(jwt), orgId, inviteId)

    @PostMapping("/invites/{inviteId}/revoke")
    fun revoke(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable inviteId: UUID,
    ): InviteView = service.revoke(SupabaseIdentity.from(jwt), orgId, inviteId)
}

/** Platform admin: a college's first admin or TPO. 404 for anyone off the allow-list. */
@RestController
@RequestMapping("/api/v1/admin/campus/orgs/{orgId}/invites")
class CampusAdminInviteController(
    private val service: CampusOnboardingService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) cursor: String?,
    ): Page<InviteView> = service.adminListInvites(SupabaseIdentity.from(jwt), orgId, cursor)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: AdminCreateInviteRequest,
    ): InviteView = service.adminCreateInvite(SupabaseIdentity.from(jwt), orgId, request)
}

/** Opening and accepting an invite link. Any signed-in account. */
@RestController
@RequestMapping("/api/v1/campus/invites/{token}")
class CampusJoinController(
    private val service: CampusJoinService,
) {
    @GetMapping
    fun preview(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable token: String,
    ): InvitePreview = service.preview(SupabaseIdentity.from(jwt), token)

    @PostMapping("/accept")
    fun accept(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable token: String,
        @RequestBody request: AcceptInviteRequest,
    ): AcceptInviteResult = service.accept(SupabaseIdentity.from(jwt), token, request)
}
