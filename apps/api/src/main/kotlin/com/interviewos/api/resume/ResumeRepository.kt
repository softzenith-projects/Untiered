package com.interviewos.api.resume

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import org.springframework.transaction.annotation.Transactional
import java.sql.ResultSet
import java.time.Instant
import java.util.UUID

/**
 * Resumes and the profile fields an interview is grounded in.
 *
 * **The resume an interview uses is the most recently parsed one**, derived rather than
 * flagged. A `is_primary` column would let two rows claim to be current after a failed
 * upload, and the candidate would have no way to see which one their round was using.
 */
@Repository
class ResumeRepository(
    private val jdbcClient: JdbcClient,
) {
    fun insertPending(
        userId: UUID,
        bucket: String,
        path: String,
        filename: String,
        contentType: String?,
        sizeBytes: Long,
    ): UUID =
        jdbcClient
            .sql(
                """
                insert into public.resumes
                       (user_id, storage_bucket, storage_path, original_filename, content_type, size_bytes, parse_status)
                values (:u, :bucket, :path, :filename, :contentType, :size, 'processing')
                returning id
                """.trimIndent(),
            ).param("u", userId)
            .param("bucket", bucket)
            .param("path", path)
            .param("filename", filename)
            .param("contentType", contentType)
            .param("size", sizeBytes)
            .query(UUID::class.java)
            .single()

    fun markParsed(
        id: UUID,
        userId: UUID,
        payloadJson: String,
    ) {
        jdbcClient
            .sql(
                """
                update public.resumes
                   set parse_status = 'parsed', parsed_payload = cast(:payload as jsonb),
                       parsed_at = now(), parse_error = null
                 where id = :id and user_id = :u
                """.trimIndent(),
            ).param("payload", payloadJson)
            .param("id", id)
            .param("u", userId)
            .update()
    }

    fun markFailed(
        id: UUID,
        userId: UUID,
        error: String,
    ) {
        jdbcClient
            .sql(
                """
                update public.resumes
                   set parse_status = 'failed', parse_error = :error, parsed_at = null
                 where id = :id and user_id = :u
                """.trimIndent(),
            ).param("error", error.take(500))
            .param("id", id)
            .param("u", userId)
            .update()
    }

    /** The candidate's current resume, whatever state it is in. Null when they have none. */
    fun findLatest(userId: UUID): ResumeRow? =
        jdbcClient
            .sql(
                """
                select id, original_filename, content_type, size_bytes,
                       parse_status::text as parse_status, parse_error, parsed_payload::text as parsed_payload,
                       uploaded_at, parsed_at, storage_bucket, storage_path
                  from public.resumes
                 where user_id = :u
                 order by uploaded_at desc
                 limit 1
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ -> mapResume(rs) }
            .optional()
            .orElse(null)

    /** Deleting an older owned upload must remain possible after it leaves the profile UI. */
    fun findById(
        userId: UUID,
        id: UUID,
    ): ResumeRow? =
        jdbcClient
            .sql(
                """
                select id, original_filename, content_type, size_bytes,
                       parse_status::text as parse_status, parse_error, parsed_payload::text as parsed_payload,
                       uploaded_at, parsed_at, storage_bucket, storage_path
                  from public.resumes where user_id = :u and id = :id
                """.trimIndent(),
            ).param("u", userId)
            .param("id", id)
            .query { rs, _ -> mapResume(rs) }
            .optional()
            .orElse(null)

    /**
     * Keep the newest upload shown in the UI and the newest parsed resume used by rounds.
     * Every other terminal upload is removed with a durable object-deletion job. Processing
     * uploads remain until they finish; a concurrent parse can never delete their file.
     */
    fun enqueueAndDeleteSuperseded(
        userId: UUID,
        bucket: String,
    ): Int =
        jdbcClient
            .sql(
                """
                with keep as (
                    (select id from public.resumes where user_id = :u
                       order by uploaded_at desc, id desc limit 1)
                    union
                    (select id from public.resumes where user_id = :u and parse_status = 'parsed'
                       order by parsed_at desc nulls last, uploaded_at desc, id desc limit 1)
                ), removable as (
                    select id, user_id, storage_path from public.resumes
                     where user_id = :u and parse_status <> 'processing'
                       and id not in (select id from keep)
                       and storage_bucket = :bucket
                       and storage_path like :prefix || '%'
                       and substring(storage_path from length(:prefix) + 1) ~ '^[A-Za-z0-9._-]+$'
                       and position('..' in substring(storage_path from length(:prefix) + 1)) = 0
                ), enqueued as (
                    insert into public.storage_deletion_jobs
                           (user_id, session_id, bucket, object_prefix, reason)
                    select user_id, null, :bucket, storage_path, 'resume_deleted' from removable
                    on conflict (bucket, object_prefix) do update
                       set completed_at = null, next_attempt_at = now(),
                           settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                           reason = excluded.reason, updated_at = now()
                    returning object_prefix
                )
                delete from public.resumes r using removable old
                 where r.id = old.id
                   and exists (select 1 from enqueued where object_prefix = old.storage_path)
                """.trimIndent(),
            ).param("u", userId)
            .param("bucket", bucket)
            .param("prefix", "$userId/")
            .update()

    /** Keyset pages of owners with removable uploads, for retrying failed cleanup. */
    fun supersededOwnersAfter(
        after: UUID?,
        limit: Int,
        bucket: String,
    ): List<UUID> =
        jdbcClient
            .sql(
                """
                with ranked as (
                    select user_id, storage_bucket, storage_path, parse_status,
                           row_number() over (partition by user_id order by uploaded_at desc, id desc) as upload_rank,
                           row_number() over (
                             partition by user_id, (parse_status = 'parsed')
                             order by parsed_at desc nulls last, uploaded_at desc, id desc
                           ) as parsed_rank
                      from public.resumes
                )
                select distinct user_id from ranked
                 where user_id > coalesce(cast(:after as uuid), '00000000-0000-0000-0000-000000000000'::uuid)
                   and parse_status <> 'processing' and upload_rank > 1
                   and (parse_status <> 'parsed' or parsed_rank > 1)
                   and storage_bucket = :bucket
                   and storage_path like user_id::text || '/%'
                   and substring(storage_path from length(user_id::text) + 2) ~ '^[A-Za-z0-9._-]+$'
                   and position('..' in substring(storage_path from length(user_id::text) + 2)) = 0
                 order by user_id limit :limit
                """.trimIndent(),
            ).param("after", after?.toString())
            .param("limit", limit)
            .param("bucket", bucket)
            .query { rs, _ -> requireNotNull(rs.getObject(1, UUID::class.java)) }
            .list()

    /**
     * The resume an interview should be grounded in: the most recent one that actually
     * parsed. A failed upload does not displace a working resume, which matters because
     * the alternative is a round that silently loses its grounding.
     */
    fun findParsed(userId: UUID): ResumeRow? =
        jdbcClient
            .sql(
                """
                select id, original_filename, content_type, size_bytes,
                       parse_status::text as parse_status, parse_error, parsed_payload::text as parsed_payload,
                       uploaded_at, parsed_at, storage_bucket, storage_path
                  from public.resumes
                 where user_id = :u and parse_status = 'parsed'
                 order by parsed_at desc
                 limit 1
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ -> mapResume(rs) }
            .optional()
            .orElse(null)

    /** Queue the exact stored object and remove the owned row in one database statement. */
    fun enqueueAndDelete(
        id: UUID,
        userId: UUID,
        bucket: String,
        path: String,
    ): Boolean =
        jdbcClient
            .sql(
                """
                with owned as (
                    select id, user_id from public.resumes
                     where id = :id and user_id = :u
                       and storage_bucket = :bucket and storage_path = :path
                ), enqueued as (
                    insert into public.storage_deletion_jobs
                           (user_id, session_id, bucket, object_prefix, reason)
                    select user_id, null, :bucket, :path, 'resume_deleted' from owned
                    on conflict (bucket, object_prefix) do update
                       set completed_at = null,
                           next_attempt_at = now(),
                           settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                           reason = excluded.reason,
                           updated_at = now()
                    returning object_prefix
                )
                delete from public.resumes r using owned
                 where r.id = owned.id and exists (select 1 from enqueued)
                """.trimIndent(),
            ).param("id", id)
            .param("u", userId)
            .param("bucket", bucket)
            .param("path", path)
            .update() == 1

    // -- profile ---------------------------------------------------------------

    /**
     * Writes the fields a candidate filled in themselves.
     *
     * Every column is coalesced against what is already stored, so a client that sends a
     * partial profile updates what it sent rather than blanking the rest. Clearing a field
     * is done by sending an empty string, which the service turns into an explicit null.
     */
    fun upsertProfile(
        userId: UUID,
        update: ProfileUpdate,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.profiles (
                    user_id, function, current_level, target_level, location, headline,
                    linkedin_url, notice_period_days, work_authorisation_status,
                    relocation_intent, people_management_scope, total_experience_months
                ) values (
                    :u, :function, :currentLevel, :targetLevel, :location, :headline,
                    :linkedin, :notice, :workAuth,
                    cast(:relocation as public.relocation_intent), :peopleScope, :experience
                )
                on conflict (user_id) do update set
                    function = coalesce(excluded.function, public.profiles.function),
                    current_level = coalesce(excluded.current_level, public.profiles.current_level),
                    target_level = coalesce(excluded.target_level, public.profiles.target_level),
                    location = coalesce(excluded.location, public.profiles.location),
                    headline = coalesce(excluded.headline, public.profiles.headline),
                    linkedin_url = coalesce(excluded.linkedin_url, public.profiles.linkedin_url),
                    notice_period_days = coalesce(excluded.notice_period_days, public.profiles.notice_period_days),
                    work_authorisation_status =
                        coalesce(excluded.work_authorisation_status, public.profiles.work_authorisation_status),
                    relocation_intent = coalesce(excluded.relocation_intent, public.profiles.relocation_intent),
                    people_management_scope =
                        coalesce(excluded.people_management_scope, public.profiles.people_management_scope),
                    total_experience_months =
                        coalesce(excluded.total_experience_months, public.profiles.total_experience_months)
                """.trimIndent(),
            ).param("u", userId)
            .param("function", update.function)
            .param("currentLevel", update.currentLevel)
            .param("targetLevel", update.targetLevel)
            .param("location", update.location)
            .param("headline", update.headline)
            .param("linkedin", update.linkedinUrl)
            .param("notice", update.noticePeriodDays)
            .param("workAuth", update.workAuthorisationStatus)
            .param("relocation", update.relocationIntent)
            .param("peopleScope", update.peopleManagementScope)
            .param("experience", update.totalExperienceMonths)
            .update()
    }

    @Transactional
    fun replaceAvatarPath(
        userId: UUID,
        path: String,
        bucket: String,
    ) {
        // Serialize two concurrent replacements. Otherwise both can read the same old
        // path and leave one of their newly uploaded objects unreferenced.
        jdbcClient
            .sql("select id from public.users where id = :u for update")
            .param("u", userId)
            .query(UUID::class.java)
            .single()
        val old = avatarPath(userId)
        if (old != null &&
            (
                !com.interviewos.api.storage.StorageKeys
                    .isDirectChildOf(old, userId.toString()) ||
                    !old.substringAfterLast('/').startsWith("avatar-")
            )
        ) {
            throw IllegalStateException("Refusing to delete an avatar outside its owner's folder")
        }
        jdbcClient
            .sql(
                """
                insert into public.profiles (user_id, avatar_path) values (:u, :path)
                on conflict (user_id) do update set avatar_path = excluded.avatar_path
                """.trimIndent(),
            ).param("u", userId)
            .param("path", path)
            .update()
        if (old != null && old != path) {
            jdbcClient
                .sql(
                    """
                    insert into public.storage_deletion_jobs
                           (user_id, session_id, bucket, object_prefix, reason)
                    values (:u, null, :bucket, :old, 'resume_deleted')
                    on conflict (bucket, object_prefix) do update
                       set completed_at = null, next_attempt_at = now(),
                           settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                           reason = excluded.reason, updated_at = now()
                    """.trimIndent(),
                ).param("u", userId)
                .param("bucket", bucket)
                .param("old", old)
                .update()
        }
    }

    /**
     * The profile as the candidate last saved it.
     *
     * There was no read here at all, only [upsertProfile] and [avatarPath], so everything
     * written through the profile form went in and never came back: the candidate typed
     * their LinkedIn, saved it, and the field was blank again on the next visit. It was
     * stored correctly the whole time. Nothing ever asked for it.
     */
    fun findProfile(userId: UUID): ProfileRow? =
        jdbcClient
            .sql(
                """
                select current_level, target_level, linkedin_url, headline
                from public.profiles
                where user_id = :u
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ ->
                ProfileRow(
                    currentLevel = rs.getString("current_level"),
                    targetLevel = rs.getString("target_level"),
                    linkedinUrl = rs.getString("linkedin_url"),
                    headline = rs.getString("headline"),
                )
            }.optional()
            .orElse(null)

    fun avatarPath(userId: UUID): String? =
        jdbcClient
            .sql("select avatar_path from public.profiles where user_id = :u")
            .param("u", userId)
            .query(String::class.java)
            .optional()
            .orElse(null)

    // -- skills ----------------------------------------------------------------

    /**
     * Records what the resume evidenced, without touching what the candidate said about
     * themselves. A skill they had already rated keeps its rating and simply gains
     * `detected_in_resume`; re-uploading a resume must not silently reset their answers.
     */
    fun recordDetectedSkills(
        userId: UUID,
        names: List<String>,
    ) {
        names.forEach { name ->
            jdbcClient
                .sql(
                    """
                    insert into public.skills (user_id, name, detected_in_resume)
                    values (:u, :name, true)
                    on conflict (user_id, lower(name)) do update set detected_in_resume = true
                    """.trimIndent(),
                ).param("u", userId)
                .param("name", name)
                .update()
        }
    }

    fun upsertSkill(
        userId: UUID,
        name: String,
        confidence: Int?,
        flaggedAsWeak: Boolean,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.skills (user_id, name, self_rated_confidence, flagged_as_weak)
                values (:u, :name, :confidence, :weak)
                on conflict (user_id, lower(name)) do update set
                    self_rated_confidence = excluded.self_rated_confidence,
                    flagged_as_weak = excluded.flagged_as_weak
                """.trimIndent(),
            ).param("u", userId)
            .param("name", name)
            .param("confidence", confidence)
            .param("weak", flaggedAsWeak)
            .update()
    }

    fun deleteSkill(
        userId: UUID,
        name: String,
    ) {
        jdbcClient
            .sql("delete from public.skills where user_id = :u and lower(name) = lower(:name)")
            .param("u", userId)
            .param("name", name)
            .update()
    }

    fun listSkills(userId: UUID): List<SkillRow> =
        jdbcClient
            .sql(
                """
                select name, self_rated_confidence, detected_in_resume, flagged_as_weak
                  from public.skills
                 where user_id = :u
                 order by detected_in_resume desc, lower(name)
                """.trimIndent(),
            ).param("u", userId)
            .query { rs, _ ->
                SkillRow(
                    name = rs.getString("name"),
                    selfRatedConfidence = rs.getInt("self_rated_confidence").takeUnless { rs.wasNull() },
                    detectedInResume = rs.getBoolean("detected_in_resume"),
                    flaggedAsWeak = rs.getBoolean("flagged_as_weak"),
                )
            }.list()

    private fun mapResume(rs: ResultSet) =
        ResumeRow(
            id = rs.getObject("id", UUID::class.java),
            originalFilename = rs.getString("original_filename"),
            contentType = rs.getString("content_type"),
            sizeBytes = rs.getLong("size_bytes").takeUnless { rs.wasNull() },
            parseStatus = rs.getString("parse_status"),
            parseError = rs.getString("parse_error"),
            parsedPayloadJson = rs.getString("parsed_payload"),
            uploadedAt = rs.getTimestamp("uploaded_at")?.toInstant(),
            parsedAt = rs.getTimestamp("parsed_at")?.toInstant(),
            storageBucket = rs.getString("storage_bucket"),
            storagePath = rs.getString("storage_path"),
        )
}

data class ResumeRow(
    val id: UUID,
    val originalFilename: String,
    val contentType: String?,
    val sizeBytes: Long?,
    val parseStatus: String,
    val parseError: String?,
    val parsedPayloadJson: String?,
    val uploadedAt: Instant?,
    val parsedAt: Instant?,
    val storageBucket: String,
    val storagePath: String,
)

data class SkillRow(
    val name: String,
    val selfRatedConfidence: Int?,
    val detectedInResume: Boolean,
    val flaggedAsWeak: Boolean,
)

/** What the candidate told us about themselves, as opposed to what the resume said. */
data class ProfileRow(
    val currentLevel: String?,
    val targetLevel: String?,
    val linkedinUrl: String?,
    val headline: String?,
)

/** Null means "leave this alone". The service turns an explicitly cleared field into null. */
data class ProfileUpdate(
    val function: String? = null,
    val currentLevel: String? = null,
    val targetLevel: String? = null,
    val location: String? = null,
    val headline: String? = null,
    val linkedinUrl: String? = null,
    val noticePeriodDays: Int? = null,
    val workAuthorisationStatus: String? = null,
    val relocationIntent: String? = null,
    val peopleManagementScope: String? = null,
    val totalExperienceMonths: Int? = null,
)
