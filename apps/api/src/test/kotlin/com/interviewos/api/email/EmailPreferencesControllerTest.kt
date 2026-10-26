package com.interviewos.api.email

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.time.Instant
import java.util.UUID

@WebMvcTest(EmailPreferencesController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiSecurityTestConfiguration::class)
class EmailPreferencesControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var emailService: EmailService

    @MockitoBean private lateinit var adminAccess: AdminAccess

    private val id = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val identity = SupabaseIdentity(id, "candidate@example.com", null)

    @Test
    fun `reads and changes only the authenticated caller's choices`() {
        val changed = EmailPreferencesView(true, false, true, Instant.parse("2026-10-23T09:00:00Z"))
        given(emailService.preferences(identity)).willReturn(EmailPreferencesView(false, false, false, null))
        given(emailService.updatePreferences(identity, UpdateEmailPreferences(true, false, true))).willReturn(changed)

        mockMvc
            .perform(get("/api/v1/me/email-preferences").with(token()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.dailyQuestion").value(false))
        mockMvc
            .perform(
                put("/api/v1/me/email-preferences")
                    .with(token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"dailyQuestion":true,"announcements":false,"reengagement":true}"""),
            ).andExpect(status().isOk)
            .andExpect(jsonPath("$.dailyQuestion").value(true))
            .andExpect(jsonPath("$.reengagement").value(true))
    }

    @Test
    fun `rejects preference changes without a token`() {
        mockMvc
            .perform(
                put("/api/v1/me/email-preferences")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"dailyQuestion":true,"announcements":true,"reengagement":true}"""),
            ).andExpect(status().isUnauthorized)
        verifyNoInteractions(emailService)
    }

    @Test
    fun `allows an unsubscribe token without sign in`() {
        mockMvc
            .perform(post("/api/v1/email/unsubscribe/$id"))
            .andExpect(status().isNoContent)
    }

    @Test
    fun `requires authentication before a campaign can be scheduled`() {
        mockMvc
            .perform(
                post("/api/v1/admin/email-campaigns")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"category":"announcement","subject":"News","body":"Hello","scheduledAt":"2026-11-01T09:00:00Z"}"""),
            ).andExpect(status().isUnauthorized)
        verifyNoInteractions(adminAccess, emailService)
    }

    private fun token() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(id.toString()).claim("email", "candidate@example.com")
        }
}
