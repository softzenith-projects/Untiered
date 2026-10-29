package com.interviewos.api.courses

import com.interviewos.api.ai.UserAiSpendGuard
import com.interviewos.api.common.ApiErrorWriter
import com.interviewos.api.common.ApiExceptionHandler
import com.interviewos.api.config.ApiSecurityTestConfiguration
import com.interviewos.api.config.SecurityConfig
import com.interviewos.api.interview.CodeLanguage
import com.interviewos.api.interview.CodeRunResult
import com.interviewos.api.interview.CodeRunner
import com.interviewos.api.pool.anyArg
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.never
import org.mockito.Mockito.times
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest
import org.springframework.context.annotation.Import
import org.springframework.http.MediaType
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.test.web.servlet.request.SecurityMockMvcRequestPostProcessors.jwt
import org.springframework.test.context.TestPropertySource
import org.springframework.test.context.bean.override.mockito.MockitoBean
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.header
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status

/** `POST /api/v1/code/run` — a course reader's code, run on the server runner. */
@WebMvcTest(CourseCodeController::class)
@Import(SecurityConfig::class, ApiErrorWriter::class, ApiExceptionHandler::class, ApiSecurityTestConfiguration::class)
@TestPropertySource(properties = ["interviewos.rate-limit.code-runs-per-hour=2"])
class CourseCodeControllerTest {
    @Autowired
    private lateinit var mockMvc: MockMvc

    @MockitoBean
    private lateinit var codeRunner: CodeRunner

    @MockitoBean
    private lateinit var userAiSpendGuard: UserAiSpendGuard

    @Test
    fun `runs Java and hands back what it printed`() {
        given(codeRunner.run(CodeLanguage.JAVA, JAVA_SOURCE, ""))
            .willReturn(CodeRunResult("Namaste, Java!\n", "", 0, timedOut = false, available = true, message = null))

        run("aaaaaaaa-0000-0000-0000-000000000001", """{"language":"java","source":${quoted(JAVA_SOURCE)},"stdin":""}""")
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.stdout").value("Namaste, Java!\n"))
            .andExpect(jsonPath("$.exitCode").value(0))
            .andExpect(jsonPath("$.available").value(true))
    }

    @Test
    fun `an absent runner is a result that says so, not a failed request`() {
        given(codeRunner.run(CodeLanguage.JAVA, JAVA_SOURCE, ""))
            .willReturn(CodeRunResult.unavailable("No runner is configured."))

        run("aaaaaaaa-0000-0000-0000-000000000002", """{"language":"java","source":${quoted(JAVA_SOURCE)}}""")
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.available").value(false))
            .andExpect(jsonPath("$.message").value("No runner is configured."))
    }

    @Test
    fun `refuses a language it does not run`() {
        run("aaaaaaaa-0000-0000-0000-000000000003", """{"language":"cobol","source":"DISPLAY 'HI'."}""")
            .andExpect(status().isBadRequest)

        verify(codeRunner, never()).run(anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `refuses an empty program`() {
        run("aaaaaaaa-0000-0000-0000-000000000004", """{"language":"java","source":""}""")
            .andExpect(status().isBadRequest)

        verify(codeRunner, never()).run(anyArg(), anyArg(), anyArg())
    }

    @Test
    fun `rejects a request with no token`() {
        mockMvc
            .perform(
                post("/api/v1/code/run")
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"language":"java","source":${quoted(JAVA_SOURCE)}}"""),
            ).andExpect(status().isUnauthorized)

        verifyNoInteractions(codeRunner)
    }

    @Test
    fun `answers 429 with Retry-After once an account passes its hourly cap`() {
        given(codeRunner.run(CodeLanguage.JAVA, JAVA_SOURCE, ""))
            .willReturn(CodeRunResult("ok\n", "", 0, timedOut = false, available = true, message = null))
        val body = """{"language":"java","source":${quoted(JAVA_SOURCE)}}"""
        val subject = "aaaaaaaa-0000-0000-0000-000000000005"

        repeat(2) { run(subject, body).andExpect(status().isOk) }
        run(subject, body)
            .andExpect(status().isTooManyRequests)
            .andExpect(jsonPath("$.error").value("rate_limited"))
            .andExpect(header().exists("Retry-After"))

        // Another account still has its own allowance.
        run("aaaaaaaa-0000-0000-0000-000000000006", body).andExpect(status().isOk)
        verify(codeRunner, times(3)).run(CodeLanguage.JAVA, JAVA_SOURCE, "")
    }

    private fun run(
        subject: String,
        body: String,
    ) = mockMvc.perform(
        post("/api/v1/code/run")
            .with(
                jwt().jwt { builder: Jwt.Builder ->
                    builder.subject(subject).claim("email", "reader@example.com")
                },
            ).contentType(MediaType.APPLICATION_JSON)
            .content(body),
    )

    private fun quoted(value: String) = "\"" + value.replace("\\", "\\\\").replace("\"", "\\\"").replace("\n", "\\n") + "\""

    private companion object {
        const val JAVA_SOURCE =
            "public class Hello {\n" +
                "    public static void main(String[] a) {\n" +
                "        System.out.println(\"Namaste, Java!\");\n" +
                "    }\n" +
                "}\n"
    }
}
