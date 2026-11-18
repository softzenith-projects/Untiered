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

// Programmes (contract "Module 10"). Thin, like the other campus controllers: identity from the
// verified token, then the service, which owns the gate, the permission check and the audit.

/** The template catalogue, written by the platform: 404 for anyone off the allow-list. */
@RestController
@RequestMapping("/api/v1/admin/campus/programme-templates")
class AdminProgrammeTemplateController(
    private val service: CampusProgrammeService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<ProgrammeTemplateView> = service.adminTemplates(SupabaseIdentity.from(jwt))

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody(required = false) request: ProgrammeTemplateRequest?,
    ): ProgrammeTemplateView = service.createTemplate(SupabaseIdentity.from(jwt), request)

    @PatchMapping("/{id}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
        @RequestBody(required = false) request: ProgrammeTemplateRequest?,
    ): ProgrammeTemplateView = service.updateTemplate(SupabaseIdentity.from(jwt), id, request)

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ) = service.deleteTemplate(SupabaseIdentity.from(jwt), id)
}

/** A college's programmes. Under the campus switch's 404. */
@RestController
@RequestMapping("/api/v1/campus/orgs/{orgId}")
class CampusProgrammeController(
    private val service: CampusProgrammeService,
) {
    @GetMapping("/programme-templates")
    fun templates(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): List<ProgrammeTemplateView> = service.templates(SupabaseIdentity.from(jwt), orgId)

    @GetMapping("/programmes")
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
    ): List<ProgrammeView> = service.list(SupabaseIdentity.from(jwt), orgId)

    @PostMapping("/programmes")
    @ResponseStatus(HttpStatus.CREATED)
    fun start(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @RequestBody(required = false) request: StartProgrammeRequest?,
    ): ProgrammeView = service.start(SupabaseIdentity.from(jwt), orgId, request)

    @GetMapping("/programmes/{id}")
    fun get(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable id: UUID,
    ): ProgrammeView = service.get(SupabaseIdentity.from(jwt), orgId, id)

    @GetMapping("/programmes/{id}/progress")
    fun progress(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable id: UUID,
    ): List<ProgrammeProgress> = service.progress(SupabaseIdentity.from(jwt), orgId, id)

    @GetMapping("/programmes/{id}/weeks")
    fun weeks(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable id: UUID,
    ): List<ProgrammeWeekView> = service.weeks(SupabaseIdentity.from(jwt), orgId, id)

    @PostMapping("/programmes/{id}/archive")
    fun archive(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable orgId: UUID,
        @PathVariable id: UUID,
    ): ProgrammeView = service.archive(SupabaseIdentity.from(jwt), orgId, id)
}

/**
 * The student's programmes. Not under the campus switch's path prefix: with the switch off the
 * list answers `[]` and the certificate `404`, so the dashboard can call it for everyone.
 */
@RestController
@RequestMapping("/api/v1/me/programmes")
class MeProgrammeController(
    private val service: CampusProgrammeService,
) {
    @GetMapping
    fun mine(
        @AuthenticationPrincipal jwt: Jwt,
    ): List<MyProgrammeView> = service.mine(SupabaseIdentity.from(jwt))

    @GetMapping("/{id}/certificate")
    fun certificate(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable id: UUID,
    ): CertificateView = service.certificate(SupabaseIdentity.from(jwt), id)
}
