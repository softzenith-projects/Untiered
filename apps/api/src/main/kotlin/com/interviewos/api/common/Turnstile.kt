package com.interviewos.api.common

import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.http.MediaType
import org.springframework.stereotype.Component
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import org.springframework.web.client.RestClientException
import tools.jackson.databind.JsonNode

@ConfigurationProperties(prefix = "interviewos.turnstile")
data class TurnstileProperties(
    /** Cloudflare Turnstile secret. Empty turns server-side verification off (local development). */
    val secretKey: String = "",
    val verifyUrl: String = "https://challenges.cloudflare.com/turnstile/v0/siteverify",
) {
    val enabled: Boolean get() = secretKey.isNotBlank()
}

/**
 * Checks a Cloudflare Turnstile token on the server. Sign-up's token is checked by Supabase
 * Auth; the public campus lead form has no Supabase in its path, so the API checks it here.
 */
interface TurnstileVerifier {
    /** False when the check is on and the token is missing, used, expired or forged. */
    fun verify(
        token: String?,
        remoteIp: String?,
    ): Boolean
}

/**
 * Cloudflare's siteverify over the API's own HTTP client. With no secret configured every
 * token passes, and that is said once at startup, so a deployment cannot run with the check
 * off without it being in the log. Fails closed: when Cloudflare cannot be reached, the
 * token is not accepted.
 */
@Component
class CloudflareTurnstileVerifier(
    private val properties: TurnstileProperties,
    restClientBuilder: RestClient.Builder,
) : TurnstileVerifier {
    private val log = LoggerFactory.getLogger(javaClass)
    private val client = restClientBuilder.clone().build()

    init {
        if (!properties.enabled) {
            log.warn("TURNSTILE_SECRET_KEY is not set: the campus lead form's captcha is not verified (local development only)")
        }
    }

    override fun verify(
        token: String?,
        remoteIp: String?,
    ): Boolean {
        if (!properties.enabled) return true
        val clean = token?.trim().orEmpty()
        if (clean.isEmpty() || clean.length > MAX_TOKEN) return false
        val form =
            LinkedMultiValueMap<String, String>().apply {
                add("secret", properties.secretKey)
                add("response", clean)
                if (!remoteIp.isNullOrBlank()) add("remoteip", remoteIp)
            }
        return try {
            val result =
                client
                    .post()
                    .uri(properties.verifyUrl)
                    .contentType(MediaType.APPLICATION_FORM_URLENCODED)
                    .body(form)
                    .retrieve()
                    .body(JsonNode::class.java)
            result?.get("success")?.asBoolean() == true
        } catch (cause: RestClientException) {
            log.warn("Turnstile verification could not be completed ({})", cause.javaClass.simpleName)
            false
        }
    }

    private companion object {
        /** Cloudflare documents tokens of up to 2048 characters. */
        const val MAX_TOKEN = 2048
    }
}
