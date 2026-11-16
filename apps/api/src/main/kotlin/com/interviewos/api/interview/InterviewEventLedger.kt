package com.interviewos.api.interview

import com.interviewos.api.common.ApiException
import com.interviewos.api.sources.AdminAccess
import com.interviewos.api.user.SupabaseIdentity
import org.slf4j.LoggerFactory
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.scheduling.annotation.Scheduled
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Component
import org.springframework.stereotype.Repository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Propagation
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RequestParam
import org.springframework.web.bind.annotation.RestController
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

/** One content-free fact about the operation of a live interview. */
data class InterviewEvent(
    val userId: UUID,
    val sessionId: UUID,
    val type: String,
    val turnIndex: Int? = null,
    val requestId: UUID? = null,
    val phase: String? = null,
    val provider: String? = null,
    val operation: String? = null,
    val outcome: String? = null,
    val errorType: String? = null,
    val action: String? = null,
    val intervention: String? = null,
    val durationMs: Long? = null,
    /** The model that served a call or a turn's decision, as its usage reported it. */
    val model: String? = null,
    /** The provider's finish reason, normalised (`stop`, `max_tokens`...). */
    val finishReason: String? = null,
    /**
     * Why: an [com.interviewos.api.ai.AiFailureReason] code on a failed call, or which rule
     * fired on a guard event. Always a code from the `reason` check constraint, never text.
     */
    val reason: String? = null,
)

/**
 * Boundary used by interview code and the provider chain.
 *
 * Implementations must be best effort: operational bookkeeping is never allowed to
 * interrupt a candidate. [NONE] keeps unit tests and non-server constructions explicit.
 */
fun interface InterviewEventRecorder {
    fun record(event: InterviewEvent)

    companion object {
        val NONE = InterviewEventRecorder { }
    }
}

@Repository
class InterviewEventRepository(
    private val jdbc: JdbcClient,
) {
    /** Survives a failed caller transaction so the failure itself remains diagnosable. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun append(event: InterviewEvent) {
        jdbc
            .sql(
                """
                insert into public.interview_events
                  (user_id, session_id, turn_index, request_id, event_type, phase,
                   provider, operation, outcome, error_type, action, intervention, duration_ms,
                   model, finish_reason, reason)
                values
                  (:u, :s, :turn, :request, :event, :phase,
                   :provider, :operation, :outcome, :error, :action, :intervention, :duration,
                   :model, :finish, :reason)
                """.trimIndent(),
            ).param("u", event.userId)
            .param("s", event.sessionId)
            .param("turn", event.turnIndex)
            .param("request", event.requestId)
            .param("event", event.type)
            .param("phase", event.phase)
            .param("provider", event.provider?.take(120))
            .param("operation", event.operation)
            .param("outcome", event.outcome)
            .param("error", event.errorType)
            .param("action", event.action)
            .param("intervention", event.intervention)
            .param("duration", event.durationMs?.coerceIn(0, MAX_DURATION_MS))
            .param("model", event.model?.take(120))
            .param("finish", event.finishReason)
            .param("reason", event.reason)
            .update()
    }

    fun timeline(
        sessionId: UUID,
        limit: Int,
    ): InterviewTimeline? {
        val session =
            jdbc
                .sql(
                    """
                    select s.id, s.user_id, s.status::text as status, s.round_type,
                           s.duration_minutes, s.entered_at, s.ended_at,
                           max(e.occurred_at) as observed_through
                      from public.sessions s
                      left join public.interview_events e on e.session_id = s.id
                     where s.id = :s
                     group by s.id, s.user_id, s.status, s.round_type, s.duration_minutes,
                              s.entered_at, s.ended_at
                    """.trimIndent(),
                ).param("s", sessionId)
                .query { rs, _ -> mapTimeline(rs) }
                .optional()
                .orElse(null) ?: return null

        val events =
            jdbc
                .sql(
                    """
                    select *
                      from (
                        select id, occurred_at, turn_index, request_id, event_type, phase,
                               provider, operation, outcome, error_type, action, intervention, duration_ms,
                               model, finish_reason, reason
                          from public.interview_events
                         where session_id = :s
                         order by occurred_at desc, id desc
                         limit :limit
                      ) recent
                     order by occurred_at, id
                    """.trimIndent(),
                ).param("s", sessionId)
                .param("limit", limit)
                .query { rs, _ -> mapEvent(rs) }
                .list()
        return session.copy(events = events)
    }

    /** Bounded batches keep a delayed deployment from holding one long delete lock. */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    fun purgeBefore(
        cutoff: Instant,
        limit: Int,
    ): Int =
        jdbc
            .sql(
                """
                delete from public.interview_events
                 where id in (
                   select id from public.interview_events
                    where occurred_at < :cutoff
                    order by occurred_at
                    limit :limit
                 )
                """.trimIndent(),
            ).param("cutoff", Timestamp.from(cutoff))
            .param("limit", limit)
            .update()

    private fun mapTimeline(rs: ResultSet): InterviewTimeline {
        val entered = rs.getTimestamp("entered_at")?.toInstant()
        val ended = rs.getTimestamp("ended_at")?.toInstant()
        val observed = rs.getTimestamp("observed_through")?.toInstant()
        val durationEnd = ended ?: observed
        val durationSeconds =
            if (entered != null && durationEnd != null && !durationEnd.isBefore(entered)) {
                java.time.Duration
                    .between(entered, durationEnd)
                    .seconds
            } else {
                null
            }
        return InterviewTimeline(
            sessionId = rs.getObject("id", UUID::class.java),
            userId = rs.getObject("user_id", UUID::class.java),
            status = rs.getString("status"),
            roundType = rs.getString("round_type"),
            durationMinutes = rs.getInt("duration_minutes"),
            enteredAt = entered,
            endedAt = ended,
            observedThrough = observed,
            observedDurationSeconds = durationSeconds,
            events = emptyList(),
        )
    }

    private fun mapEvent(rs: ResultSet) =
        InterviewEventView(
            id = rs.getLong("id"),
            occurredAt = rs.getTimestamp("occurred_at").toInstant(),
            turnIndex = rs.getObject("turn_index")?.let { rs.getInt("turn_index") },
            requestId = rs.getObject("request_id", UUID::class.java),
            event = rs.getString("event_type"),
            phase = rs.getString("phase"),
            provider = rs.getString("provider"),
            operation = rs.getString("operation"),
            outcome = rs.getString("outcome"),
            errorType = rs.getString("error_type"),
            action = rs.getString("action"),
            intervention = rs.getString("intervention"),
            durationMs = rs.getObject("duration_ms")?.let { rs.getLong("duration_ms") },
            model = rs.getString("model"),
            finishReason = rs.getString("finish_reason"),
            reason = rs.getString("reason"),
        )

    private companion object {
        const val MAX_DURATION_MS = 86_400_000L
    }
}

