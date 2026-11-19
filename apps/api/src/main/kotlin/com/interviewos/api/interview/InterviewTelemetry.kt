package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import jakarta.validation.constraints.NotBlank
import org.slf4j.LoggerFactory
import org.springframework.http.HttpStatus
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class InterviewClientEventRequest(
    @field:NotBlank
    val event: String,
    @field:Min(0)
    val turnIndex: Int? = null,
    @field:Min(0)
    @field:Max(600_000)
    val durationMs: Long? = null,
    val requestId: UUID? = null,
    val phase: String? = null,
)

/**
 * Records the small, fixed set of failures that can only be observed in the browser.
 *
 * The payload intentionally excludes free-form detail, URLs, device data, transcript,
 * question text and audio. A fixed vocabulary makes these events safe to aggregate and
 * prevents this support endpoint becoming an accidental personal-data sink.
 */
@Service
class InterviewTelemetryService(
    private val repository: SessionRepository,
    private val events: InterviewEventRecorder,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    fun record(
        userId: UUID,
        sessionId: UUID,
        request: InterviewClientEventRequest,
    ) {
        repository.findSession(sessionId, userId) ?: throw ApiException.notFound()
        if (request.event !in ALLOWED_EVENTS) {
            throw ApiException.badRequest(
                message = "Unknown interview client event.",
                code = "invalid_client_event",
            )
        }
        if (request.phase != null && request.phase !in ALLOWED_PHASES) {
            throw ApiException.badRequest(
                message = "Unknown interview client phase.",
                code = "invalid_client_phase",
            )
        }

        events.record(
            InterviewEvent(
                userId = userId,
                sessionId = sessionId,
                type = request.event,
                turnIndex = request.turnIndex,
                requestId = request.requestId,
                phase = request.phase,
                outcome = clientOutcome(request.event),
                errorType = clientErrorType(request.event),
                durationMs = request.durationMs,
            ),
        )

        if (request.event in FAILURE_EVENTS) {
            val event =
                log
                    .atWarn()
                    .addKeyValue("event", "interview_client_failure")
                    .addKeyValue("event_type", request.event)
                    .addKeyValue("session_id", sessionId)
                    .addKeyValue("turn_index", request.turnIndex)
            request.durationMs?.let { event.addKeyValue("duration_ms", it) }
            event.log("Interview client reported a failure")
        }
    }

    private companion object {
        val ALLOWED_EVENTS =
            setOf(
                "client_phase_changed",
                "client_heartbeat",
                "client_page_hidden",
                "answer_submission_started",
                "answer_submission_failed",
                "answer_submission_slow",
                "browser_speech_failed",
                "browser_speech_timed_out",
                "question_audio_poll_timed_out",
                "model_audio_play_rejected",
                "model_audio_error",
                "model_audio_stalled",
                "model_audio_timed_out",
                "turn_resumed_after_submit",
            )
        val ALLOWED_PHASES =
            setOf("loading", "checking", "asking", "answering", "submitting", "closing", "complete", "terminal", "error")
        val FAILURE_EVENTS =
            ALLOWED_EVENTS -
                setOf(
                    "client_phase_changed",
                    "client_heartbeat",
                    "client_page_hidden",
                    "answer_submission_started",
                    "answer_submission_slow",
                    "turn_resumed_after_submit",
                )

        fun clientOutcome(event: String): String? =
            when {
                event.endsWith("_started") -> "started"

                event.endsWith("_timed_out") -> "timed_out"

                event.endsWith("_failed") || event.endsWith("_error") || event.endsWith("_stalled") ||
                    event.endsWith("_rejected") -> "failed"

                else -> null
            }

        fun clientErrorType(event: String): String? =
            when {
                event == "answer_submission_failed" -> "request_failed"

                event == "answer_submission_slow" -> null

                event.endsWith("_timed_out") -> "client_timeout"

                event.endsWith("_failed") || event.endsWith("_error") || event.endsWith("_stalled") ||
                    event.endsWith("_rejected") -> "browser_media_error"

                else -> null
            }
    }
}

@RestController
@RequestMapping("/api/v1/sessions/{sessionId}/client-events")
class InterviewTelemetryController(
    private val telemetry: InterviewTelemetryService,
) {
    @PostMapping
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun record(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable sessionId: UUID,
        @Valid @RequestBody request: InterviewClientEventRequest,
    ) {
        telemetry.record(SupabaseIdentity.from(jwt).id, sessionId, request)
    }
}
