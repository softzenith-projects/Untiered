package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import jakarta.servlet.http.HttpServletRequest
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
import tools.jackson.core.JacksonException
import tools.jackson.databind.ObjectMapper
import java.util.UUID

/**
 * `POST /api/v1/campus/leads`: the API's only unauthenticated campus route (SecurityConfig).
 *
 * The body is read here, capped at [MAX_BODY_BYTES], rather than bound by Spring, so that an
 * anonymous caller cannot make the API parse an arbitrarily large document, chunked or not,
 * and so that an unreadable body is the contract's `400 lead_invalid`.
 */
@RestController
@RequestMapping("/api/v1/campus/leads")
class CampusLeadController(
    private val service: CampusLeadService,
    private val objectMapper: ObjectMapper,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.ACCEPTED)
    fun submit(request: HttpServletRequest): LeadReceived {
        if (request.contentLengthLong > MAX_BODY_BYTES) throw tooLarge()
        val bytes = request.inputStream.use { it.readNBytes(MAX_BODY_BYTES + 1) }
        if (bytes.size > MAX_BODY_BYTES) throw tooLarge()
        val lead =
            try {
                objectMapper.readValue(bytes, LeadRequest::class.java)
            } catch (e: JacksonException) {
                throw ApiException.badRequest("The form could not be read. Check each field and try again.", code = "lead_invalid")
            } ?: throw ApiException.badRequest("The form was empty.", code = "lead_invalid")
        service.submit(lead, ClientIp.of(request))
        return LeadReceived()
    }

    private fun tooLarge() = ApiException.badRequest("The form is too long. Shorten the message and try again.", code = "lead_invalid")

    private companion object {
        /** Every field at its maximum, with a Turnstile token, is under 10 KB of JSON. */
        const val MAX_BODY_BYTES = 32 * 1024
    }
}

/** Platform admin: reviewing and converting leads. 404 for anyone off the allow-list. */
@RestController
@RequestMapping("/api/v1/admin/campus/leads")
class CampusLeadAdminController(
    private val service: CampusLeadService,
) {
    @GetMapping
    fun list(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestParam(required = false) status: String?,
        @RequestParam(required = false) q: String?,
        @RequestParam(required = false) cursor: String?,
    ): Page<LeadView> = service.list(SupabaseIdentity.from(jwt), status, q, cursor)

    @GetMapping("/{leadId}")
    fun get(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable leadId: UUID,
    ): LeadView = service.get(SupabaseIdentity.from(jwt), leadId)

    @PatchMapping("/{leadId}")
    fun update(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable leadId: UUID,
        @RequestBody request: UpdateLeadRequest,
    ): LeadView = service.update(SupabaseIdentity.from(jwt), leadId, request)

    @DeleteMapping("/{leadId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun delete(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable leadId: UUID,
    ) = service.delete(SupabaseIdentity.from(jwt), leadId)

    @PostMapping("/{leadId}/convert")
    @ResponseStatus(HttpStatus.CREATED)
    fun convert(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable leadId: UUID,
        @RequestBody request: ConvertLeadRequest,
    ): ConvertLeadResult = service.convert(SupabaseIdentity.from(jwt), leadId, request)
}
