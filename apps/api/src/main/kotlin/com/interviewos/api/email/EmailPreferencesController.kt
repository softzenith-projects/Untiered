package com.interviewos.api.email

import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.user.SupabaseIdentity
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

data class EmailPreferencesView(
    val dailyQuestion: Boolean,
    val announcements: Boolean,
    val reengagement: Boolean,
    val consentedAt: Instant?,
)

data class UpdateEmailPreferences(
    val dailyQuestion: Boolean,
    val announcements: Boolean,
    val reengagement: Boolean,
)

data class ScheduleEmailCampaign(
    val category: String,
    val subject: String,
    val body: String,
    val scheduledAt: Instant,
)

@RestController
@RequestMapping("/api/v1")
class EmailPreferencesController(
    private val emailService: EmailService,
    private val adminAccess: AdminAccess,
) {
    @GetMapping("/me/email-preferences")
    fun preferences(
        @AuthenticationPrincipal jwt: Jwt,
    ): EmailPreferencesView = emailService.preferences(SupabaseIdentity.from(jwt))

    @PutMapping("/me/email-preferences")
    fun updatePreferences(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: UpdateEmailPreferences,
    ): EmailPreferencesView = emailService.updatePreferences(SupabaseIdentity.from(jwt), request)

    /** An opaque token in the email is the authorization for this one narrow action. */
    @PostMapping("/email/unsubscribe/{token}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun unsubscribe(
        @PathVariable token: UUID,
    ) = emailService.unsubscribe(token)

    /** A scheduled, reviewed message. No campaign can be sent without the admin allow-list. */
    @PostMapping("/admin/email-campaigns")
    @ResponseStatus(HttpStatus.CREATED)
    fun scheduleCampaign(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: ScheduleEmailCampaign,
    ): Map<String, UUID> {
        val admin = adminAccess.require(SupabaseIdentity.from(jwt))
        return mapOf("id" to emailService.scheduleCampaign(admin, request))
    }
}
