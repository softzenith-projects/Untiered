package com.interviewos.api.campus

import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import org.junit.jupiter.api.Test
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/**
 * With the campus switch off (the default), the college routes answer 404 like every other
 * campus route, while `GET /me/assignments` answers `[]`: the dashboard calls it for everyone.
 */
@WebMvcTest(controllers = [CampusAssignmentController::class, MeAssignmentsController::class])
@Import(
    SecurityConfig::class,
    ApiErrorWriter::class,
    ApiExceptionHandler::class,
    ApiSecurityTestConfiguration::class,
    CampusAssignmentService::class,
)
class MeAssignmentsSwitchOffTest {
    @Autowired private lateinit var mockMvc: MockMvc

    @MockitoBean private lateinit var access: CampusAccess

    @MockitoBean private lateinit var assignments: AssignmentRepository

    @MockitoBean private lateinit var audit: CampusAudit

    @Test
    fun `the student's list is empty and the college routes are closed`() {
        mockMvc
            .perform(get("/api/v1/me/assignments").with(signedIn()))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.length()").value(0))
        mockMvc
            .perform(get("/api/v1/campus/orgs/0a000000-0000-0000-0000-00000000000a/assignments").with(signedIn()))
            .andExpect(status().isNotFound)

        verifyNoInteractions(access, assignments, audit)
    }

    private fun signedIn() =
        jwt().jwt { builder: Jwt.Builder ->
            builder.subject("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11").claim("email", "student@college.edu")
        }
}
