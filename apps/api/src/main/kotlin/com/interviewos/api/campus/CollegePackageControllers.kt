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
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

/** Platform admin: a college's packages and payments (contract "Module 14"). 404 for anyone else. */
@RestController
@RequestMapping("/api/v1/admin/campus/orgs/{orgId}/packages")
class AdminCollegePackageController(
    private val service: CollegePackageService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): List<AdminPackageView> = service.adminList(SupabaseIdentity.from(jwt), orgId)

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody request: PackageRequest,
    ): AdminPackageView = service.create(SupabaseIdentity.from(jwt), orgId, request)

    @PatchMapping("/{packageId}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable packageId: UUID,
        @RequestBody request: PackageRequest,
    ): AdminPackageView = service.update(SupabaseIdentity.from(jwt), orgId, packageId, request)

    @PostMapping("/{packageId}/invoice")
    fun invoice(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable packageId: UUID,
        @RequestBody(required = false) request: InvoicePackageRequest?,
    ): AdminPackageView = service.invoice(SupabaseIdentity.from(jwt), orgId, packageId, request ?: InvoicePackageRequest())

    @PostMapping("/{packageId}/paid")
    fun paid(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable packageId: UUID,
        @RequestBody(required = false) request: PayPackageRequest?,
    ): AdminPackageView = service.markPaid(SupabaseIdentity.from(jwt), orgId, packageId, request ?: PayPackageRequest())

    @PostMapping("/{packageId}/void")
    fun void(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable packageId: UUID,
    ): AdminPackageView = service.void(SupabaseIdentity.from(jwt), orgId, packageId)

    @DeleteMapping("/{packageId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable packageId: UUID,
    ) = service.delete(SupabaseIdentity.from(jwt), orgId, packageId)
}

/** Platform admin: every college's package, payments and cost on one page. */
@RestController
@RequestMapping("/api/v1/admin/campus/billing")
class AdminCampusBillingController(
    private val service: CollegePackageService,
) {
    @GetMapping
    fun billing(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<CollegeBillingRow> = service.billing(SupabaseIdentity.from(jwt))
}

/** College staff: the college's packages, as much as their role may see. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}/packages")
class CollegePackageController(
    private val service: CollegePackageService,
) {
    @GetMapping
    fun packages(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): CollegePackagesView = service.collegeView(SupabaseIdentity.from(jwt), orgId)
}
