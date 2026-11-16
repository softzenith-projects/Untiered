package com.interviewos.api.campus

import com.interviewos.api.common.ApiError
import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import org.slf4j.LoggerFactory
import org.springframework.core.Ordered
import org.springframework.core.annotation.Order
import org.springframework.dao.DuplicateKeyException
import org.springframework.http.HttpStatus
import org.springframework.http.ResponseEntity
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.DeleteMapping
import org.springframework.web.bind.annotation.ExceptionHandler
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PatchMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import org.springframework.web.bind.annotation.RestControllerAdvice
import org.springframework.web.multipart.MultipartFile
import java.util.UUID

// Controllers are thin by design: identity from the verified token, then the service, which
// owns the gate, the permission check and the audit entry. No campus decision is made here.

/** Platform admin: creating and onboarding colleges. 404 for anyone off the allow-list. */
@RestController
@RequestMapping("/api/v1/admin/campus/orgs")
class CampusAdminController(
    private val service: CampusAdminService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<AdminOrgSummary> = service.list(SupabaseIdentity.from(jwt))

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: CreateOrgRequest,
    ): OrgView = service.create(SupabaseIdentity.from(jwt), request)

    @GetMapping("/{orgId}")
    fun get(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): AdminOrgSummary = service.get(SupabaseIdentity.from(jwt), orgId)

    @PatchMapping("/{orgId}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: AdminUpdateOrgRequest,
    ): OrgView = service.update(SupabaseIdentity.from(jwt), orgId, request)

    @PutMapping("/{orgId}/logo")
    fun uploadLogo(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam file: MultipartFile,
    ): OrgView = service.uploadLogo(SupabaseIdentity.from(jwt), orgId, file.size) { file.bytes }
}

/** A college's own routes. Staff of that college, or a platform admin. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}")
class CampusController(
    private val service: CampusOrgService,
) {
    @GetMapping
    fun org(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): OrgView = service.org(SupabaseIdentity.from(jwt), orgId)

    @PatchMapping
    fun updateProfile(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: UpdateOrgProfileRequest,
    ): OrgView = service.updateProfile(SupabaseIdentity.from(jwt), orgId, request)

    @GetMapping("/departments")
    fun departments(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): List<DepartmentView> = service.departments(SupabaseIdentity.from(jwt), orgId)

    @PostMapping("/departments")
    @ResponseStatus(HttpStatus.CREATED)
    fun createDepartment(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: CreateDepartmentRequest,
    ): DepartmentView = service.createDepartment(SupabaseIdentity.from(jwt), orgId, request)

    @PatchMapping("/departments/{departmentId}")
    fun updateDepartment(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable departmentId: UUID,
        @RequestBody request: UpdateDepartmentRequest,
    ): DepartmentView = service.updateDepartment(SupabaseIdentity.from(jwt), orgId, departmentId, request)

    @DeleteMapping("/departments/{departmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteDepartment(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable departmentId: UUID,
    ) = service.deleteDepartment(SupabaseIdentity.from(jwt), orgId, departmentId)

    @GetMapping("/batches")
    fun batches(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) departmentId: UUID?,
    ): List<BatchView> = service.batches(SupabaseIdentity.from(jwt), orgId, departmentId)

    @PostMapping("/batches")
    @ResponseStatus(HttpStatus.CREATED)
    fun createBatch(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: CreateBatchRequest,
    ): BatchView = service.createBatch(SupabaseIdentity.from(jwt), orgId, request)

    @PatchMapping("/batches/{batchId}")
    fun updateBatch(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable batchId: UUID,
        @RequestBody request: UpdateBatchRequest,
    ): BatchView = service.updateBatch(SupabaseIdentity.from(jwt), orgId, batchId, request)

    @DeleteMapping("/batches/{batchId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun deleteBatch(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable batchId: UUID,
    ) = service.deleteBatch(SupabaseIdentity.from(jwt), orgId, batchId)

    @GetMapping("/members")
    fun members(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) role: String?,
        @RequestParam(required = false) batchId: UUID?,
        @RequestParam(required = false) departmentId: UUID?,
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) cursor: String?,
    ): Page<MemberView> = service.members(SupabaseIdentity.from(jwt), orgId, role, batchId, departmentId, q, cursor)

    @PatchMapping("/members/{memberId}")
    fun updateMember(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @RequestBody request: UpdateMemberRequest,
    ): MemberView = service.updateMember(SupabaseIdentity.from(jwt), orgId, memberId, request)

    @DeleteMapping("/members/{memberId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun removeMember(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
    ) = service.removeMember(SupabaseIdentity.from(jwt), orgId, memberId)

    @PatchMapping("/members/{memberId}/role")
    fun changeRole(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @RequestBody request: ChangeRoleRequest,
    ): MemberView = service.changeRole(SupabaseIdentity.from(jwt), orgId, memberId, request)

    @GetMapping("/members/{memberId}/faculty-scopes")
    fun facultyScopes(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
    ): FacultyScopesView = service.facultyScopes(SupabaseIdentity.from(jwt), orgId, memberId)

    @PutMapping("/members/{memberId}/faculty-scopes")
    fun replaceFacultyScopes(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable memberId: UUID,
        @RequestBody request: FacultyScopesView,
    ): FacultyScopesView = service.replaceFacultyScopes(SupabaseIdentity.from(jwt), orgId, memberId, request)

    @GetMapping("/audit-log")
    fun auditLog(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestParam(required = false) cursor: String?,
    ): Page<AuditEntryView> = service.auditLog(SupabaseIdentity.from(jwt), orgId, cursor)
}

/** The caller's own campus context. */
@RestController
@RequestMapping("/api/v1/me/campus")
class MeCampusController(
    private val service: MeCampusService,
) {
    @GetMapping
    fun me(
        @AuthenticationPrincipal jwt: Jwt,
    ): MeCampusView = service.me(SupabaseIdentity.from(jwt))

    @PostMapping("/leave")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun leave(
        @AuthenticationPrincipal jwt: Jwt,
    ) = service.leave(SupabaseIdentity.from(jwt))
}

/**
 * Two people creating the same department code at the same instant both pass the service's
 * check; the unique index stops the second. That is a conflict, not a defect, so it is a 409
 * rather than the 500 the global handler would give it. Ordered ahead of that handler, and
 * limited to the campus controllers.
 */
@RestControllerAdvice(
    assignableTypes = [
        CampusAdminController::class,
        CampusController::class,
        MeCampusController::class,
        CampusOnboardingController::class,
        CampusAdminInviteController::class,
        CampusJoinController::class,
    ],
)
@Order(Ordered.HIGHEST_PRECEDENCE)
class CampusExceptionHandler {
    private val log = LoggerFactory.getLogger(javaClass)

    @ExceptionHandler(DuplicateKeyException::class)
    fun handleDuplicate(ex: DuplicateKeyException): ResponseEntity<ApiError> {
        log.info("Campus write lost a uniqueness race: {}", ex.mostSpecificCause.javaClass.simpleName)
        return ResponseEntity
            .status(HttpStatus.CONFLICT)
            .body(ApiError("conflict", "That changed while you were saving it. Reload and try again."))
    }
}
