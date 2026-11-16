package com.interviewos.api.interview

import com.interviewos.api.storage.StorageProperties
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

/**
 * Persistence for the interview loop.
 *
 * Every query is scoped by `user_id` taken from the verified token. The API connects as
 * the database owner and is therefore not constrained by RLS — the policies protect the
 * direct-from-browser path, and these predicates protect this one. A query here that
 * forgets its `user_id` clause is a cross-tenant data leak, so there are no unscoped
 * reads of user data in this class.
 */
@Repository
class SessionRepository(
    private val jdbcClient: JdbcClient,
    private val storageProperties: StorageProperties,
) {
    // -- entitlement inputs ---------------------------------------------------

    /**
     * Rounds started and planned minutes used since [since], from the practice ledger.
     * The ledger survives round deletion, so deleting a round does not refund it.
     */
    fun practiceUsageSince(
        userId: UUID,
        since: Instant,
    ): Pair<Int, Int> =
        jdbcClient
            .sql(
                """
                select count(*) as rounds, coalesce(sum(minutes), 0) as minutes
                  from public.practice_usage
                 where user_id = :u and started_at >= :since
                """.trimIndent(),
            ).param("u", userId)
            .param("since", java.sql.Timestamp.from(since))
            .query { rs, _ -> rs.getInt("rounds") to rs.getInt("minutes") }
            .single()

    fun recordPracticeUsage(
        userId: UUID,
        sessionId: UUID,
        minutes: Int,
    ) {
        jdbcClient
            .sql("insert into public.practice_usage (user_id, session_id, minutes) values (:u, :s, :m)")
            .param("u", userId)
            .param("s", sessionId)
            .param("m", minutes)
            .update()
    }

    /**
     * Free rounds started, for the lifetime free tier: one `practice_usage` row each. A paid
     * round writes none, a round that failed on our side has had its row removed, and a
     * deleted round keeps its row — so deleting rounds does not buy more free ones.
     */
    fun countFreeRoundsStarted(userId: UUID): Int =
        jdbcClient
            .sql("select count(*) from public.practice_usage where user_id = :u")
            .param("u", userId)
            .query(Int::class.java)
            .single()

    /** Paid credit not yet spent, in half-credits: the sum of the ledger. See [RoundLength]. */
    fun halfCreditBalance(userId: UUID): Int =
        jdbcClient
            .sql("select coalesce(sum(half_credits), 0) from public.interview_credits where user_id = :u")
            .param("u", userId)
            .query(Int::class.java)
            .single()

    /**
     * Serialises every start for one candidate until the calling transaction ends, so two
     * racing starts cannot both read the same last credit.
     *
     * `for no key update`, not `for update`: the stronger lock would also block the
     * `for key share` every foreign key to this user takes (see `UserRepository.provision`).
     */
    fun lockForAdmission(userId: UUID) {
        jdbcClient
            .sql("select id from public.users where id = :u for no key update")
            .param("u", userId)
            .query(UUID::class.java)
            .optional()
    }

    /**
     * Spends [halfCredits] on [sessionId] — the round's price, from [RoundLength.halfCreditsFor].
     * Charged once per session by a unique index.
     */
    fun spendCredit(
        userId: UUID,
        sessionId: UUID,
        halfCredits: Int,
    ) {
        require(halfCredits > 0) { "A charge is a positive number of half-credits" }
        jdbcClient
            .sql(
                """
                insert into public.interview_credits (user_id, half_credits, reason, session_id)
                values (:u, :cost, 'consume', :s)
                """.trimIndent(),
            ).param("u", userId)
            .param("cost", -halfCredits)
            .param("s", sessionId)
            .update()
    }

    /**
     * How much interviewing this product has actually done, across everyone.
     *
     * Counted from the rows rather than kept as a running total, for the same reason
     * progress is derived rather than declared (CLAUDE.md): a counter that is incremented
     * somewhere drifts from the thing it counts, and this one is shown to the public.
     *
     * The public controller caches this derivation for one minute so repeated requests
     * do not each scan the tables.
     */
    fun usageCounts(): UsageCounts =
        jdbcClient
            .sql(
                """
                select
                  (select count(*) from public.sessions where status = 'completed') as interviews,
                  (select count(*) from public.session_reports)                     as reports
                """.trimIndent(),
            ).query { rs, _ ->
                UsageCounts(
                    interviewsCompleted = rs.getLong("interviews"),
                    reportsGenerated = rs.getLong("reports"),
                )
            }.single()

    fun findOpenSessionId(userId: UUID): UUID? =
        jdbcClient
            .sql(
                """
                select id from public.sessions
                 where user_id = :u and status in ('created', 'in_progress')
                 order by created_at desc limit 1
                """.trimIndent(),
            ).param("u", userId)
            .query(UUID::class.java)
            .optional()
            .orElse(null)

    // -- sessions -------------------------------------------------------------

    fun insertSession(
        userId: UUID,
        companyName: String,
        archetype: Archetype,
        confidence: Confidence,
        roleTitle: String,
        roundType: String,
        language: String,
        consentAudio: Boolean,
        consentVideo: Boolean,
        durationMinutes: Int,
        /**
         * What the candidate said about their own stage (task 051), stored with the
         * session rather than re-typed later — the report has to score against the same
         * bar the round ran at, and the round's role title or the candidate's resume can
         * both change after the fact while this must not. Null when they said nothing.
         */
        declaredStage: DeclaredStage? = null,
        focusTopic: String? = null,
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.sessions (
                    user_id, company_name, company_archetype, role_title, round_type, language,
                    status, started_at, consent_audio_at, consent_video_at, archetype_confidence,
                    duration_minutes, stated_level, focus_topic
                ) values (
                    :u, :company, cast(:archetype as public.employer_archetype), :role,
                    cast(:round as public.round_type), cast(:language as public.interview_language),
                    'in_progress', now(),
                    case when :consentAudio then now() end,
                    case when :consentVideo then now() end,
                    :confidence, :durationMinutes, :statedLevel, :focusTopic
                )
                returning id
                """.trimIndent(),
            ).param("u", userId)
            .param("company", companyName)
            .param("archetype", archetype.dbValue)
            .param("role", roleTitle)
            .param("round", roundType)
            .param("language", language)
            .param("consentAudio", consentAudio)
            .param("consentVideo", consentVideo)
            .param("durationMinutes", durationMinutes)
            .param("confidence", confidence.dbValue)
            .param("statedLevel", declaredStage?.wireValue)
            .param("focusTopic", focusTopic)
            .query(UUID::class.java)
            .single()

    fun findSession(
        sessionId: UUID,
        userId: UUID,
    ): SessionRow? =
        jdbcClient
            .sql(
                """
                select id, company_name, company_archetype::text as archetype, role_title,
                       round_type::text as round_type, language::text as language,
                       status::text as status, started_at, entered_at, ended_at, report_expired_at,
                       (consent_video_at is not null) as consent_video, duration_minutes,
                       coalesce(archetype_confidence, 'inferred') as archetype_confidence,
                       workspace::text as workspace, board::text as board, stated_level, focus_topic,
                       exists (select 1 from public.assignment_attempts a where a.session_id = sessions.id) as assigned
                  from public.sessions
                 where id = :id and user_id = :u
                """.trimIndent(),
            ).param("id", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapSession(rs) }
            .optional()
            .orElse(null)

    /**
     * A bounded page of a candidate's rounds, newest first.
     *
     * Returns rows rather than the API shape because when a round's report expires is
     * policy, not data — it is [RetentionProperties] applied to `retention_from`, and the
     * service does that arithmetic. The database's job here is to say when the round
     * happened and whether it has already been cleared.
     */
    fun listSessions(
        userId: UUID,
        limit: Int,
        offset: Int,
    ): List<SessionListRow> =
        jdbcClient
            .sql(
                """
                select s.id, s.company_name, s.role_title, s.round_type::text as round_type,
                       s.status::text as status, s.started_at, s.ended_at, s.report_expired_at,
                       coalesce(s.ended_at, s.created_at) as retention_from,
                       (r.id is not null) as has_report
                  from public.sessions s
                  left join public.session_reports r on r.session_id = s.id
                 where s.user_id = :u
                 order by s.created_at desc, s.id desc
                 limit :limit offset :offset
                """.trimIndent(),
            ).param("u", userId)
            .param("limit", limit)
            .param("offset", offset)
            .query { rs, _ ->
                SessionListRow(
                    id = rs.getObject("id", UUID::class.java),
                    companyName = rs.getString("company_name"),
                    roleTitle = rs.getString("role_title"),
                    roundType = rs.getString("round_type"),
                    status = rs.getString("status"),
                    startedAt = rs.getTimestamp("started_at")?.toInstant(),
                    endedAt = rs.getTimestamp("ended_at")?.toInstant(),
                    retentionFrom = rs.getTimestamp("retention_from")?.toInstant(),
                    reportExpiredAt = rs.getTimestamp("report_expired_at")?.toInstant(),
                    hasReport = rs.getBoolean("has_report"),
                )
            }.list()

    /**
     * A terminal transition and its media-deletion job are one database statement. The
     * report only reads transcripts and assessments, so neither answer recordings nor
     * the interviewer's played questions need to survive the end of the round.
     */
    fun markSessionStatus(
        sessionId: UUID,
        userId: UUID,
        status: String,
    ): Boolean {
        require(status in setOf("completed", "abandoned", "failed"))
        return jdbcClient
            .sql(
                """
                with transitioned as (
                    update public.sessions
                       set status = cast(:status as public.session_status), ended_at = now()
                     where id = :id and user_id = :u and status = 'in_progress'
                    returning id, user_id
                ), queued as (
                    insert into public.storage_deletion_jobs
                           (user_id, session_id, bucket, object_prefix, reason)
                    select user_id, id, :bucket, :prefix, 'round_finished'
                      from transitioned
                     where true
                    on conflict (bucket, object_prefix) do update
                       set completed_at = null,
                           next_attempt_at = now(),
                           settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                           reason = excluded.reason,
                           updated_at = now()
                    returning id
                ), cleared as (
                    update public.session_turns t
                       set question_audio_path = null,
                           question_audio_status = 'unavailable'::public.speech_status,
                           answer_audio_path = null,
                           answer_video_path = null
                      from transitioned
                     where t.session_id = transitioned.id and t.user_id = transitioned.user_id
                    returning t.session_id
                ), attempt as (
                    -- A round a college assigned ends its attempt with it (campus spec §4). An
                    -- abandoned attempt still counts against the caps; only 'failed' hands back.
                    update public.assignment_attempts a
                       set status = :status, ended_at = now()
                      from transitioned
                     where a.session_id = transitioned.id and a.status = 'in_progress'
                    returning a.id
                )
                select count(*) as changed from queued
                """.trimIndent(),
            ).param("status", status)
            .param("id", sessionId)
            .param("u", userId)
            .param("bucket", storageProperties.mediaBucket)
            .param("prefix", "$userId/$sessionId")
            .query { rs, _ -> rs.getInt("changed") }
            .single() == 1
    }

    /**
     * A provider or server failure must not use up the candidate's daily allowance, or the
     * interview they paid for: the free usage row is removed and a spent credit is handed
     * back. The status transition and refund are one statement, so a racing completion
     * cannot turn a completed round into a free one. A deleted round has no session to
     * update; its usage row and its charge are deliberately left in place.
     */
    fun failSessionAndRefundUsage(
        sessionId: UUID,
        userId: UUID,
    ): Boolean =
        jdbcClient
            .sql(
                """
                with failed as (
                  update public.sessions
                     set status = 'failed', ended_at = now()
                   where id = :id and user_id = :u and status = 'in_progress'
                  returning id
                ), refunded as (
                  delete from public.practice_usage p using failed f
                   where p.session_id = f.id and p.user_id = :u
                  returning p.id
                ), credit_returned as (
                  -- Hands back exactly what the round was charged: half a credit or one.
                  insert into public.interview_credits (user_id, half_credits, reason, session_id)
                  select :u, -c.half_credits, 'refund', f.id
                    from failed f
                    join public.interview_credits c
                      on c.session_id = f.id and c.user_id = :u and c.reason = 'consume'
                  on conflict do nothing
                  returning id
                ), attempt_handed_back as (
                  -- A college-assigned round that failed on our side gives the college its
                  -- interview back, as a credit is given back above (campus spec §4).
                  update public.assignment_attempts a
                     set status = 'failed', ended_at = now()
                    from failed f
                   where a.session_id = f.id and a.status = 'in_progress'
                  returning a.id
                )
                select exists(select 1 from failed) as changed,
                       (select count(*) from refunded) as refunded_count,
                       (select count(*) from credit_returned) as credits_returned
                """.trimIndent(),
            ).param("id", sessionId)
            .param("u", userId)
            .query { rs, _ -> rs.getBoolean("changed") }
            .single()

    /**
     * Starts the round's clock, once: the moment the candidate enters the room.
     *
     * `started_at` is written at insert because the existing constraints require it, but
     * it is not evidence that the candidate entered the room. `entered_at` is the explicit
     * clock latch. Inferring entry from `started_at = created_at` made correctness depend
     * on two implementation timestamps remaining identical across schema changes.
     *
     * The null check makes this idempotent: a reload keeps the first room-entry time, so a
     * refresh never buys extra time.
     */
    fun startClock(
        sessionId: UUID,
        userId: UUID,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.sessions
                   set started_at = now(), entered_at = now()
                 where id = :id and user_id = :u
                   and status = 'in_progress'
                   and entered_at is null
                """.trimIndent(),
            ).param("id", sessionId)
            .param("u", userId)
            .update() == 1

    /**
     * Stores the material this round is conducted around, composed once at the start.
     *
     * Separate from `insertSession` because composing it needs the session to exist: the
     * model call is attributed to the session in the spend ledger, and a call made before
     * the row existed would be a call nobody can account for.
     */
    fun setWorkspace(
        sessionId: UUID,
        userId: UUID,
        workspaceJson: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.sessions
                   set workspace = cast(:w as jsonb)
                 where id = :id and user_id = :u and status = 'in_progress'
                """.trimIndent(),
            ).param("w", workspaceJson)
            .param("id", sessionId)
            .param("u", userId)
            .update() == 1

    /**
     * Stores what the candidate produced on the board — the design they drew, or the code
     * they wrote.
     *
     * Written repeatedly as they work, so it survives a reload. PRD 06 is explicit that
     * nothing about a session may be lost to a refresh, and a design somebody spent
     * twenty minutes drawing is the most expensive thing in the room to lose.
     */
    fun setBoard(
        sessionId: UUID,
        userId: UUID,
        boardJson: String,
    ): Boolean =
        jdbcClient
            .sql("update public.sessions set board = cast(:b as jsonb) where id = :id and user_id = :u and status = 'in_progress'")
            .param("b", boardJson)
            .param("id", sessionId)
            .param("u", userId)
            .update() == 1

    // -- deletion and retention -----------------------------------------------

    /**
     * Removes one round entirely, and says whether there was one to remove.
     *
     * The storage outbox row and session deletion are one statement. The transcript and
     * report cascade from `public.sessions`, while the outbox deliberately has no foreign
     * key to that row: it must survive long enough to remove the external objects.
     *
     * The `user_id` predicate is the entire authorisation check. A caller asking for
     * somebody else's session gets `false` and, above this, a 404 — which is the same
     * answer they get for a session that never existed, and deliberately so.
     *
     * Returns false rather than throwing so the caller can decide; it also makes a second
     * delete of the same round idempotent rather than a 500.
     */
    fun enqueueAndDeleteSession(
        sessionId: UUID,
        userId: UUID,
        bucket: String,
        objectPrefix: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                with owned as (
                    select id, user_id
                      from public.sessions
                     where id = :s and user_id = :u
                ), enqueued as (
                    insert into public.storage_deletion_jobs
                           (user_id, session_id, bucket, object_prefix, reason)
                    select user_id, id, :bucket, :prefix, 'candidate_deleted'
                      from owned
                    on conflict (bucket, object_prefix) do update
                       set completed_at = null,
                           next_attempt_at = now(),
                           settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                           reason = excluded.reason,
                           updated_at = now()
                    returning object_prefix
                )
                delete from public.sessions s
                 using owned
                 where s.id = owned.id
                   and exists (select 1 from enqueued)
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("bucket", bucket)
            .param("prefix", objectPrefix)
            .update() > 0

    /**
     * Rounds old enough to be cleared, oldest first.
     *
     * Deliberately not scoped by user — this is the only query in this class that is not,
     * and it is the retention sweep rather than anything serving a request. It returns
     * the owner alongside the id because every write and every storage key that follows is
     * scoped by both.
     */
    fun listRoundsDueForExpiry(
        endedBefore: Instant,
        limit: Int,
    ): List<ExpiringRound> =
        jdbcClient
            .sql(
                """
                select id, user_id
                  from public.sessions
                 where report_expired_at is null
                   and coalesce(ended_at, created_at) < :cutoff
                 order by coalesce(ended_at, created_at)
                 limit :limit
                """.trimIndent(),
            ).param("cutoff", java.sql.Timestamp.from(endedBefore))
            .param("limit", limit)
            .query { rs, _ ->
                ExpiringRound(
                    sessionId = rs.getObject("id", UUID::class.java),
                    userId = rs.getObject("user_id", UUID::class.java),
                )
            }.list()

    /**
     * Clears one round's report, transcript and candidate-authored board, queues media
     * deletion, and stamps it as expired while keeping the generated workspace and the
     * session row.
     *
     * **One statement, and it has to be.** Half of this — the report deleted, the turns
     * still there — is the state in which [ReportService] would compose a *brand new*
     * report from the surviving transcript the next time the candidate opened it: a model
     * call producing a different report from the one they remember, silently, out of data
     * that was supposed to be gone. Postgres runs data-modifying CTEs exactly once and to
     * completion, in one snapshot, so the outbox and evidence writes cannot come apart. That is
     * also why this is not three calls behind an `@Transactional` service method — the
     * caller is in the same bean, and a self-invocation never reaches the proxy that would
     * have opened the transaction.
     *
     * The `update` is the primary query rather than a third CTE so its row count is the
     * return value: false means no such round belongs to that user, and the deletes above
     * it matched nothing either, both being scoped the same way.
     */
    fun enqueueAndExpireRound(
        sessionId: UUID,
        userId: UUID,
        bucket: String,
        objectPrefix: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                with owned as (
                    select id, user_id
                      from public.sessions
                     where id = :s and user_id = :u and report_expired_at is null
                ), enqueued as (
                    insert into public.storage_deletion_jobs
                           (user_id, session_id, bucket, object_prefix, reason)
                    select user_id, id, :bucket, :prefix, 'retention_expired'
                      from owned
                    on conflict (bucket, object_prefix) do update
                       set completed_at = null,
                           next_attempt_at = now(),
                           settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                           reason = excluded.reason,
                           updated_at = now()
                    returning object_prefix
                ), cleared_report as (
                    delete from public.session_reports where session_id = :s and user_id = :u
                ), cleared_turns as (
                    delete from public.session_turns where session_id = :s and user_id = :u
                )
                update public.sessions s
                   set report_expired_at = now(),
                       board = null
                  from owned
                 where s.id = owned.id
                   and exists (select 1 from enqueued)
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("bucket", bucket)
            .param("prefix", objectPrefix)
            .update() > 0

    fun claimStorageDeletionJobs(
        now: Instant,
        leaseUntil: Instant,
        limit: Int,
    ): List<StorageDeletionJobRow> =
        jdbcClient
            .sql(
                """
                with due as (
                    select id
                      from public.storage_deletion_jobs
                     where completed_at is null
                       and next_attempt_at <= :now
                       and (lease_until is null or lease_until <= :now)
                     order by next_attempt_at, created_at
                     for update skip locked
                     limit :limit
                )
                update public.storage_deletion_jobs j
                   set lease_until = :leaseUntil,
                       attempts = attempts + 1,
                       updated_at = :now
                  from due
                 where j.id = due.id
                returning j.id, j.bucket, j.object_prefix, j.attempts, j.settle_after
                """.trimIndent(),
            ).param("now", java.sql.Timestamp.from(now))
            .param("leaseUntil", java.sql.Timestamp.from(leaseUntil))
            .param("limit", limit)
            .query { rs, _ ->
                StorageDeletionJobRow(
                    id = rs.getObject("id", UUID::class.java),
                    bucket = rs.getString("bucket"),
                    objectPrefix = rs.getString("object_prefix"),
                    attempts = rs.getInt("attempts"),
                    settleAfter = rs.getTimestamp("settle_after").toInstant(),
                )
            }.list()

    fun markStorageDeletionSucceeded(
        jobId: UUID,
        now: Instant,
        settled: Boolean,
    ): Boolean =
        jdbcClient
            .sql(storageDeletionCompletionSql(settled))
            .param("now", java.sql.Timestamp.from(now))
            .param("id", jobId)
            .update() == 1

    fun markStorageDeletionFailed(
        jobId: UUID,
        error: String,
        retryAt: Instant,
        now: Instant,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.storage_deletion_jobs
                   set next_attempt_at = :retryAt,
                       lease_until = null,
                       last_error = :error,
                       updated_at = :now
                 where id = :id and completed_at is null
                """.trimIndent(),
            ).param("retryAt", java.sql.Timestamp.from(retryAt))
            .param("error", error.take(1000))
            .param("now", java.sql.Timestamp.from(now))
            .param("id", jobId)
            .update() == 1

    // -- turns ----------------------------------------------------------------

    /**
     * Records a question. The turn is written before its audio exists, so the candidate
     * can start reading immediately; [speechStatus] says whether a voice is still coming.
     */
    fun insertTurn(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        questionText: String,
        phase: TurnPhase,
        speechStatus: SpeechStatus,
        provenanceJson: String?,
        /** The bank question this turn asked, when it asked one. See [askedBankQuestions]. */
        bankQuestionId: UUID? = null,
        /** The pool question this turn asked, when it asked one. See [askedPoolQuestions]. */
        poolQuestionId: UUID? = null,
    ): Boolean =
        jdbcClient
            .sql(
                """
                insert into public.session_turns
                       (session_id, user_id, turn_index, question_text, phase, question_audio_status, provenance,
                        bank_question_id, pool_question_id)
                select :s, :u, :i, :q, cast(:phase as public.turn_phase), cast(:speech as public.speech_status),
                       cast(:provenance as jsonb), :bank, :pool
                  from public.sessions
                 where id = :s and user_id = :u and status = 'in_progress'
                on conflict (session_id, turn_index) do nothing
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .param("q", questionText)
            .param("phase", phase.dbValue)
            .param("speech", speechStatus.dbValue)
            .param("provenance", provenanceJson)
            .param("bank", bankQuestionId)
            .param("pool", poolQuestionId)
            .update() == 1

    /**
     * Every bank question this candidate has been asked, in any round, with when it was last
     * asked and whether that was in [sessionId]. What selection needs to avoid repeats.
     */
    fun askedBankQuestions(
        userId: UUID,
        sessionId: UUID,
    ): List<AskedBankQuestion> =
        askedFrom("bank_question_id", userId, sessionId) { id, at, thisRound -> AskedBankQuestion(id, at, thisRound) }

    /** [askedBankQuestions], for the AI pool: the same query over `pool_question_id`. */
    fun askedPoolQuestions(
        userId: UUID,
        sessionId: UUID,
    ): List<AskedPoolQuestion> =
        askedFrom("pool_question_id", userId, sessionId) { id, at, thisRound -> AskedPoolQuestion(id, at, thisRound) }

    /** [column] is one of two literals above, never caller input. */
    private fun <T : Any> askedFrom(
        column: String,
        userId: UUID,
        sessionId: UUID,
        row: (UUID, Instant, Boolean) -> T,
    ): List<T> =
        jdbcClient
            .sql(
                """
                select $column as question_id, max(created_at) as last_asked, bool_or(session_id = :s) as this_round
                  from public.session_turns
                 where user_id = :u
                   and $column is not null
                 group by $column
                """.trimIndent(),
            ).param("u", userId)
            .param("s", sessionId)
            .query { rs, _ ->
                row(
                    rs.getObject("question_id", UUID::class.java),
                    rs.getTimestamp("last_asked").toInstant(),
                    rs.getBoolean("this_round"),
                )
            }.list()

    /**
     * Attaches the spoken question once it has rendered, or marks it as never coming.
     *
     * Written from a background thread after the answering transaction has committed, so
     * it deliberately does not touch anything else on the row.
     */
    fun setQuestionSpeech(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        audioPath: String?,
        status: SpeechStatus,
    ) {
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set question_audio_path = :audio,
                       question_audio_status = cast(:status as public.speech_status)
                 where session_id = :s and user_id = :u and turn_index = :i
                   and exists (
                       select 1 from public.sessions s
                        where s.id = :s and s.user_id = :u and s.status = 'in_progress'
                   )
                """.trimIndent(),
            ).param("audio", audioPath)
            .param("status", status.dbValue)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update()
    }

    fun findTurn(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
    ): TurnRow? =
        jdbcClient
            .sql(
                """
                select turn_index, question_text, question_audio_path,
                       question_audio_status::text as question_audio_status,
                       answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note,
                       phase::text as phase, delivery_note, provenance::text as provenance,
                       hint_requested_at, hint_text, hint_level::text as hint_level, next_action
                  from public.session_turns
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .query { rs, _ -> mapTurn(rs) }
            .optional()
            .orElse(null)

    fun findLatestTurn(
        sessionId: UUID,
        userId: UUID,
    ): TurnRow? =
        jdbcClient
            .sql(
                """
                select turn_index, question_text, question_audio_path,
                       question_audio_status::text as question_audio_status,
                       answer_transcript, answered_at,
                       intervention::text as intervention, intervention_note,
                       phase::text as phase, delivery_note, provenance::text as provenance,
                       hint_requested_at, hint_text, hint_level::text as hint_level, next_action
                  from public.session_turns
                 where session_id = :s and user_id = :u
                 order by turn_index desc limit 1
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query { rs, _ -> mapTurn(rs) }
            .optional()
            .orElse(null)

    fun claimAnswerRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
        leaseSeconds: Long,
    ): TurnRequestClaim = claimTurnRequest(sessionId, userId, turnIndex, requestId, leaseSeconds, TurnRequestKind.ANSWER)

    fun claimHintRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
        leaseSeconds: Long,
    ): TurnRequestClaim = claimTurnRequest(sessionId, userId, turnIndex, requestId, leaseSeconds, TurnRequestKind.HINT)

    fun renewAnswerRequests(
        requestIds: List<UUID>,
        leaseSeconds: Long,
    ): Int = renewTurnRequests(requestIds, leaseSeconds, TurnRequestKind.ANSWER)

    fun renewHintRequests(
        requestIds: List<UUID>,
        leaseSeconds: Long,
    ): Int = renewTurnRequests(requestIds, leaseSeconds, TurnRequestKind.HINT)

    private fun renewTurnRequests(
        requestIds: List<UUID>,
        leaseSeconds: Long,
        kind: TurnRequestKind,
    ): Int {
        if (requestIds.isEmpty()) return 0
        return jdbcClient
            .sql(
                """
                update public.session_turns
                   set ${kind.leaseColumn} = now() + (:leaseSeconds * interval '1 second')
                 where ${kind.requestColumn} in (:requestIds)
                   and ${kind.completedColumn} is null
                   and ${kind.responseColumn} is null
                """.trimIndent(),
            ).param("leaseSeconds", leaseSeconds)
            .param("requestIds", requestIds)
            .update()
    }

    private fun claimTurnRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
        leaseSeconds: Long,
        kind: TurnRequestKind,
    ): TurnRequestClaim {
        val claimed =
            jdbcClient
                .sql(
                    """
                    update public.session_turns t
                       set ${kind.requestColumn} = :request,
                           ${kind.leaseColumn} = now() + (:leaseSeconds * interval '1 second')
                     where t.session_id = :s and t.user_id = :u and t.turn_index = :i
                       and t.${kind.completedColumn} is null
                       and t.${kind.responseColumn} is null
                       and (t.${kind.requestColumn} is null or t.${kind.leaseColumn} <= now())
                       and exists (
                           select 1
                             from public.sessions s
                            where s.id = t.session_id and s.user_id = t.user_id and s.status = 'in_progress'
                       )
                    returning ${kind.requestColumn}
                    """.trimIndent(),
                ).param("request", requestId)
                .param("leaseSeconds", leaseSeconds)
                .param("s", sessionId)
                .param("u", userId)
                .param("i", turnIndex)
                .query(UUID::class.java)
                .optional()
                .isPresent
        if (claimed) return TurnRequestClaim(TurnRequestClaimStatus.ACQUIRED)

        return jdbcClient
            .sql(
                """
                select ${kind.requestColumn} as request_id,
                       ${kind.leaseColumn} as lease_until,
                       ${kind.responseColumn}::text as response
                  from public.session_turns
                 where session_id = :s and user_id = :u and turn_index = :i
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .query { rs, _ ->
                val response = rs.getString("response")
                val leaseUntil = rs.getTimestamp("lease_until")?.toInstant()
                when {
                    response != null -> {
                        TurnRequestClaim(TurnRequestClaimStatus.COMPLETED, response)
                    }

                    rs.getObject("request_id") != null && leaseUntil?.isAfter(Instant.now()) == true -> {
                        TurnRequestClaim(TurnRequestClaimStatus.IN_PROGRESS)
                    }

                    else -> {
                        TurnRequestClaim(TurnRequestClaimStatus.UNAVAILABLE)
                    }
                }
            }.optional()
            .orElse(TurnRequestClaim(TurnRequestClaimStatus.UNAVAILABLE))
    }

    fun releaseAnswerRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
    ) = releaseTurnRequest(sessionId, userId, turnIndex, requestId, TurnRequestKind.ANSWER)

    fun releaseHintRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
    ) = releaseTurnRequest(sessionId, userId, turnIndex, requestId, TurnRequestKind.HINT)

    private fun releaseTurnRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
        kind: TurnRequestKind,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set ${kind.requestColumn} = null,
                       ${kind.leaseColumn} = null
                 where session_id = :s and user_id = :u and turn_index = :i
                   and ${kind.requestColumn} = :request
                   and ${kind.responseColumn} is null
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .param("request", requestId)
            .update() == 1

    /**
     * Records help the candidate asked for, on the turn they asked it on.
     *
     * Deliberately separate from `intervention`, which holds what the interviewer chose
     * to supply in response to the answer. Writing both to one column would let the
     * assessment of an answer overwrite the hint that shaped it.
     */
    fun recordHint(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        hintText: String,
        hintLevel: String,
        requestId: UUID,
        responseJson: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set hint_requested_at = now(),
                       hint_text = :hint,
                       hint_level = cast(:level as public.intervention_type),
                       hint_response = cast(:response as jsonb)
                 where session_id = :s and user_id = :u and turn_index = :i
                   and answered_at is null
                   and hint_requested_at is null
                   and hint_request_id = :request
                   and exists (
                       select 1
                         from public.sessions s
                        where s.id = :s and s.user_id = :u and s.status = 'in_progress'
                   )
                """.trimIndent(),
            ).param("hint", hintText)
            .param("level", hintLevel)
            .param("response", responseJson)
            .param("request", requestId)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update() == 1

    fun recordAnswer(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        transcript: String,
        videoPath: String?,
        assessmentJson: String,
        nextAction: String,
        intervention: String,
        interventionNote: String?,
        deliveryNote: String?,
        requestId: UUID,
        /** Validated [AnswerTiming] as JSON, or null when the browser measured none. */
        timingJson: String? = null,
        /** SHA-256 of the upload, hex. Only the digest is kept; the audio is not. */
        audioSha256: String? = null,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set answer_transcript = :t,
                       answer_audio_path = null,
                       answer_video_path = :video,
                       answered_at = now(),
                       assessment = cast(:assessment as jsonb),
                       next_action = cast(:action as public.turn_next_action),
                       intervention = cast(:intervention as public.intervention_type),
                       intervention_note = :note,
                       delivery_note = :delivery,
                       answer_timing = cast(:timing as jsonb),
                       answer_audio_sha256 = :audio_sha
                 where session_id = :s and user_id = :u and turn_index = :i
                   and answered_at is null
                   and answer_request_id = :request
                   and exists (
                       select 1
                         from public.sessions s
                        where s.id = :s and s.user_id = :u and s.status = 'in_progress'
                   )
                """.trimIndent(),
            ).param("t", transcript)
            .param("video", videoPath)
            .param("assessment", assessmentJson)
            .param("action", nextAction)
            .param("intervention", intervention)
            .param("note", interventionNote)
            .param("delivery", deliveryNote)
            .param("timing", timingJson)
            .param("audio_sha", audioSha256)
            .param("request", requestId)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update() == 1

    /** Hashes of the answers already recorded in this session, to catch a resent recording. */
    fun answerAudioHashes(
        sessionId: UUID,
        userId: UUID,
    ): Set<String> =
        jdbcClient
            .sql(
                """
                select answer_audio_sha256
                  from public.session_turns
                 where session_id = :s and user_id = :u and answer_audio_sha256 is not null
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query(String::class.java)
            .set()
            .filterNotNull()
            .toSet()

    fun completeAnswerRequest(
        sessionId: UUID,
        userId: UUID,
        turnIndex: Int,
        requestId: UUID,
        responseJson: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.session_turns
                   set answer_response = cast(:response as jsonb)
                 where session_id = :s and user_id = :u and turn_index = :i
                   and answer_request_id = :request
                   and answered_at is not null
                   and answer_response is null
                """.trimIndent(),
            ).param("response", responseJson)
            .param("request", requestId)
            .param("s", sessionId)
            .param("u", userId)
            .param("i", turnIndex)
            .update() == 1

    fun countAnsweredTurns(
        sessionId: UUID,
        userId: UUID,
    ): Int =
        jdbcClient
            .sql(
                "select count(*) from public.session_turns where session_id = :s and user_id = :u and answered_at is not null",
            ).param("s", sessionId)
            .param("u", userId)
            .query(Int::class.java)
            .single()

    /**
     * The report reads the pool row's `strong_answer_covers` for a turn asked from the AI
     * pool (task 042/044) and hands it to the model as reference material for judging that
     * answer — never as a sourced fact, since a pool question is not one (`PromptLibrary`,
     * `report.md`). The join is left so a turn with no pool question, or an older pool row
     * with nothing recorded, simply carries an empty list.
     */
    fun listTranscript(
        sessionId: UUID,
        userId: UUID,
    ): List<TurnRow> =
        jdbcClient
            .sql(
                """
                select t.turn_index, t.question_text, t.question_audio_path,
                       t.question_audio_status::text as question_audio_status,
                       t.answer_transcript, t.answered_at,
                       t.intervention::text as intervention, t.intervention_note,
                       t.phase::text as phase, t.delivery_note, t.provenance::text as provenance,
                       t.hint_requested_at, t.hint_text, t.hint_level::text as hint_level,
                       t.next_action, t.answer_timing::text as answer_timing,
                       pq.strong_answer_covers
                  from public.session_turns t
                  left join public.pool_questions pq on pq.id = t.pool_question_id
                 where t.session_id = :s and t.user_id = :u
                 order by t.turn_index
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query { rs, _ ->
                val covers = rs.getArray("strong_answer_covers")?.array as? Array<*>
                mapTurn(rs).copy(
                    poolStrongAnswerCovers = covers?.filterIsInstance<String>() ?: emptyList(),
                    answerTimingJson = rs.getString("answer_timing"),
                )
            }.list()

    // -- reports --------------------------------------------------------------

    fun claimReportGeneration(
        sessionId: UUID,
        userId: UUID,
        leaseId: UUID,
        leaseSeconds: Long,
    ): ReportGenerationClaim {
        val acquired =
            jdbcClient
                .sql(
                    """
                    update public.sessions s
                       set report_generation_lease_id = :lease,
                           report_generation_lease_until = now() + (:leaseSeconds * interval '1 second')
                     where s.id = :s and s.user_id = :u
                       and s.status = 'completed'
                       and s.report_expired_at is null
                       and not exists (select 1 from public.session_reports r where r.session_id = s.id)
                       and (s.report_generation_lease_id is null or s.report_generation_lease_until <= now())
                    returning s.id
                    """.trimIndent(),
                ).param("lease", leaseId)
                .param("leaseSeconds", leaseSeconds)
                .param("s", sessionId)
                .param("u", userId)
                .query(UUID::class.java)
                .optional()
                .isPresent
        if (acquired) return ReportGenerationClaim(ReportGenerationClaimStatus.ACQUIRED)

        return jdbcClient
            .sql(
                """
                select s.report_generation_lease_id,
                       s.report_generation_lease_until,
                       r.payload::text as payload
                  from public.sessions s
                  left join public.session_reports r on r.session_id = s.id and r.user_id = s.user_id
                 where s.id = :s and s.user_id = :u
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .query { rs, _ ->
                val payload = rs.getString("payload")
                val leaseUntil = rs.getTimestamp("report_generation_lease_until")?.toInstant()
                when {
                    payload != null -> {
                        ReportGenerationClaim(ReportGenerationClaimStatus.COMPLETED, payload)
                    }

                    rs.getObject("report_generation_lease_id") != null && leaseUntil?.isAfter(Instant.now()) == true -> {
                        ReportGenerationClaim(ReportGenerationClaimStatus.IN_PROGRESS)
                    }

                    else -> {
                        ReportGenerationClaim(ReportGenerationClaimStatus.UNAVAILABLE)
                    }
                }
            }.optional()
            .orElse(ReportGenerationClaim(ReportGenerationClaimStatus.UNAVAILABLE))
    }

    fun renewReportGenerations(
        leaseIds: List<UUID>,
        leaseSeconds: Long,
    ): Int {
        if (leaseIds.isEmpty()) return 0
        return jdbcClient
            .sql(
                """
                update public.sessions s
                   set report_generation_lease_until = now() + (:leaseSeconds * interval '1 second')
                 where s.report_generation_lease_id in (:leaseIds)
                   and s.status = 'completed'
                   and s.report_expired_at is null
                   and not exists (select 1 from public.session_reports r where r.session_id = s.id)
                """.trimIndent(),
            ).param("leaseSeconds", leaseSeconds)
            .param("leaseIds", leaseIds)
            .update()
    }

    fun releaseReportGeneration(
        sessionId: UUID,
        userId: UUID,
        leaseId: UUID,
    ): Boolean =
        jdbcClient
            .sql(
                """
                update public.sessions
                   set report_generation_lease_id = null,
                       report_generation_lease_until = null
                 where id = :s and user_id = :u and report_generation_lease_id = :lease
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("lease", leaseId)
            .update() == 1

    fun saveReport(
        sessionId: UUID,
        userId: UUID,
        leaseId: UUID,
        payloadJson: String,
        model: String,
        promptTokens: Int,
        outputTokens: Int,
    ): Boolean =
        jdbcClient
            .sql(
                """
                with lease as (
                    update public.sessions
                       set report_generation_lease_id = null,
                           report_generation_lease_until = null
                     where id = :s and user_id = :u
                       and status = 'completed'
                       and report_expired_at is null
                       and report_generation_lease_id = :lease
                    returning id
                )
                insert into public.session_reports (session_id, user_id, payload, model, prompt_tokens, output_tokens)
                select :s, :u, cast(:p as jsonb), :m, :pt, :ot
                  from lease
                on conflict (session_id) do nothing
                """.trimIndent(),
            ).param("s", sessionId)
            .param("u", userId)
            .param("lease", leaseId)
            .param("p", payloadJson)
            .param("m", model)
            .param("pt", promptTokens)
            .param("ot", outputTokens)
            .update() == 1

    fun findReportJson(
        sessionId: UUID,
        userId: UUID,
    ): String? =
        jdbcClient
            .sql("select payload::text from public.session_reports where session_id = :s and user_id = :u")
            .param("s", sessionId)
            .param("u", userId)
            .query(String::class.java)
            .optional()
            .orElse(null)

    /** Reports for completed sessions, grouped by (company, role) — the readiness view. */
    fun listReportsForReadiness(userId: UUID): List<ReadinessRow> =
        jdbcClient
            .sql(
                """
                select s.company_name, s.role_title, s.ended_at, r.payload::text as payload
                  from public.sessions s
                  join public.session_reports r on r.session_id = s.id
                 where s.user_id = :u and s.status = 'completed'
                 order by s.company_name, s.role_title, s.ended_at
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ ->
                ReadinessRow(
                    companyName = rs.getString("company_name"),
                    roleTitle = rs.getString("role_title"),
                    endedAt = rs.getTimestamp("ended_at")?.toInstant(),
                    payloadJson = rs.getString("payload"),
                )
            }.list()

    private fun mapSession(rs: ResultSet) =
        SessionRow(
            id = rs.getObject("id", UUID::class.java),
            companyName = rs.getString("company_name"),
            archetype = rs.getString("archetype"),
            archetypeConfidence = rs.getString("archetype_confidence"),
            roleTitle = rs.getString("role_title"),
            roundType = rs.getString("round_type"),
            language = rs.getString("language"),
            status = rs.getString("status"),
            startedAt = rs.getTimestamp("started_at")?.toInstant(),
            enteredAt = rs.getTimestamp("entered_at")?.toInstant(),
            endedAt = rs.getTimestamp("ended_at")?.toInstant(),
            consentVideo = rs.getBoolean("consent_video"),
            durationMinutes = rs.getInt("duration_minutes"),
            reportExpiredAt = rs.getTimestamp("report_expired_at")?.toInstant(),
            workspace = rs.getString("workspace"),
            board = rs.getString("board"),
            declaredStage = DeclaredStage.parseOrNull(rs.getString("stated_level")),
            focusTopic = rs.getString("focus_topic"),
            assigned = rs.getBoolean("assigned"),
        )

    private fun mapTurn(rs: ResultSet) =
        TurnRow(
            turnIndex = rs.getInt("turn_index"),
            questionText = rs.getString("question_text"),
            questionAudioPath = rs.getString("question_audio_path"),
            questionAudioStatus = rs.getString("question_audio_status") ?: SpeechStatus.READY.dbValue,
            answerTranscript = rs.getString("answer_transcript"),
            answeredAt = rs.getTimestamp("answered_at")?.toInstant(),
            intervention = rs.getString("intervention") ?: "none",
            phase = rs.getString("phase"),
            deliveryNote = rs.getString("delivery_note"),
            interventionNote = rs.getString("intervention_note"),
            hintRequestedAt = rs.getTimestamp("hint_requested_at")?.toInstant(),
            hintText = rs.getString("hint_text"),
            hintLevel = rs.getString("hint_level"),
            provenanceJson = rs.getString("provenance"),
            nextAction = rs.getString("next_action"),
        )
}

/**
 * PostgreSQL cannot infer a stable type for a CASE that mixes a bound timestamp and an
 * untyped NULL. Keep the two lifecycle transitions explicit: an early purge schedules
 * the post-upload sweep, while a settled purge completes the durable job.
 */
internal fun storageDeletionCompletionSql(settled: Boolean): String =
    if (settled) {
        """
        update public.storage_deletion_jobs
           set completed_at = :now,
               lease_until = null,
               last_error = null,
               updated_at = :now
         where id = :id and completed_at is null
        """.trimIndent()
    } else {
        """
        update public.storage_deletion_jobs
           set next_attempt_at = settle_after,
               lease_until = null,
               last_error = null,
               updated_at = :now
         where id = :id and completed_at is null
        """.trimIndent()
    }

data class SessionRow(
    val id: UUID,
    val companyName: String,
    val archetype: String,
    val archetypeConfidence: String,
    val roleTitle: String,
    val roundType: String,
    val language: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    /** Whether the candidate agreed to video. The camera must not open without it. */
    val consentVideo: Boolean,
    /** How long this round was scheduled to run. The clock, not a counter, ends it. */
    val durationMinutes: Int,
    /**
     * When retention cleared this round's report, transcript and recordings. Null means
     * nothing has been cleared — which is different from there being no report yet.
     */
    val reportExpiredAt: Instant? = null,
    /** The problem or case this round runs on, as raw JSON. Null for a plain conversation. */
    val workspace: String? = null,
    /** What the candidate drew or wrote, as raw JSON. Null until they touch the board. */
    val board: String? = null,
    /**
     * What the candidate said about their own stage when this round started (task 051).
     * Null when they said nothing, which is the common case and reproduces the derivation
     * in [CandidateStage.of] exactly.
     */
    val declaredStage: DeclaredStage? = null,
    /** Candidate-supplied subject for a custom topic round. Null for standard rounds. */
    val focusTopic: String? = null,
    /** The first time the candidate entered the room; the round clock starts here. */
    val enteredAt: Instant? = startedAt,
    /** Started from a college's assignment (campus spec §4), so integrity signals are recorded (§5). */
    val assigned: Boolean = false,
)

/**
 * One row of a candidate's history, before retention policy has been applied to it.
 *
 * [retentionFrom] is when the round finished, falling back to when it was created for one
 * that never did. [ReportService] and [InterviewService] turn it into an expiry date;
 * nothing in this class knows how long a report is kept.
 */
data class SessionListRow(
    val id: UUID,
    val companyName: String,
    val roleTitle: String,
    val roundType: String,
    val status: String,
    val startedAt: Instant?,
    val endedAt: Instant?,
    val retentionFrom: Instant?,
    val reportExpiredAt: Instant?,
    val hasReport: Boolean,
)

/** A round the retention sweep has found, and the candidate whose data it is. */
data class ExpiringRound(
    val sessionId: UUID,
    val userId: UUID,
)

data class StorageDeletionJobRow(
    val id: UUID,
    val bucket: String,
    val objectPrefix: String,
    val attempts: Int,
    val settleAfter: Instant,
)

enum class ReportGenerationClaimStatus {
    ACQUIRED,
    COMPLETED,
    IN_PROGRESS,
    UNAVAILABLE,
}

data class ReportGenerationClaim(
    val status: ReportGenerationClaimStatus,
    val payloadJson: String? = null,
)

data class TurnRow(
    val turnIndex: Int,
    val questionText: String,
    val questionAudioPath: String?,
    /** `pending`, `ready` or `unavailable` — whether a voice is still coming for this question. */
    val questionAudioStatus: String = SpeechStatus.READY.dbValue,
    val answerTranscript: String?,
    val answeredAt: Instant?,
    /** What the interviewer had to supply on this turn — see Intervention. */
    val intervention: String = "none",
    val interventionNote: String? = null,
    /** Where this exchange sat in the round: `warmup`, `main` or `closing`. */
    val phase: String = TurnPhase.MAIN.dbValue,
    /** What the interviewer observed about delivery from the spoken answer. */
    val deliveryNote: String? = null,
    /** Set when the candidate asked for help on this question, rather than being offered it. */
    val hintRequestedAt: Instant? = null,
    val hintText: String? = null,
    /** How much that hint gave away, on the same scale as the interviewer's own help. */
    val hintLevel: String? = null,
    /** Why this question was asked, as raw JSON. Null on turns recorded before provenance existed. */
    val provenanceJson: String? = null,
    /** The model's transition decision, retained so follow-up chains can be bounded. */
    val nextAction: String? = null,
    /**
     * What a strong answer to this question covers, when it was asked from the AI question
     * pool (`pool_question_id`) and that row carries `strong_answer_covers`. Empty for a
     * bank question, a freeform follow-up, or a pool row with nothing recorded. Populated
     * only by [listTranscript], not by [findTurn].
     */
    val poolStrongAnswerCovers: List<String> = emptyList(),
    /**
     * How the answer was timed, as the browser measured it ([AnswerTiming], raw JSON). Null
     * for a turn answered before timing existed or by a client that sent none. Populated
     * only by [listTranscript], like [poolStrongAnswerCovers].
     */
    val answerTimingJson: String? = null,
)

enum class TurnRequestClaimStatus {
    ACQUIRED,
    COMPLETED,
    IN_PROGRESS,
    UNAVAILABLE,
}

data class TurnRequestClaim(
    val status: TurnRequestClaimStatus,
    val responseJson: String? = null,
)

private enum class TurnRequestKind(
    val requestColumn: String,
    val leaseColumn: String,
    val responseColumn: String,
    val completedColumn: String,
) {
    ANSWER("answer_request_id", "answer_request_lease_until", "answer_response", "answered_at"),
    HINT("hint_request_id", "hint_request_lease_until", "hint_response", "hint_requested_at"),
}

/** A bank question a candidate has been asked, for selection. */
data class AskedBankQuestion(
    val bankQuestionId: UUID,
    val lastAskedAt: Instant,
    val inThisRound: Boolean,
)

/** A pool question a candidate has been asked, for selection. The same shape as [AskedBankQuestion]. */
data class AskedPoolQuestion(
    val poolQuestionId: UUID,
    val lastAskedAt: Instant,
    val inThisRound: Boolean,
)

data class ReadinessRow(
    val companyName: String,
    val roleTitle: String,
    val endedAt: Instant?,
    val payloadJson: String,
)
