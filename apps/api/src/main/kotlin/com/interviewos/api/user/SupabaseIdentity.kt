package com.interviewos.api.user

import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.security.oauth2.server.resource.InvalidBearerTokenException
import java.util.UUID

/**
 * The caller, as asserted by a verified Supabase token. This is the only source of a
 * user id anywhere in the API — a client-supplied id is never trusted.
 */
data class SupabaseIdentity(
    val id: UUID,
    val email: String,
    val displayName: String?,
    /**
     * How the account signs in, from `app_metadata` — which only Supabase's server can
     * write, unlike `user_metadata`, which the user can edit from the browser. So this, and
     * never a `user_metadata.email_verified` flag, is what may vouch for the email.
     */
    val signInProviders: Set<String> = emptySet(),
    /** Captured only when the account is first provisioned. The user explicitly selected it at sign-up. */
    val emailMarketingOptIn: Boolean = false,
    /**
     * The photo on the candidate's Google account, shown until they upload their own. Never
     * copied or stored — it is Google's URL, read from the token on each request.
     */
    val providerPhotoUrl: String? = null,
) {
    companion object {
        /** Google fills `full_name`; other providers vary, so `name` is the fallback. */
        private val DISPLAY_NAME_CLAIMS = listOf("full_name", "name")

        /** Google fills both with the same URL; `avatar_url` is Supabase's own name for it. */
        private val PHOTO_CLAIMS = listOf("avatar_url", "picture")

        /**
         * `user_metadata` can be edited from the browser, so a photo is believed only when the
         * account signs in with Google and the URL is on Google's own image host. Anything else
         * would let an account point its own menu at an arbitrary address.
         */
        fun googlePhotoFrom(
            metadata: Map<String, Any>,
            providers: Set<String>,
        ): String? {
            if ("google" !in providers) return null
            return PHOTO_CLAIMS
                .firstNotNullOfOrNull { metadata[it] as? String }
                ?.trim()
                ?.takeIf { url ->
                    val uri = runCatching { java.net.URI(url) }.getOrNull() ?: return@takeIf false
                    val host = uri.host?.lowercase() ?: return@takeIf false
                    uri.scheme == "https" && uri.userInfo == null && host.endsWith(".googleusercontent.com")
                }
        }

        fun from(jwt: Jwt): SupabaseIdentity {
            val id =
                jwt.subject?.let { runCatching { UUID.fromString(it) }.getOrNull() }
                    ?: throw InvalidBearerTokenException("Token subject is not a Supabase user id.")
            val email =
                jwt.getClaimAsString("email")?.trim()?.takeIf { it.isNotEmpty() }
                    ?: throw InvalidBearerTokenException("Token does not carry an email claim.")
            val metadata: Map<String, Any> = jwt.getClaimAsMap("user_metadata").orEmpty()
            val displayName =
                DISPLAY_NAME_CLAIMS
                    .firstNotNullOfOrNull { metadata[it] as? String }
                    ?.trim()
                    ?.takeIf { it.isNotEmpty() }
            val appMetadata: Map<String, Any> = jwt.getClaimAsMap("app_metadata").orEmpty()
            val providers =
                buildSet {
                    (appMetadata["provider"] as? String)?.let { add(it.lowercase()) }
                    (appMetadata["providers"] as? Collection<*>)?.forEach { (it as? String)?.let { name -> add(name.lowercase()) } }
                }
            return SupabaseIdentity(
                id,
                email,
                displayName,
                providers,
                metadata["email_marketing_opt_in"] == true,
                googlePhotoFrom(metadata, providers),
            )
        }
    }
}
