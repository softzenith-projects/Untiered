package com.interviewos.api.user

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNull

class SupabaseIdentityTest {
    private val userId = UUID.fromString("6f1b7f4c-2b2a-4c3e-9a51-0a5f4f2f2a11")

    @Test
    fun `reads id, email and display name from a Google sign-in token`() {
        val identity =
            SupabaseIdentity.from(
                token(
                    subject = userId.toString(),
                    claims =
                        mapOf(
                            "email" to "candidate@example.com",
                            "user_metadata" to mapOf("full_name" to "  Test Candidate  "),
                        ),
                ),
            )

        assertEquals(userId, identity.id)
        assertEquals("candidate@example.com", identity.email)
        assertEquals("Test Candidate", identity.displayName)
    }

    @Test
    fun `falls back to the name claim when full_name is absent`() {
        val identity =
            SupabaseIdentity.from(
                token(
                    subject = userId.toString(),
                    claims =
                        mapOf(
                            "email" to "candidate@example.com",
                            "user_metadata" to mapOf("name" to "Test Candidate"),
                        ),
                ),
            )

        assertEquals("Test Candidate", identity.displayName)
    }

    @Test
    fun `tolerates a token with no user metadata`() {
        val identity =
            SupabaseIdentity.from(
                token(subject = userId.toString(), claims = mapOf("email" to "candidate@example.com")),
            )

        assertNull(identity.displayName)
    }

    @Test
    fun `rejects a token whose subject is not a user id`() {
        assertThrows<InvalidBearerTokenException> {
            SupabaseIdentity.from(
                token(subject = "not-a-uuid", claims = mapOf("email" to "candidate@example.com")),
            )
        }
    }

    @Test
    fun `rejects a token with no email claim`() {
        assertThrows<InvalidBearerTokenException> {
            SupabaseIdentity.from(token(subject = userId.toString(), claims = emptyMap()))
        }
    }

    @Test
    fun `rejects a token with a blank email claim`() {
        assertThrows<InvalidBearerTokenException> {
            SupabaseIdentity.from(token(subject = userId.toString(), claims = mapOf("email" to "   ")))
        }
    }

    @Test
    fun `reads the Google account photo from a Google sign-in`() {
        val identity =
            SupabaseIdentity.from(
                token(
                    subject = userId.toString(),
                    claims =
                        mapOf(
                            "email" to "candidate@example.com",
                            "user_metadata" to mapOf("avatar_url" to "https://lh3.googleusercontent.com/a/photo=s96-c"),
                            "app_metadata" to mapOf("provider" to "google", "providers" to listOf("google")),
                        ),
                ),
            )

        assertEquals("https://lh3.googleusercontent.com/a/photo=s96-c", identity.providerPhotoUrl)
    }

    @Test
    fun `believes a photo only from a Google account and Google's image host`() {
        val google = setOf("google")
        val photo = "https://lh3.googleusercontent.com/a/photo"

        assertEquals(photo, SupabaseIdentity.googlePhotoFrom(mapOf("picture" to photo), google))
        // An email account can write any URL into its own metadata from the browser.
        assertNull(SupabaseIdentity.googlePhotoFrom(mapOf("avatar_url" to photo), setOf("email")))
        assertNull(SupabaseIdentity.googlePhotoFrom(mapOf("avatar_url" to "https://evil.example/x.png"), google))
        assertNull(SupabaseIdentity.googlePhotoFrom(mapOf("avatar_url" to "http://lh3.googleusercontent.com/a"), google))
        assertNull(SupabaseIdentity.googlePhotoFrom(mapOf("avatar_url" to "https://googleusercontent.com.evil.example/a"), google))
        assertNull(SupabaseIdentity.googlePhotoFrom(mapOf("avatar_url" to "https://x@lh3.googleusercontent.com/a"), google))
        assertNull(SupabaseIdentity.googlePhotoFrom(emptyMap(), google))
    }

    private fun token(
        subject: String,
        claims: Map<String, Any>,
    ): Jwt =
        Jwt
            .withTokenValue("token")
            .header("alg", "ES256")
            .subject(subject)
            .issuedAt(Instant.parse("2026-08-25T10:00:00Z"))
            .expiresAt(Instant.parse("2026-08-25T11:00:00Z"))
            .also { builder -> claims.forEach { (name, value) -> builder.claim(name, value) } }
            .build()
}
