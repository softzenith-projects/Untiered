package com.interviewos.api.interview

import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import kotlin.test.assertEquals

/**
 * Every Run in a round leaves one content-free `code_run` event: how it ended and how long it
 * ran. A candidate's Java runs on 19 Nov 2026 were all shown as "stopped after 5 seconds", and
 * nothing on record could say whether that was a loop, a slow runner or a long stack trace.
 */
class CodeRunEventTest {
    private fun ranAndRecorded(result: CodeRunResult): InterviewEvent {
        val s = TurnScenario()
        s.round()
        given(s.harness.codeRunner.run(CodeLanguage.JAVA, "class Main {}", "")).willReturn(result)

        val returned = s.harness.service.runCode(s.candidate, s.sessionId, RunCodeRequest(source = "class Main {}", language = "java"))

        assertEquals(result, returned)
        return s.eventsOf("code_run").single()
    }

    private fun ran(
        exitCode: Int = 0,
        timedOut: Boolean = false,
        outputLimited: Boolean = false,
    ) = CodeRunResult(
        stdout = "",
        stderr = "",
        exitCode = exitCode,
        timedOut = timedOut,
        available = true,
        message = null,
        outputLimited = outputLimited,
        wallTimeMillis = 1840,
    )

    @Test
    fun `a run stopped for printing too much is recorded as that, with its wall time`() {
        val event = ranAndRecorded(ran(exitCode = -1, outputLimited = true))

        assertEquals("output_limited", event.outcome)
        assertEquals(1840L, event.durationMs)
    }

    @Test
    fun `a run stopped at the deadline is recorded as timed out`() {
        assertEquals("timed_out", ranAndRecorded(ran(exitCode = -1, timedOut = true)).outcome)
    }

    @Test
    fun `a clean run and a failing one are told apart`() {
        assertEquals("succeeded", ranAndRecorded(ran()).outcome)
        assertEquals("failed", ranAndRecorded(ran(exitCode = 1)).outcome)
    }

    @Test
    fun `a run that never reached a runner is recorded as unavailable`() {
        val event = ranAndRecorded(CodeRunResult.unavailable("No runner."))

        assertEquals("unavailable", event.outcome)
        assertEquals(null, event.durationMs)
    }
}
