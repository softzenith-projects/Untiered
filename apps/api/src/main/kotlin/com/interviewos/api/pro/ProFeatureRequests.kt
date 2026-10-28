package com.interviewos.api.pro

import com.interviewos.api.common.ApiException
import com.interviewos.api.user.SupabaseIdentity
import com.interviewos.api.user.UserRepository
import org.springframework.http.HttpStatus
import org.springframework.jdbc.core.simple.JdbcClient
import org.springframework.security.core.annotation.AuthenticationPrincipal
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController

/** The choices the upgrade page offers. Stored as these keys so the copy can change freely. */
val PRO_FEATURE_KEYS = setOf("more_practice", "progress", "recommendations", "prep_plans", "new_formats")

data class ProFeatureRequest(
    val features: List<String> = emptyList(),
    val note: String? = null,
)

@Service
class ProFeatureRequestService(
    private val jdbc: JdbcClient,
    private val userRepository: UserRepository,
) {
    @Transactional
    fun submit(
        identity: SupabaseIdentity,
        request: ProFeatureRequest,
    ) {
        val features = request.features.distinct()
        val note = request.note?.trim()?.takeIf { it.isNotEmpty() }
        if (features.any { it !in PRO_FEATURE_KEYS }) throw ApiException.badRequest("Choose features from the list shown.")
        if (features.isEmpty() && note == null) throw ApiException.badRequest("Pick at least one feature or write a note.")
        if (note != null && note.length > MAX_NOTE) throw ApiException.badRequest("Keep the note under $MAX_NOTE characters.")

        userRepository.provision(identity)
        val sentToday =
            jdbc
                .sql(
                    "select count(*) from public.pro_feature_requests where user_id = :id and created_at > now() - interval '1 day'",
                ).param("id", identity.id)
                .query(Long::class.java)
                .single()
        if (sentToday >= DAILY_LIMIT) {
            throw ApiException(
                HttpStatus.TOO_MANY_REQUESTS,
                "too_many_requests",
                "Thanks, you have sent several today. Please try again tomorrow.",
            )
        }

        jdbc
            .sql(
                """
                insert into public.pro_feature_requests (user_id, features, note)
                values (:id, cast(:features as text[]), :note)
                """.trimIndent(),
            ).param("id", identity.id)
            // Every key is from PRO_FEATURE_KEYS, so the array literal needs no quoting.
            .param("features", features.joinToString(",", "{", "}"))
            .param("note", note)
            .update()
    }

    private companion object {
        const val MAX_NOTE = 1000
        const val DAILY_LIMIT = 5L
    }
}

@RestController
@RequestMapping("/api/v1")
class ProFeatureRequestController(
    private val service: ProFeatureRequestService,
) {
    @PostMapping("/me/pro-feature-requests")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    fun submit(
        @AuthenticationPrincipal jwt: Jwt,
        @RequestBody request: ProFeatureRequest,
    ) = service.submit(SupabaseIdentity.from(jwt), request)
}
