package com.interviewos.api.courses

import com.interviewos.api.common.ApiException
import com.interviewos.api.interview.CodeLanguage
import com.interviewos.api.interview.CodeRunResult
import com.interviewos.api.interview.CodeRunner
import com.interviewos.api.interview.RunCodeRequest
import jakarta.validation.Valid
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController

/**
 * Runs a course reader's code, so a Java "try it yourself" block has a Run button that
 * does something. Python never comes here: it runs in the reader's own browser.
 *
 * There is no session to own, so the guard is the signed-in account (courses are behind
 * sign-in anyway) plus the hourly `code_runs` limit it shares with the interview room's
 * Run button — see `AiRateLimitConfig`. Without both this would be free compute for
 * anybody who found the URL.
 *
 * Like the round's endpoint, a busy or absent runner is a result that says so, never a
 * failed request.
 */
@RestController
@RequestMapping("/api/v1/code")
class CourseCodeController(
    private val codeRunner: CodeRunner,
) {
    @PostMapping("/run")
    fun run(
        @Valid @RequestBody request: RunCodeRequest,
    ): CodeRunResult {
        val language =
            CodeLanguage.parse(request.language)
                ?: throw ApiException.badRequest("Code runs in Python or Java.")
        return codeRunner.run(language, request.source, request.stdin)
    }
}
