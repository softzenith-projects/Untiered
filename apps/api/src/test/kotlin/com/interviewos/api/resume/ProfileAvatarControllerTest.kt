package com.interviewos.api.resume

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.storage.ObjectStorage
import com.interviewos.api.storage.StorageProperties
import com.interviewos.api.user.UserRepository
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.context.properties.EnableConfigurationProperties
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import java.util.UUID

/** `GET /api/v1/me/avatar`: the account menu's photo. */
@WebMvcTest(ProfileController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiSecurityTestConfiguration::class)
@EnableConfigurationProperties(StorageProperties::class)
class ProfileAvatarControllerTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var resumeService: ResumeService

    @MockitoBean private lateinit var repository: ResumeRepository

    @MockitoBean private lateinit var userRepository: UserRepository

    @MockitoBean private lateinit var storage: ObjectStorage

    private val id = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `returns the caller's own photo as a signed url`() {
        given(repository.avatarPath(id)).willReturn("$id/avatar-1.png")
        given(storage.createSignedUrl("resumes", "$id/avatar-1.png", 3600)).willReturn("https://signed.example/avatar")

        mockMvc
            .perform(get("/api/v1/me/avatar").with(token()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.avatarUrl").value("https://signed.example/avatar"))
    }

    @Test
    fun `refuses a request without a token`() {
        mockMvc
            .perform(get("/api/v1/me/avatar"))
            .andExpect(status().isUnauthorized)

        verifyNoInteractions(repository, storage)
    }

    private fun token() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject(id.toString()).claim("email", "candidate@example.com")
        }
}
