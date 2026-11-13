package com.interviewos.api.account

import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.stereotype.Repository
import java.util.UUID

@Repository
class AccountRepository(
    private val jdbcClient: JdbcClient,
) {
    /**
     * Queues the purge of every object under [objectPrefix] in [bucket]. An existing job for
     * the same prefix is reopened rather than duplicated, so a retried deletion is harmless.
     * The settle window is the same as a round's: anything still uploading when the account
     * goes is caught by the pass that runs after it.
     */
    fun enqueueAccountPurge(
        userId: UUID,
        bucket: String,
        objectPrefix: String,
    ) {
        jdbcClient
            .sql(
                """
                insert into public.storage_deletion_jobs
                       (user_id, session_id, bucket, object_prefix, reason)
                values (:u, null, :bucket, :prefix, 'account_deleted')
                on conflict (bucket, object_prefix) do update
                   set completed_at = null,
                       next_attempt_at = now(),
                       settle_after = greatest(public.storage_deletion_jobs.settle_after, now() + interval '15 minutes'),
                       reason = excluded.reason,
                       updated_at = now()
                """.trimIndent(),
            ).param("u", userId)
            .param("bucket", bucket)
            .param("prefix", objectPrefix)
            .update()
    }

    /**
     * College invites are addressed to an email, not to an account, so nothing cascades to them
     * from `public.users`. Deletes those sent to this account's email and those it accepted
     * (through its memberships, which would otherwise only lose their link). Run before
     * [deleteUser], while the email and the memberships can still be read.
     */
    fun deleteCampusInvites(userId: UUID): Int =
        jdbcClient
            .sql(
                """
                delete from public.campus_invites i
                 where i.email = (select lower(btrim(u.email)) from public.users u where u.id = :u)
                    or (i.org_id, i.member_id) in (select m.org_id, m.id from public.org_members m where m.user_id = :u)
                """.trimIndent(),
            ).param("u", userId)
            .update()

    /** Removes the account row; every user-owned table cascades from it. */
    fun deleteUser(userId: UUID): Boolean =
        jdbcClient
            .sql("delete from public.users where id = :u")
            .param("u", userId)
            .update() > 0
}
