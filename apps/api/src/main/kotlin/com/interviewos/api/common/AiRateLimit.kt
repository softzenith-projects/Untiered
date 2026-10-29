package com.interviewos.api.common

import com.interviewos.api.ai.UserAiSpendGuard
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpServletResponse
import org.slf4j.LoggerFactory
import org.springframework.beans.factory.ObjectProvider
import org.springframework.beans.factory.annotation.Value
import org.springframework.context.annotation.Configuration
import org.springframework.http.HttpStatus
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.oauth2.jwt.Jwt
import org.springframework.web.servlet.HandlerInterceptor
import org.springframework.web.servlet.config.annotation.InterceptorRegistry
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer
import java.time.Clock
import java.util.UUID
import java.util.concurrent.ConcurrentHashMap

/**
 * Per-account hourly limits on the endpoints that call a paid model on every request.
 *
 * The daily practice allowance bounds rounds, but these sit outside a round's clock: one
 * line typed into the composer, a loop brief for a company nobody has asked about (each a
 * fresh model call), a resume re-uploaded in a loop. A script could run up the bill through
 * any of them, so each is capped per account per hour. The limits are far above what a
 * person preparing for an interview does.
 *
 * In memory, per API instance. With one instance — the launch setup — that is exact; with
 * several it is the limit per instance, which still bounds a script. Moving the counts to
 * the database is the step when there are many instances.
 */
class AiRateLimiter(
    private val clock: Clock = Clock.systemUTC(),
) {
    private data class Window(
        val startedAtMillis: Long,
        val count: Int,
    )

    private data class DistinctWindow(
        val startedAtMillis: Long,
        val values: Set<String>,
    )

    private val windows = ConcurrentHashMap<String, Window>()
    private val distinctWindows = ConcurrentHashMap<String, DistinctWindow>()

    /** Returns null when the call may proceed, or the seconds until it may. */
    fun acquire(
        key: String,
        limitPerHour: Int,
    ): Long? {
        val now = clock.millis()
        if (windows.size > MAX_TRACKED_KEYS) windows.entries.removeIf { now - it.value.startedAtMillis >= HOUR_MILLIS }
        var refusedFor: Long? = null
        windows.compute(key) { _, current ->
            when {
                current == null || now - current.startedAtMillis >= HOUR_MILLIS -> {
                    Window(now, 1)
                }

                current.count < limitPerHour -> {
                    current.copy(count = current.count + 1)
                }

                else -> {
                    refusedFor = ((current.startedAtMillis + HOUR_MILLIS - now) / 1000).coerceAtLeast(1)
                    current
                }
            }
        }
        return refusedFor
    }

    /** Repeated briefs for the same company, role, and level do not consume another slot. */
    fun acquireDistinct(
        key: String,
        value: String,
        limitPerHour: Int,
    ): Long? {
        val now = clock.millis()
        if (distinctWindows.size > MAX_TRACKED_KEYS) {
            distinctWindows.entries.removeIf { now - it.value.startedAtMillis >= HOUR_MILLIS }
        }
        var refusedFor: Long? = null
        distinctWindows.compute(key) { _, current ->
            when {
                current == null || now - current.startedAtMillis >= HOUR_MILLIS -> {
                    DistinctWindow(now, setOf(value))
                }

                value in current.values -> {
                    current
                }

                current.values.size < limitPerHour -> {
                    current.copy(values = current.values + value)
                }

                else -> {
                    refusedFor = ((current.startedAtMillis + HOUR_MILLIS - now) / 1000).coerceAtLeast(1)
                    current
                }
            }
        }
        return refusedFor
    }

    private companion object {
        const val HOUR_MILLIS = 3_600_000L
        const val MAX_TRACKED_KEYS = 50_000
    }
}

/** Which requests are limited, under which name, and how many an hour. */
internal data class LimitedRoute(
    val name: String,
    val method: String,
    val pathPattern: Regex,
    val perHour: Int,
)

