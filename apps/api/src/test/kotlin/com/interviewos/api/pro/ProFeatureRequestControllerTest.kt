package com.interviewos.api.pro

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.user.SupabaseIdentity
import org.junit.jupiter.api.Test
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

@WebMvcTest(ProFeatureRequestController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
class ProFeatureRequestControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var service: ProFeatureRequestService

    private val id = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `records a request for the signed-in caller`() {
        mockMvc
            .perform(
                post("/api/v1/me/pro-feature-requests")
                    .with(token())
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"features":["more_practice","progress"],"note":"Longer system design rounds"}"""),
            ).andExpect(status().isNoContent)

        verify(service).submit(
            SupabaseIdentity(id, "candidate@example.com", null),
            ProFeatureRequest(listOf("more_practice", "progress"), "Longer system design rounds"),
        )
    }

    @Test
    fun `rejects a request without a token`() {
        mockMvc
            .perform(
                post("/api/v1/me/pro-feature-requests")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"features":["progress"]}"""),
            ).andExpect(status().isUnauthorized)

        verifyNoInteractions(service)
    }

    private fun token() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(id.toString()).claim("email", "candidate@example.com")
        }
}
