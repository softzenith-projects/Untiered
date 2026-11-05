package com.interviewos.api.user

import org.junit.jupiter.api.Test
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.http.HttpStatus
import java.sql.SQLException
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class MissingAuthUserTest {
    @Test
    fun `recognises the users foreign key to auth users`() {
        // The exact failure in UNTIERED-API-5 and UNTIERED-API-6.
        val ex =
            DataIntegrityViolationException(
                "PreparedStatementCallback",
                SQLException(
                    "ERROR: insert or update on table \"users\" violates foreign key constraint \"users_id_fkey\"",
                    "23503",
                ),
            )

        assertTrue(isMissingAuthUser(ex))
    }

    @Test
    fun `leaves other integrity failures to be reported as defects`() {
        val duplicateEmail =
            DataIntegrityViolationException(
                "PreparedStatementCallback",
                SQLException("duplicate key value violates unique constraint \"users_email_key\"", "23505"),
            )
        val otherForeignKey =
            DataIntegrityViolationException(
                "PreparedStatementCallback",
                SQLException("violates foreign key constraint \"profiles_user_id_fkey\"", "23503"),
            )

        assertFalse(isMissingAuthUser(duplicateEmail))
        assertFalse(isMissingAuthUser(otherForeignKey))
    }

    @Test
    fun `answers with the same 401 a missing token gets`() {
        val ex = accountNoLongerExists()

        assertEquals(HttpStatus.UNAUTHORIZED, ex.status)
        assertEquals("unauthorized", ex.code)
    }
}
