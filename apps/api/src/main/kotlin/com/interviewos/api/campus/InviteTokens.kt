package com.interviewos.api.campus

import java.security.MessageDigest
import java.security.SecureRandom
import java.util.Base64

/**
 * Invite tokens: 32 bytes from [SecureRandom], base64url without padding (43 characters).
 * Only [hash] — SHA-256 of the token's ASCII text — is ever stored, so a read of the database
 * cannot be turned back into a working link.
 */
object InviteTokens {
    private const val BYTES = 32
    private val random = SecureRandom()
    private val encoder = Base64.getUrlEncoder().withoutPadding()
    private val SHAPE = Regex("^[A-Za-z0-9_-]{43}$")

    fun generate(): String = ByteArray(BYTES).also(random::nextBytes).let(encoder::encodeToString)

    fun hash(token: String): ByteArray = MessageDigest.getInstance("SHA-256").digest(token.toByteArray(Charsets.US_ASCII))

    /** Whether [value] could be a token at all; anything else is not looked up. */
    fun isWellFormed(value: String): Boolean = SHAPE.matches(value)
}
