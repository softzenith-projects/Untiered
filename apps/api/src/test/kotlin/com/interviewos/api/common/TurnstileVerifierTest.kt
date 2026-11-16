package com.interviewos.api.common

import org.junit.jupiter.api.Test
import org.springframework.http.HttpMethod
import org.springframework.http.HttpStatus
import org.springframework.http.MediaType
import org.springframework.test.web.client.MockRestServiceServer
import org.springframework.test.web.client.match.MockRestRequestMatchers.content
import org.springframework.test.web.client.match.MockRestRequestMatchers.method
import org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo
import org.springframework.test.web.client.response.MockRestResponseCreators.withStatus
import org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess
import org.springframework.util.LinkedMultiValueMap
import org.springframework.web.client.RestClient
import kotlin.test.assertFalse
import kotlin.test.assertTrue

/** Cloudflare's siteverify, mocked at the HTTP boundary. No test reaches Cloudflare. */
class TurnstileVerifierTest {
    private val url = "https://challenges.cloudflare.com/turnstile/v0/siteverify"

    @Test
    fun `with no secret configured every token passes and nothing is called`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val verifier = CloudflareTurnstileVerifier(TurnstileProperties(secretKey = ""), builder)

        assertTrue(verifier.verify(null, null))
        assertTrue(verifier.verify("anything", "203.0.113.9"))
        server.verify()
    }

    @Test
    fun `a token Cloudflare accepts passes, and the secret, token and IP are what is sent`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val form =
            LinkedMultiValueMap<String, String>().apply {
                add("secret", "test-secret")
                add("response", "token-123")
                add("remoteip", "203.0.113.9")
            }
        server
            .expect(requestTo(url))
            .andExpect(method(HttpMethod.POST))
            .andExpect(content().formData(form))
            .andRespond(withSuccess("""{"success":true,"error-codes":[],"hostname":"untiered.tech"}""", MediaType.APPLICATION_JSON))

        assertTrue(CloudflareTurnstileVerifier(TurnstileProperties(secretKey = "test-secret"), builder).verify("token-123", "203.0.113.9"))
        server.verify()
    }

    @Test
    fun `a token Cloudflare refuses fails`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server
            .expect(requestTo(url))
            .andRespond(withSuccess("""{"success":false,"error-codes":["timeout-or-duplicate"]}""", MediaType.APPLICATION_JSON))

        assertFalse(CloudflareTurnstileVerifier(TurnstileProperties(secretKey = "test-secret"), builder).verify("used", null))
        server.verify()
    }

    @Test
    fun `when Cloudflare cannot answer, the token is not accepted`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        server.expect(requestTo(url)).andRespond(withStatus(HttpStatus.BAD_GATEWAY))

        assertFalse(CloudflareTurnstileVerifier(TurnstileProperties(secretKey = "test-secret"), builder).verify("token", null))
        server.verify()
    }

    @Test
    fun `a missing or oversized token fails without a call`() {
        val builder = RestClient.builder()
        val server = MockRestServiceServer.bindTo(builder).build()
        val verifier = CloudflareTurnstileVerifier(TurnstileProperties(secretKey = "test-secret"), builder)

        assertFalse(verifier.verify(null, null))
        assertFalse(verifier.verify("   ", null))
        assertFalse(verifier.verify("x".repeat(2049), null))
        server.verify()
    }
}