@Service
class DurableInterviewEventRecorder(
    private val repository: InterviewEventRepository,
) : InterviewEventRecorder {
    private val log = LoggerFactory.getLogger(javaClass)

    override fun record(event: InterviewEvent) {
        try {
            repository.append(event)
        } catch (e: RuntimeException) {
            log
                .atWarn()
                .setCause(e)
                .addKeyValue("event", "interview_event_write_failed")
                .addKeyValue("session_id", event.sessionId)
                .addKeyValue("event_type", event.type)
                .log("Could not append interview event; the interview will continue")
        }
    }
}

@RestController
@RequestMapping("/api/v1/admin/interview-events")
class InterviewEventAdminController(
    private val adminAccess: AdminAccess,
    private val repository: InterviewEventRepository,
) {
    @GetMapping("/{sessionId}")
    fun timeline(
        @AuthenticationPrincipal jwt: Jwt,
        @PathVariable sessionId: UUID,
        @RequestParam(defaultValue = "200") limit: Int,
    ): InterviewTimeline {
        adminAccess.require(SupabaseIdentity.from(jwt))
        if (limit !in 1..MAX_EVENTS) {
            throw ApiException.badRequest(
                "Limit must be between 1 and $MAX_EVENTS.",
                code = "invalid_timeline_limit",
            )
        }
        return repository.timeline(sessionId, limit) ?: throw ApiException.notFound()
    }

    private companion object {
        const val MAX_EVENTS = 500
    }
}

data class InterviewTimeline(
    val sessionId: UUID,
    val userId: UUID,
    val status: String,
    val roundType: String,
    val durationMinutes: Int,
    val enteredAt: Instant?,
    val endedAt: Instant?,
    val observedThrough: Instant?,
    /** Ends at session end when known, otherwise at the last durable event. */
    val observedDurationSeconds: Long?,
    val events: List<InterviewEventView>,
)

data class InterviewEventView(
    val id: Long,
    val occurredAt: Instant,
    val turnIndex: Int?,
    val requestId: UUID?,
    val event: String,
    val phase: String?,
    val provider: String?,
    val operation: String?,
    val outcome: String?,
    val errorType: String?,
    val action: String?,
    val intervention: String?,
    val durationMs: Long?,
    val model: String? = null,
    val finishReason: String? = null,
    val reason: String? = null,
)

@Component
class InterviewEventRetentionJob(
    private val repository: InterviewEventRepository,
    private val retention: RetentionProperties,
) {
    @Scheduled(initialDelayString = "PT7M", fixedDelayString = "PT12H")
    fun purge() {
        repository.purgeBefore(retention.cutoffAt(Instant.now()), PURGE_BATCH_SIZE)
    }

    private companion object {
        const val PURGE_BATCH_SIZE = 5_000
    }
}
