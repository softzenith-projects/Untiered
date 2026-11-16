package com.interviewos.api.account

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.StorageProperties
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
import java.util.UUID

/**
 * Deleting a candidate's account, everything in it, and the sign-in itself (PRD 12).
 *
 * `CLAUDE.md` is unambiguous — "account deletion must actually delete, including storage
 * objects" — so the order here is chosen around the part that does not roll back:
 *
 * 1. **One transaction:** durable jobs are queued to purge the user's prefix in every
 *    bucket (recordings, resumes, the profile photo), and `public.users` is deleted, which
 *    cascades to every user-owned table. College invites are keyed by email rather than by
 *    account, so the ones addressed to this account or accepted by it are deleted first. The
 *    jobs live outside that foreign-key tree, so they survive it. Either both happen or neither does. The one exception is
 *    `public.payments`: a payment record is kept for tax and refunds, detached from the
 *    account (`on delete set null`), with nothing in it that names the person.
 * 2. **Then the auth user** is removed through the Supabase admin API. Its row cascades to
 *    `public.users` too, so if step 1 had somehow left anything, this clears it.
 *
 * If step 2 fails, the candidate's data is already gone and their files are queued; only
 * the sign-in survives. The request fails loudly so it can be retried, and a retry is safe:
 * the jobs upsert, the row delete finds nothing, and an auth user that is already gone
 * counts as deleted. Doing it the other way round would risk the worse failure — a deleted
 * sign-in whose data nobody can reach any more, and so nobody can ask to delete.
 *
 * [userId] comes from the verified token and nowhere else; there is no way to name
 * somebody else's account.
 */
@Service
class AccountDeletion(
    private val repository: AccountRepository,
    private val authAdmin: AuthAdmin,
    private val storageProperties: StorageProperties,
    transactionManager: PlatformTransactionManager,
) {
    private val log = LoggerFactory.getLogger(javaClass)
    private val transactions = TransactionTemplate(transactionManager)

    fun delete(userId: UUID) {
        // Checked before anything is touched. Deleting the data and then discovering the
        // sign-in cannot be removed would leave a half-deleted account by design.
        if (!authAdmin.configured) {
            throw ApiException.upstreamUnavailable("Account deletion is not available right now. Nothing was deleted.")
        }

        val prefix = userId.toString()
        transactions.executeWithoutResult {
            setOf(storageProperties.mediaBucket, storageProperties.resumeBucket).forEach { bucket ->
                repository.enqueueAccountPurge(userId, bucket, prefix)
            }
            repository.deleteCampusInvites(userId)
            repository.deleteUser(userId)
        }

        try {
            authAdmin.deleteUser(userId)
        } catch (e: AuthAdminException) {
            log.error("Deleted the data for account {} but could not remove its sign-in", userId, e)
            throw ApiException.upstreamUnavailable(
                "Your data has been deleted, but your sign-in could not be removed just now. Try again in a moment.",
            )
        }
        log.info("Deleted account {}", userId)
    }
}