@Configuration
class AiRateLimitConfig(
    private val userSpendGuard: ObjectProvider<UserAiSpendGuard>,
    @Value("\${interviewos.rate-limit.enabled:true}") private val enabled: Boolean,
    @Value("\${interviewos.rate-limit.round-drafts-per-hour:30}") roundDrafts: Int,
    @Value("\${interviewos.rate-limit.loop-briefs-per-hour:10}") loopBriefs: Int,
    @Value("\${interviewos.rate-limit.resume-uploads-per-hour:6}") resumeUploads: Int,
    @Value("\${interviewos.rate-limit.hints-per-hour:40}") hints: Int,
    @Value("\${interviewos.rate-limit.code-runs-per-hour:200}") codeRuns: Int,
) : WebMvcConfigurer {
    private val log = LoggerFactory.getLogger(javaClass)
    private val limiter = AiRateLimiter()

    private val routes =
        listOf(
            LimitedRoute("round_drafts", "POST", Regex("^/api/v1/round-drafts$"), roundDrafts),
            // The brief and the plan share a budget: the plan is built from the brief.
            LimitedRoute("loop_briefs", "GET", Regex("^/api/v1/(loop-brief|prep-plan)$"), loopBriefs),
            LimitedRoute("resume_uploads", "POST", Regex("^/api/v1/me/resume$"), resumeUploads),
            LimitedRoute("hints", "POST", Regex("^/api/v1/sessions/[^/]+/turns/[^/]+/hint$"), hints),
            // Not a model call, but a compile and a JVM start on our runner each time. The
            // room's Run button and the courses' share one budget, far above a person's use.
            LimitedRoute("code_runs", "POST", Regex("^/api/v1/(sessions/[^/]+/run|code/run)$"), codeRuns),
        )

    override fun addInterceptors(registry: InterceptorRegistry) {
        registry.addInterceptor(
            object : HandlerInterceptor {
                override fun preHandle(
                    request: HttpServletRequest,
                    response: HttpServletResponse,
                    handler: Any,
                ): Boolean {
                    val route =
                        routes.firstOrNull { enabled && it.method == request.method && it.pathPattern.matches(request.requestURI) }
                    val spendGuarded =
                        when (request.method) {
                            "POST" -> request.requestURI in setOf("/api/v1/sessions", "/api/v1/round-drafts", "/api/v1/me/resume")
                            "GET" -> request.requestURI in setOf("/api/v1/loop-brief", "/api/v1/prep-plan")
                            else -> false
                        }
                    if (route == null && !spendGuarded) return true
                    // Unauthenticated requests never reach a controller; nothing to count.
                    val account =
                        (SecurityContextHolder.getContext().authentication?.principal as? Jwt)?.subject ?: return true
                    if (route != null) {
                        val key = "${route.name}:$account"
                        val retryAfter =
                            if (route.name == "loop_briefs") {
                                val company =
                                    request
                                        .getParameter("company")
                                        .orEmpty()
                                        .trim()
                                        .lowercase()
                                val role =
                                    request
                                        .getParameter("role")
                                        .orEmpty()
                                        .trim()
                                        .lowercase()
                                val level =
                                    request
                                        .getParameter("level")
                                        .orEmpty()
                                        .trim()
                                        .lowercase()
                                limiter.acquireDistinct(key, "$company\u0000$role\u0000$level", route.perHour)
                            } else {
                                limiter.acquire(key, route.perHour)
                            }
                        if (retryAfter != null) {
                            log
                                .atWarn()
                                .addKeyValue("user_id", account)
                                .addKeyValue("limit", route.name)
                                .addKeyValue("per_hour", route.perHour)
                                .log("Rate limit reached")
                            response.setHeader("Retry-After", retryAfter.toString())
                            throw ApiException(
                                HttpStatus.TOO_MANY_REQUESTS,
                                "rate_limited",
                                "That has been asked for a lot in the last hour. Try again in ${minutesOf(retryAfter)}.",
                            )
                        }
                    }
                    if (spendGuarded && userSpendGuard.ifAvailable?.reached(UUID.fromString(account)) == true) {
                        log.atWarn().addKeyValue("user_id", account).log("Daily account AI spend cap reached")
                        throw ApiException(
                            HttpStatus.TOO_MANY_REQUESTS,
                            "daily_ai_budget_reached",
                            "You've reached today's AI practice budget. Try again tomorrow.",
                        )
                    }
                    return true
                }
            },
        )
    }

    private fun minutesOf(seconds: Long): String {
        val minutes = (seconds + 59) / 60
        return if (minutes <= 1) "a minute" else "$minutes minutes"
    }
}
