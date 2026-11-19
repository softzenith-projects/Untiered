package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import org.junit.jupiter.api.Assertions.assertEquals
import org.junit.jupiter.api.Assertions.assertThrows
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.Mockito.mock
import org.mockito.Mockito.verify
import java.util.UUID

class InterviewTelemetryServiceTest {
    private val repository = mock(SessionRepository::class.java)
    private val events = mock(InterviewEventRecorder::class.java)
    private val service = InterviewTelemetryService(repository, events)
    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")
    private val sessionId = UUID.fromString("2b0e2f6c-7a1e-4a0f-9c3d-5c1b2f9a8e01")

    @Test
    fun `records a known event for the session owner`() {
        given(repository.findSession(sessionId, userId)).willReturn(mock(SessionRow::class.java))

        service.record(
            userId,
            sessionId,
            InterviewClientEventRequest(
                event = "model_audio_stalled",
                turnIndex = 3,
                durationMs = 18_000,
            ),
        )

        verify(events).record(
            InterviewEvent(
                userId = userId,
                sessionId = sessionId,
                type = "model_audio_stalled",
                turnIndex = 3,
                outcome = "failed",
                errorType = "browser_media_error",
                durationMs = 18_000,
            ),
        )
    }

    @Test
    fun `records a turn resumed after an automatic submit as a neutral event with the window used`() {
        given(repository.findSession(sessionId, userId)).willReturn(mock(SessionRow::class.java))

        service.record(
            userId,
            sessionId,
            InterviewClientEventRequest(
                event = "turn_resumed_after_submit",
                turnIndex = 2,
                durationMs = 2_500,
                phase = "submitting",
            ),
        )

        verify(events).record(
            InterviewEvent(
                userId = userId,
                sessionId = sessionId,
                type = "turn_resumed_after_submit",
                turnIndex = 2,
                phase = "submitting",
                durationMs = 2_500,
            ),
        )
    }

    @Test
    fun `rejects an event outside the privacy-safe vocabulary`() {
        given(repository.findSession(sessionId, userId)).willReturn(mock(SessionRow::class.java))

        val error =
            assertThrows(ApiException::class.java) {
                service.record(
                    userId,
                    sessionId,
                    InterviewClientEventRequest("free_form_event", turnIndex = 3),
                )
            }

        assertEquals(400, error.status.value())
        assertEquals("invalid_client_event", error.code)
    }

    @Test
    fun `does not reveal a session that the caller does not own`() {
        given(repository.findSession(sessionId, userId)).willReturn(null)

        val error =
            assertThrows(ApiException::class.java) {
                service.record(
                    userId,
                    sessionId,
                    InterviewClientEventRequest("model_audio_error", turnIndex = 3),
                )
            }

        assertEquals(404, error.status.value())
        assertEquals("not_found", error.code)
    }
}
