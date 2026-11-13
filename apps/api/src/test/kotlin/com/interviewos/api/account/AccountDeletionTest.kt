package com.interviewos.api.account

import com.interviewos.api.common.ApiException
import com.interviewos.api.storage.StorageProperties
import org.junit.jupiter.api.Test
import org.mockito.BDDMockito.given
import org.mockito.BDDMockito.willThrow
import org.mockito.Mockito.inOrder
import org.mockito.Mockito.mock
import org.mockito.Mockito.never
import org.mockito.Mockito.verify
import org.mockito.Mockito.verifyNoInteractions
import org.springframework.http.HttpStatus
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.SimpleTransactionStatus
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

/**
 * What matters is what is left behind: a deletion that removes the rows and keeps the
 * recordings has told the candidate something untrue. These check the calls actually made.
 */
class AccountDeletionTest {
    private val userId: UUID = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    private val storageProperties =
        StorageProperties(
            supabaseUrl = "https://project.supabase.co",
            serviceRoleKey = "service-role",
            resumeBucket = "resumes",
            mediaBucket = "interview-media",
        )

    private val repository = mock(AccountRepository::class.java)
    private val authAdmin = mock(AuthAdmin::class.java)

    // Hands back a status object, as a real manager does; a bare mock would pass null.
    private val transactionManager: PlatformTransactionManager =
        mock(PlatformTransactionManager::class.java) { invocation ->
            if (invocation.method.name == "getTransaction") SimpleTransactionStatus() else null
        }

    private fun deletion() = AccountDeletion(repository, authAdmin, storageProperties, transactionManager)

    @Test
    fun `queues every bucket under the user's prefix, deletes the rows, then the sign-in`() {
        given(authAdmin.configured).willReturn(true)

        deletion().delete(userId)

        val order = inOrder(repository, authAdmin)
        order.verify(repository).enqueueAccountPurge(userId, "interview-media", userId.toString())
        order.verify(repository).enqueueAccountPurge(userId, "resumes", userId.toString())
        // Invites are found by the account's email and memberships, so before the row goes.
        order.verify(repository).deleteCampusInvites(userId)
        order.verify(repository).deleteUser(userId)
        order.verify(authAdmin).deleteUser(userId)
    }

    @Test
    fun `touches nothing when the sign-in could never be removed`() {
        given(authAdmin.configured).willReturn(false)

        val error = assertFailsWith<ApiException> { deletion().delete(userId) }

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.status)
        verifyNoInteractions(repository)
        verify(authAdmin, never()).deleteUser(userId)
    }

    /** The data is already gone, so the failure says that rather than "nothing happened". */
    @Test
    fun `reports a sign-in that could not be removed after the data went`() {
        given(authAdmin.configured).willReturn(true)
        willThrow(AuthAdminException("boom")).given(authAdmin).deleteUser(userId)

        val error = assertFailsWith<ApiException> { deletion().delete(userId) }

        assertEquals(HttpStatus.SERVICE_UNAVAILABLE, error.status)
        verify(repository).deleteUser(userId)
        assert(error.message!!.contains("data has been deleted"))
    }

    /** If the rows cannot be deleted, the sign-in must survive so the candidate can retry. */
    @Test
    fun `keeps the sign-in when the rows could not be deleted`() {
        given(authAdmin.configured).willReturn(true)
        willThrow(IllegalStateException("db down")).given(repository).deleteUser(userId)

        assertFailsWith<IllegalStateException> { deletion().delete(userId) }

        verify(authAdmin, never()).deleteUser(userId)
    }
}
