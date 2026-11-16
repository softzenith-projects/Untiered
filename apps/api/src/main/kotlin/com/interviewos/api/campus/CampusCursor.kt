package com.interviewos.api.campus

import com.interviewos.api.common.ApiException
import java.time.Instant
import java.time.format.DateTimeParseException
import java.util.Base64
import java.util.UUID

/**
 * Opaque `nextCursor` values. They only encode a position in a list the caller could already
 * read, and every query still binds the caller's own college, so a cursor edited by hand can
 * page through nothing it could not have reached anyway.
 */
object CampusCursor {
    const val PAGE_SIZE = 100

    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val decoder = Base64.getUrlDecoder()

    fun encodeMember(cursor: MemberCursor): String = encoder.encodeToString("${cursor.joinedAt}|${cursor.id}".toByteArray())

    fun decodeMember(value: String?): MemberCursor? {
        val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return try {
            val (at, id) = String(decoder.decode(raw)).split('|', limit = 2).also { require(it.size == 2) }
            MemberCursor(Instant.parse(at), UUID.fromString(id))
        } catch (e: IllegalArgumentException) {
            throw badCursor()
        } catch (e: DateTimeParseException) {
            throw badCursor()
        }
    }

    /** Invites page on (created_at, id), newest first: the same shape as the member cursor. */
    fun encodeInvite(
        createdAt: Instant,
        id: UUID,
    ): String = encodeMember(MemberCursor(createdAt, id))

    fun decodeInvite(value: String?): MemberCursor? = decodeMember(value)

    fun encodeAudit(id: Long): String = id.toString()

    fun decodeAudit(value: String?): Long? {
        val raw = value?.trim()?.takeIf { it.isNotEmpty() } ?: return null
        return raw.toLongOrNull()?.takeIf { it > 0 } ?: throw badCursor()
    }

    private fun badCursor() = ApiException.badRequest("That cursor is not one this list gave out.", code = "invalid_cursor")
}
