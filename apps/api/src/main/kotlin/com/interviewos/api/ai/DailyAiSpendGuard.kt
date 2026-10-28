package com.interviewos.api.ai

import io.sentry.Sentry
import org.slf4j.LoggerFactory
import org.springframework.boot.context.properties.ConfigurationProperties
import org.springframework.scheduling.annotation.Scheduled
import java.time.Instant
import java.time.ZoneOffset
import java.util.UUID

@ConfigurationProperties(prefix = "interviewos.ai.budget")
data class AiBudgetProperties(
    /** Zero leaves the optional-call guard inactive unless [requireDailyCap] is enabled. */
    val dailyCapMicroUsd: Long = 0,
    /** Two dollars per candidate per India-time day, independently of the project-wide cap. */
    val perUserDailyCapMicroUsd: Long = 2_000_000,
    /** Production deployments set this so a missing optional-call budget prevents startup. */
    val requireDailyCap: Boolean = false,
) {
    init {
        require(!requireDailyCap || dailyCapMicroUsd > 0) {
            "AI_DAILY_SPEND_CAP_MICRO_USD must be greater than zero when AI_DAILY_SPEND_CAP_REQUIRED is true"
        }
    }
}

data class AiFallbackRate(
    val total: Long,
    val fallbacks: Long,
) {
    val exceedsFivePercent: Boolean get() = total > 0 && fallbacks * 20 > total
}

interface AiSpendReadModel {
    fun spentSince(since: Instant): Long

    fun spentByUserSince(
        userId: UUID,
        since: Instant,
    ): Long

    fun fallbackRateSince(since: Instant): AiFallbackRate
}

/** Stops optional model calls first while preserving an in-progress interview and its report. */
class DailyAiSpendGuard(
    private val properties: AiBudgetProperties,
    private val spend: AiSpendReadModel,
    private val now: () -> Instant = Instant::now,
    private val alert: (String) -> Unit = Sentry::captureMessage,
) {
    private val log = LoggerFactory.getLogger(javaClass)

    @Volatile private var snapshot: Snapshot? = null

    @Volatile private var alertedDay: String? = null

    fun check(call: String) {
        if (properties.dailyCapMicroUsd <= 0 || call !in OPTIONAL_CALLS) return
        val spent = currentSpend()
        if (spent < properties.dailyCapMicroUsd) return
        val day = now().atOffset(ZoneOffset.UTC).toLocalDate().toString()
        synchronized(this) {
            if (alertedDay != day) {
                val message = "AI daily spend guard reached: $spent of ${properties.dailyCapMicroUsd} micro-USD on $day"
                log.warn(message)
                alert(message)
                alertedDay = day
            }
        }
        throw AiUnavailableException(
            "Optional AI preparation is temporarily unavailable because today's spend limit was reached.",
            worthRetryingElsewhere = false,
        )
    }

    private fun currentSpend(): Long {
        val at = now()
        snapshot
            ?.takeIf { at.isBefore(it.expiresAt) && it.day == at.atOffset(ZoneOffset.UTC).toLocalDate().toString() }
            ?.let { return it.spent }
        synchronized(this) {
            snapshot
                ?.takeIf { at.isBefore(it.expiresAt) && it.day == at.atOffset(ZoneOffset.UTC).toLocalDate().toString() }
                ?.let { return it.spent }
            val day = at.atOffset(ZoneOffset.UTC).toLocalDate()
            val total = spend.spentSince(day.atStartOfDay().toInstant(ZoneOffset.UTC))
            snapshot = Snapshot(day.toString(), at.plusSeconds(60), total)
            return total
        }
    }

    /** Sentry is inert without a configured DSN; the log remains visible either way. */
    @Scheduled(fixedDelay = 3_600_000, initialDelay = 60_000)
    fun alertOnFallbackRate() {
        val rate = spend.fallbackRateSince(now().minusSeconds(3_600))
        if (!rate.exceedsFivePercent) return
        val message = "AI fallback rate exceeded 5% in the last hour: ${rate.fallbacks}/${rate.total} successful calls"
        log.warn(message)
        alert(message)
    }

    private data class Snapshot(
        val day: String,
        val expiresAt: Instant,
        val spent: Long,
    )

    private companion object {
        val OPTIONAL_CALLS = setOf("composeRound", "offerHint", "composeLoopPattern", "researchEmployerLoop")
    }
}
