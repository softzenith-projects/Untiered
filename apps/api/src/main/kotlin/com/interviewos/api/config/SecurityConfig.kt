package com.interviewos.api.config

import com.interviewos.api.common.ApiErrorWriter
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpMethod
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.config.http.SessionCreationPolicy
import org.springframework.security.oauth2.jose.jws.SignatureAlgorithm
import org.springframework.security.oauth2.jwt.JwtDecoder
import org.springframework.security.oauth2.jwt.JwtIssuerValidator
import org.springframework.security.oauth2.jwt.JwtValidators
import org.springframework.security.oauth2.jwt.NimbusJwtDecoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.web.cors.CorsConfiguration
import org.springframework.web.cors.CorsConfigurationSource
import org.springframework.web.cors.UrlBasedCorsConfigurationSource

/**
 * The API is a stateless resource server. Every authenticated request carries a
 * Supabase access token, and the caller's identity is taken from the verified token
 * subject only — never from a request body or header supplied by the client.
 */
@Configuration
class SecurityConfig {
    @Bean
    fun securityFilterChain(
        http: HttpSecurity,
        errorWriter: ApiErrorWriter,
    ): SecurityFilterChain {
        http
            // No cookies, no sessions, no CSRF surface: bearer tokens only.
            .csrf { it.disable() }
            .cors { }
            .sessionManagement { it.sessionCreationPolicy(SessionCreationPolicy.STATELESS) }
            .authorizeHttpRequests {
                it.requestMatchers(HttpMethod.OPTIONS, "/**").permitAll()
                it.requestMatchers("/api/health", "/actuator/health", "/actuator/health/**").permitAll()
                // Two aggregate integers with nothing personal in them, read by the
                // public landing page before anyone has signed in.
                it.requestMatchers(HttpMethod.GET, "/api/v1/usage").permitAll()
                it.requestMatchers(HttpMethod.POST, "/api/v1/email/unsubscribe/*").permitAll()
                it.anyRequest().authenticated()
            }.oauth2ResourceServer { resourceServer ->
                resourceServer.jwt { }
                resourceServer.authenticationEntryPoint(errorWriter)
                resourceServer.accessDeniedHandler(errorWriter)
            }.exceptionHandling {
                it.authenticationEntryPoint(errorWriter)
                it.accessDeniedHandler(errorWriter)
            }
        return http.build()
    }

    /**
     * Verifies signature against the project's published JWKS, then checks that the
     * token was issued by this Supabase project for an authenticated end user.
     */
    @Bean
    fun jwtDecoder(properties: SupabaseAuthProperties): JwtDecoder {
        val decoder =
            NimbusJwtDecoder
                .withJwkSetUri(properties.jwkSetUri)
                // Supabase signs with an elliptic-curve key; the builder would otherwise
                // accept RS256 only and reject every real token. RS256 stays allowed for
                // projects still on the older RSA signing key.
                .jwsAlgorithms { algorithms ->
                    algorithms.addAll(setOf(SignatureAlgorithm.ES256, SignatureAlgorithm.RS256))
                }.build()
        decoder.setJwtValidator(
            JwtValidators.createDefaultWithValidators(
                JwtIssuerValidator(properties.issuer),
                SupabaseAudienceValidator(properties.audience),
            ),
        )
        return decoder
    }

    @Bean
    fun corsConfigurationSource(properties: WebProperties): CorsConfigurationSource {
        val configuration =
            CorsConfiguration().apply {
                allowedOrigins = properties.allowedOrigins
                allowedMethods = listOf("GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS")
                allowedHeaders = listOf("Authorization", "Content-Type", "X-Request-ID")
                exposedHeaders = listOf("X-Request-ID")
                maxAge = 3600
            }
        return UrlBasedCorsConfigurationSource().apply {
            registerCorsConfiguration("/api/**", configuration)
        }
    }
}
