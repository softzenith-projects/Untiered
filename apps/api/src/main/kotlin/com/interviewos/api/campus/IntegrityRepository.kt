package com.interviewos.api.campus

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

/**
 * `session_integrity` (campus spec §5): one row of counters per assigned round.
 *
 * Every statement is scoped by the session's owner, not by a college, so a caller can only ever
 * touch a row for a round that is theirs (the two that read `assignment_attempts` carry the
 * `own-session` marker for `CampusSqlGuardTest`); the staff read is reached only after [ReadinessRepository.attemptSessionOwner]
 * has said whose session it is.
 */
@Repository
class IntegrityRepository(
    private val jdbc: JdbcClient,
) {
    /**
     * Adds one batch to the round's counters in a single statement, so two batches sent at once
     * (a flush on `pagehide` racing a timed send) both land. Each counter stops at its cap.
     *
     * Writes only when the session is the owner's **and** was started from an assignment: the
     * insert selects from `sessions` joined to `assignment_attempts`, so a personal round can
     * never get a row, whatever the caller checked beforehand. Returns whether a row was written.
     */
    fun increment(
        sessionId: UUID,
        userId: UUID,
        increments: IntegrityIncrements,
    ): Boolean =
        jdbc
            .sql(
                """
                /* unscoped: own-session */
                insert into public.session_integrity as i (session_id, user_id, tab_hidden, window_blur, pastes, pasted_chars)
                select s.id, s.user_id, least(:tabHidden, :cap), least(:windowBlur, :cap), least(:pastes, :cap),
                       least(:pastedChars, :charsCap)
                  from public.sessions s
                 where s.id = :sessionId and s.user_id = :userId
                   and exists (select 1 from public.assignment_attempts a where a.session_id = s.id)
                on conflict (session_id) do update set
                       tab_hidden = least(i.tab_hidden + excluded.tab_hidden, :cap),
                       window_blur = least(i.window_blur + excluded.window_blur, :cap),
                       pastes = least(i.pastes + excluded.pastes, :cap),
                       pasted_chars = least(i.pasted_chars + excluded.pasted_chars, :charsCap),
                       updated_at = now()
                """.trimIndent(),
            ).param("sessionId", sessionId)
            .param("userId", userId)
            .param("tabHidden", increments.tabHidden)
            .param("windowBlur", increments.windowBlur)
            .param("pastes", increments.pastes)
            .param("pastedChars", increments.pastedChars)
            .param("cap", IntegrityRules.COUNTER_CAP)
            .param("charsCap", IntegrityRules.PASTED_CHARS_CAP)
            .update() > 0

    /** Whether the owner's session was started from an assignment. False for someone else's. */
    fun isAssigned(
        sessionId: UUID,
        userId: UUID,
    ): Boolean =
        jdbc
            .sql(
                """
                /* unscoped: own-session */
                select exists (
                  select 1 from public.sessions s
                    join public.assignment_attempts a on a.session_id = s.id
                   where s.id = :sessionId and s.user_id = :userId)
                """.trimIndent(),
            ).param("sessionId", sessionId)
            .param("userId", userId)
            .query(Boolean::class.java)
            .single()

    /** The round's counters, or zeros when nothing has been sent yet. */
    fun counts(
        sessionId: UUID,
        userId: UUID,
    ): IntegrityCounts =
        jdbc
            .sql(
                """
                select tab_hidden, window_blur, pastes, pasted_chars
                  from public.session_integrity
                 where session_id = :sessionId and user_id = :userId
                """.trimIndent(),
            ).param("sessionId", sessionId)
            .param("userId", userId)
            .query { rs, _ ->
                IntegrityCounts(
                    tabHidden = rs.getInt("tab_hidden"),
                    windowBlur = rs.getInt("window_blur"),
                    pastes = rs.getInt("pastes"),
                    pastedChars = rs.getInt("pasted_chars"),
                )
            }.optional()
            .orElse(IntegrityCounts.ZERO)

    /** The raw `answer_timing` of every answered turn of the owner's session, in turn order. */
    fun answerTimings(
        sessionId: UUID,
        userId: UUID,
    ): List<String> =
        jdbc
            .sql(
                """
                select t.answer_timing::text
                  from public.session_turns t
                  join public.sessions s on s.id = t.session_id
                 where t.session_id = :sessionId and s.user_id = :userId and t.answer_timing is not null
                 order by t.turn_index
                """.trimIndent(),
            ).param("sessionId", sessionId)
            .param("userId", userId)
            .query { rs, _ -> rs.getString(1) }
            .list()
            .filterNotNull()
}
